"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Submission, SubmissionAsset } from "@/types/submission";

type SafeError = { message: string };

type CreatorSessionResponse = {
  authenticated: boolean;
  testOnly: boolean;
  approvedCreators: { ccnAccountId: string; displayName: string }[];
  session: { displayName: string; testOnly: true } | null;
  error?: SafeError;
};

type ManualFixtureStatus = {
  authenticated: boolean;
  session: { displayName: string; testOnly: true } | null;
  fixture: { fixtureId: string; slug: string; title: string; description: string };
  submission: Submission | null;
  challenge: {
    acceptsSubmissions: boolean;
    publicationStatus?: string;
    fundingIntentId?: string;
  };
  uploadLimits: {
    maxFiles: number;
    maxTotalBytes: number;
    formats: string[];
    perFile: Record<string, string>;
  };
  isolation: {
    manualTestOnly: boolean;
    noFundingIntent: boolean;
    noCircleOperation: boolean;
    noPayoutEligibility: boolean;
    noWinnerFinalization: boolean;
  };
  error?: SafeError;
};

type UploadItem = {
  localId: string;
  file?: File;
  asset?: SubmissionAsset;
  status: "pending" | "uploading" | "uploaded" | "failed";
  error?: string;
};

async function requestJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: SafeError };
  if (!response.ok) throw payload.error ?? { message: "Request failed safely." };
  return payload as T;
}

async function uploadFile(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/internal/submissions/manual-fixture/upload", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => ({}))) as { asset?: SubmissionAsset; error?: SafeError };
  if (!response.ok || !payload.asset) {
    throw payload.error ?? { message: "Upload failed safely." };
  }
  return payload.asset;
}

function safeMessage(errorValue: unknown) {
  if (typeof errorValue === "object" && errorValue && "message" in errorValue) {
    return String((errorValue as SafeError).message);
  }
  return "Server error. Please try again.";
}

function validOptionalUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function ManualCreatorFixtureClient({
  fixture,
}: {
  fixture: { fixtureId: string; slug: string; title: string; description: string };
}) {
  const finalizeKeyRef = useRef(crypto.randomUUID());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sessionState, setSessionState] = useState<CreatorSessionResponse | null>(null);
  const [status, setStatus] = useState<ManualFixtureStatus | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    projectLink: "",
    supportingLink: "",
  });
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signedIn = Boolean(sessionState?.authenticated && sessionState.session);
  const finalized = status?.submission?.status === "SUBMITTED";
  const uploadedAssets = uploads.flatMap((item) => (item.asset && item.status === "uploaded" ? [item.asset] : []));
  const hasFailedUpload = uploads.some((item) => item.status === "failed");
  const hasPendingUpload = uploads.some((item) => item.status === "pending" || item.status === "uploading");
  const hasAsset = uploadedAssets.length > 0 || Boolean(form.projectLink.trim());
  const limits = status?.uploadLimits;

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!signedIn) errors.push("Sign in required.");
    if (!form.title.trim()) errors.push("Project title is required.");
    if (!form.description.trim()) errors.push("Short description is required.");
    if (!hasAsset) errors.push("Add at least one uploaded file or project link.");
    if (!validOptionalUrl(form.projectLink)) errors.push("Project link must be a valid URL.");
    if (!validOptionalUrl(form.supportingLink)) errors.push("Optional supporting link must be a valid URL.");
    if (hasFailedUpload) errors.push("Remove or retry failed uploads before submitting.");
    if (hasPendingUpload) errors.push("Wait for uploads to finish before submitting.");
    if (finalized) errors.push("Submission already finalized.");
    return errors;
  }, [finalized, form, hasAsset, hasFailedUpload, hasPendingUpload, signedIn]);

  const refreshSession = useCallback(async () => {
    const data = await requestJson<CreatorSessionResponse>("/api/creator/session");
    setSessionState(data);
    return data;
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await requestJson<ManualFixtureStatus>("/api/internal/submissions/manual-fixture/status", {});
      setStatus(data);
      if (data.submission) {
        const submissionAssets = data.submission.assets ?? [];
        setForm({
          title: data.submission.title,
          description: data.submission.description,
          projectLink: submissionAssets.find((asset) => asset.type === "LINK")?.linkUrl ?? data.submission.primaryAssetUrl ?? "",
          supportingLink: data.submission.supportingLinks[0] ?? "",
        });
        setUploads(
          submissionAssets
            .filter((asset) => asset.type === "FILE")
            .map((asset) => ({ localId: asset.id, asset, status: "uploaded" as const })),
        );
      }
      setError(null);
      return data;
    } catch (requestError) {
      setError(safeMessage(requestError));
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const session = await refreshSession();
        if (!active) return;
        if (session.authenticated) await refreshStatus();
      } catch (requestError) {
        if (active) setError(safeMessage(requestError));
      }
    }
    void boot();
    return () => {
      active = false;
    };
  }, [refreshSession, refreshStatus]);

  async function signIn(accountId: string) {
    setPending(true);
    setNotice(null);
    setError(null);
    try {
      const session = await requestJson<CreatorSessionResponse>("/api/creator/session", { ccnAccountId: accountId });
      setSessionState(session);
      await refreshStatus();
    } catch (requestError) {
      setError(safeMessage(requestError));
    } finally {
      setPending(false);
    }
  }

  async function addFiles(fileList: FileList | File[]) {
    const nextFiles = Array.from(fileList);
    if (!nextFiles.length || finalized) return;
    const remaining = (limits?.maxFiles ?? 5) - uploads.length;
    if (nextFiles.length > remaining) {
      setError(`You can upload up to ${limits?.maxFiles ?? 5} files for this manual test.`);
      return;
    }
    const items = nextFiles.map((file) => ({
      localId: crypto.randomUUID(),
      file,
      status: "pending" as const,
    }));
    setUploads((current) => [...current, ...items]);
    for (const item of items) {
      setUploads((current) => current.map((entry) => entry.localId === item.localId ? { ...entry, status: "uploading" } : entry));
      try {
        const asset = await uploadFile(item.file!);
        setUploads((current) => current.map((entry) => entry.localId === item.localId ? { ...entry, asset, status: "uploaded" } : entry));
      } catch (requestError) {
        setUploads((current) => current.map((entry) => entry.localId === item.localId ? { ...entry, status: "failed", error: safeMessage(requestError) } : entry));
      }
    }
  }

  async function retryUpload(item: UploadItem) {
    if (!item.file) return;
    setUploads((current) => current.map((entry) => entry.localId === item.localId ? { ...entry, status: "uploading", error: undefined } : entry));
    try {
      const asset = await uploadFile(item.file);
      setUploads((current) => current.map((entry) => entry.localId === item.localId ? { ...entry, asset, status: "uploaded" } : entry));
    } catch (requestError) {
      setUploads((current) => current.map((entry) => entry.localId === item.localId ? { ...entry, status: "failed", error: safeMessage(requestError) } : entry));
    }
  }

  async function saveDraft() {
    setPending(true);
    setNotice(null);
    setError(null);
    try {
      const data = await requestJson<ManualFixtureStatus>("/api/internal/submissions/manual-fixture/draft", {
        title: form.title,
        description: form.description,
        primaryAssetUrl: form.projectLink,
        supportingLinks: form.supportingLink ? [form.supportingLink] : [],
        assets: uploadedAssets,
      });
      setStatus(data);
      setNotice("Draft saved.");
      return data;
    } catch (requestError) {
      setError(safeMessage(requestError));
      return null;
    } finally {
      setPending(false);
    }
  }

  async function submitEntry() {
    if (validationErrors.length) return;
    setPending(true);
    setNotice(null);
    setError(null);
    try {
      const saved = await requestJson<ManualFixtureStatus>("/api/internal/submissions/manual-fixture/draft", {
        title: form.title,
        description: form.description,
        primaryAssetUrl: form.projectLink,
        supportingLinks: form.supportingLink ? [form.supportingLink] : [],
        assets: uploadedAssets,
      });
      setStatus(saved);
      const finalizedStatus = await requestJson<ManualFixtureStatus>("/api/internal/submissions/manual-fixture/finalize", {
        idempotencyKey: finalizeKeyRef.current,
      });
      setStatus(finalizedStatus);
      setNotice("Submission finalized. Your identity will be hidden from the Brand during review.");
    } catch (requestError) {
      setError(safeMessage(requestError));
      setNotice("Your latest draft is retained if it was saved before finalization failed.");
    } finally {
      setPending(false);
    }
  }

  async function resetFixture() {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await requestJson("/api/internal/submissions/manual-fixture/reset", {});
      setSessionState({
        authenticated: false,
        testOnly: true,
        approvedCreators: sessionState?.approvedCreators ?? [{ ccnAccountId: "ccn-test-creator-001", displayName: "Demo Creator" }],
        session: null,
      });
      setStatus(null);
      setUploads([]);
      setForm({ title: "", description: "", projectLink: "", supportingLink: "" });
      setNotice("Manual fixture reset. Sign in again to start fresh.");
    } catch (requestError) {
      setError(safeMessage(requestError));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030a1f] px-6 py-10 text-white sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">
          Development manual test fixture
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Submit your work</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{fixture.description}</p>

        <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
          Manual test only. This fixture has no funding intent, no Circle operation, no payout eligibility and no winner finalization path.
        </div>

        {!signedIn ? (
          <section className="mt-6 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-6">
            <h2 className="text-xl font-semibold">Sign in required</h2>
            <p className="mt-2 text-sm text-cyan-50">Use the local development Creator session to test the form safely.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(sessionState?.approvedCreators.length ? sessionState.approvedCreators : [{ ccnAccountId: "ccn-test-creator-001", displayName: "Demo Creator" }]).map((creator) => (
                <button
                  key={creator.ccnAccountId}
                  type="button"
                  onClick={() => void signIn(creator.ccnAccountId)}
                  disabled={pending}
                  className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue as {creator.displayName}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.04] p-6">
            {signedIn ? (
              <p className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-50">
                Signed in as {sessionState?.session?.displayName}.
              </p>
            ) : null}
            <label className="block text-sm font-semibold text-slate-200">
              Project title
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                disabled={!signedIn || finalized}
                className="mt-2 block h-11 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-white outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-200">
              Short description
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                disabled={!signedIn || finalized}
                rows={4}
                className="mt-2 block w-full rounded-md border border-white/15 bg-slate-950 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">Upload files</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    PNG, JPG, WEBP, MP4, MOV, WEBM, PDF, AI, PSD or ZIP. Max 5 files.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!signedIn || finalized || pending}
                  className="rounded-md border border-cyan-300/30 px-4 py-2 text-sm font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Choose files
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.pdf,.ai,.psd,.zip"
                onChange={(event) => {
                  if (event.target.files) void addFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
                className="hidden"
              />
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void addFiles(event.dataTransfer.files);
                }}
                className="mt-4 rounded-lg border border-dashed border-white/20 p-5 text-center text-sm text-slate-300"
              >
                Drag and drop files here, or use the file picker.
              </div>
              {uploads.length ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {uploads.map((item) => (
                    <li key={item.localId} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="font-semibold text-white">{item.asset?.displayName ?? item.file?.name ?? "Upload"}</span>
                        <span className="text-slate-300">{item.status}</span>
                      </div>
                      {item.error ? <p className="mt-2 text-red-100">{item.error}</p> : null}
                      {!finalized ? (
                        <div className="mt-2 flex gap-2">
                          {item.status === "failed" ? (
                            <button type="button" onClick={() => void retryUpload(item)} className="text-cyan-200">Retry</button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setUploads((current) => current.filter((entry) => entry.localId !== item.localId))}
                            className="text-slate-300"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <label className="block text-sm font-semibold text-slate-200">
              Project link
              <input
                value={form.projectLink}
                onChange={(event) => setForm((current) => ({ ...current, projectLink: event.target.value }))}
                disabled={!signedIn || finalized}
                placeholder="Figma, GitHub, YouTube, Google Drive, Notion or website URL"
                className="mt-2 block h-11 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-white outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-200">
              Optional supporting link
              <input
                value={form.supportingLink}
                onChange={(event) => setForm((current) => ({ ...current, supportingLink: event.target.value }))}
                disabled={!signedIn || finalized}
                className="mt-2 block h-11 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-white outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            {validationErrors.length ? (
              <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-50">
                <p className="font-bold">Before you submit</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {validationErrors.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}

            {notice ? <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-50">{notice}</div> : null}
            {error ? <div className="rounded-md border border-red-300/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={pending || validationErrors.length > 0}
                className="h-11 rounded-md border border-cyan-300/30 px-4 text-sm font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={() => void submitEntry()}
                disabled={pending || validationErrors.length > 0}
                className="h-11 rounded-md bg-violet-500 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Submit entry
              </button>
              <button
                type="button"
                onClick={() => void resetFixture()}
                disabled={pending}
                className="h-11 rounded-md border border-amber-300/30 px-4 text-sm font-bold text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset manual fixture
              </button>
            </div>
          </div>

          <aside className="space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm">
            <Status label="Signed in" done={signedIn} />
            <Status label="Assets ready" done={hasAsset && !hasFailedUpload && !hasPendingUpload} />
            <Status label="Draft saved" done={Boolean(status?.submission)} />
            <Status label="Submission finalized" done={finalized} />
            <Status label="No funding intent" done={Boolean(status?.isolation.noFundingIntent)} />
            <Status label="No payout path" done={Boolean(status?.isolation.noPayoutEligibility)} />
          </aside>
        </section>
      </section>
    </main>
  );
}

function Status({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={done ? "h-2.5 w-2.5 rounded-full bg-emerald-300" : "h-2.5 w-2.5 rounded-full bg-white/20"} />
      <span className={done ? "text-white" : "text-slate-400"}>{label}</span>
    </div>
  );
}
