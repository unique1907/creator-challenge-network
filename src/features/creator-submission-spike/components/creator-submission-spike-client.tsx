"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FundedChallengeRead, Submission } from "@/types/submission";

type SafeError = {
  message: string;
};

type CreatorSessionResponse = {
  authenticated: boolean;
  authModel: "development-test-creator" | "production-auth-not-configured";
  testOnly: boolean;
  approvedCreators: { ccnAccountId: string; displayName: string }[];
  session: {
    displayName: string;
    authProvider: "email";
    testOnly: true;
  } | null;
  error?: SafeError;
};

type SubmissionStatusResponse = {
  authenticated?: boolean;
  session?: CreatorSessionResponse["session"];
  submission: Submission | null;
  challenge: FundedChallengeRead;
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

function errorMessage(errorValue: unknown) {
  if (typeof errorValue === "object" && errorValue && "message" in errorValue) {
    return String((errorValue as SafeError).message);
  }
  return "Server error. Please try again.";
}

function isValidOptionalUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function fieldErrors(form: {
  title: string;
  description: string;
  primaryAssetUrl: string;
  supportingLink: string;
}) {
  const errors: string[] = [];
  if (!form.title.trim()) errors.push("Project title is required.");
  if (!form.description.trim()) errors.push("Short description is required.");
  if (!form.primaryAssetUrl.trim()) {
    errors.push("Main project link is required.");
  } else if (!isValidOptionalUrl(form.primaryAssetUrl)) {
    errors.push("Main project link must be a valid URL.");
  }
  if (!isValidOptionalUrl(form.supportingLink)) {
    errors.push("Optional supporting link must be a valid URL.");
  }
  return errors;
}

export function CreatorSubmissionSpikeClient({
  draftId,
  challengeTitle,
  challengeSlug,
}: {
  draftId: string;
  challengeTitle: string;
  challengeSlug: string;
}) {
  const finalizeKeyRef = useRef(crypto.randomUUID());
  const [sessionState, setSessionState] = useState<CreatorSessionResponse | null>(null);
  const [challenge, setChallenge] = useState<FundedChallengeRead | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    primaryAssetUrl: "",
    supportingLink: "",
  });
  const [status, setStatus] = useState("Sign in to submit your work.");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<SafeError | null>(null);

  const signedIn = Boolean(sessionState?.authenticated && sessionState.session);
  const finalized = submission?.status === "SUBMITTED";
  const closed = Boolean(challenge && !challenge.acceptsSubmissions);
  const validationErrors = useMemo(() => fieldErrors(form), [form]);

  const steps = useMemo<[string, boolean][]>(
    () => [
      ["Signed in", signedIn],
      ["Challenge open", Boolean(challenge?.acceptsSubmissions)],
      ["Draft saved", Boolean(submission)],
      ["Submission finalized", finalized],
    ],
    [challenge, finalized, signedIn, submission],
  );

  const loadSession = useCallback(async () => {
    const data = await requestJson<CreatorSessionResponse>("/api/creator/session");
    setSessionState(data);
    return data;
  }, []);

  const refreshSubmission = useCallback(async () => {
    const data = await requestJson<SubmissionStatusResponse>("/api/internal/submissions/status", {
      draftId,
    });
    setChallenge(data.challenge);
    setSubmission(data.submission);
    if (data.submission) {
      setForm({
        title: data.submission.title,
        description: data.submission.description,
        primaryAssetUrl: data.submission.primaryAssetUrl,
        supportingLink: data.submission.supportingLinks[0] ?? "",
      });
    }
    setStatus(data.submission?.status === "SUBMITTED" ? "Submission finalized." : "Ready to submit your work.");
    return data;
  }, [draftId]);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const data = await loadSession();
        if (!active) return;
        if (data.authenticated) await refreshSubmission();
      } catch (requestError) {
        if (!active) return;
        setError({ message: errorMessage(requestError) });
      }
    }
    void boot();
    return () => {
      active = false;
    };
  }, [draftId, loadSession, refreshSubmission]);

  async function signIn(accountId: string) {
    setPending(true);
    setError(null);
    try {
      const data = await requestJson<CreatorSessionResponse>("/api/creator/session", { ccnAccountId: accountId });
      setSessionState(data);
      await refreshSubmission();
    } catch (requestError) {
      setError({ message: errorMessage(requestError) });
      setStatus("Sign in required.");
    } finally {
      setPending(false);
    }
  }

  async function saveDraft() {
    setPending(true);
    setError(null);
    try {
      const data = await requestJson<SubmissionStatusResponse>("/api/internal/submissions/draft", {
        draftId,
        title: form.title,
        description: form.description,
        primaryAssetUrl: form.primaryAssetUrl,
        supportingLinks: form.supportingLink ? [form.supportingLink] : [],
      });
      setSubmission(data.submission);
      setChallenge(data.challenge);
      setStatus("Draft saved.");
    } catch (requestError) {
      setError({ message: errorMessage(requestError) });
    } finally {
      setPending(false);
    }
  }

  async function finalizeSubmission() {
    setPending(true);
    setError(null);
    try {
      const data = await requestJson<SubmissionStatusResponse>("/api/internal/submissions/finalize", {
        draftId,
        idempotencyKey: finalizeKeyRef.current,
      });
      setSubmission(data.submission);
      setChallenge(data.challenge);
      setStatus("Submission finalized. Your identity will be hidden from the Brand during review.");
    } catch (requestError) {
      setError({ message: errorMessage(requestError) });
    } finally {
      setPending(false);
    }
  }

  const unavailableReasons = [
    !signedIn ? "Sign in required." : null,
    closed ? "Submission deadline passed." : null,
    finalized ? "Submission already finalized." : null,
    ...validationErrors,
  ].filter(Boolean) as string[];

  const canSave = signedIn && !closed && !finalized && validationErrors.length === 0 && !pending;
  const canFinalize = signedIn && Boolean(submission) && !closed && !finalized && !pending;

  return (
    <main className="min-h-screen bg-[#030a1f] px-6 py-10 text-white sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">
          Creator submission
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Submit your work</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          {challengeTitle} is accepting completed creative work through a blind review process.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{challengeTitle}</p>
              <p className="mt-1 text-sm text-slate-300">
                {closed ? "Submissions are closed." : "Your identity will be hidden from the Brand during review."}
              </p>
            </div>
            <a
              href={`/challenges/${challengeSlug}`}
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
            >
              View challenge
            </a>
          </div>
        </div>

        {!signedIn ? (
          <section className="mt-6 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-6">
            <h2 className="text-xl font-semibold text-white">Sign in required</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-50">
              This local demo uses a development-only Creator sign-in. Production Google, Apple and email onboarding is not connected yet.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {sessionState?.approvedCreators.length ? (
                sessionState.approvedCreators.map((creator) => (
                  <button
                    key={creator.ccnAccountId}
                    type="button"
                    onClick={() => void signIn(creator.ccnAccountId)}
                    disabled={pending}
                    className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Continue as {creator.displayName}
                  </button>
                ))
              ) : (
                <p className="text-sm text-amber-100">
                  Creator sign-in is not configured for this environment.
                </p>
              )}
            </div>
          </section>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="space-y-5 rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <div className="rounded-md border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
              Status: {status}
            </div>

            {signedIn ? (
              <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-50">
                Signed in as {sessionState?.session?.displayName}. This is a development/test-only Creator session.
              </div>
            ) : null}

            {challenge?.blockers.length ? (
              <div className="rounded-md border border-red-300/30 bg-red-400/10 p-4 text-sm text-red-100">
                <p className="font-bold">Submission unavailable</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {challenge.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="Eligibility" value={challenge?.acceptsSubmissions ? "Open" : "Sign in to check"} />
              <Info label="Submission" value={finalized ? "Finalized" : submission ? "Draft saved" : "Not started"} />
              <Info label="Review" value="Blind review" />
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-4">
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
              <label className="block text-sm font-semibold text-slate-200">
                Main project link
                <input
                  value={form.primaryAssetUrl}
                  onChange={(event) => setForm((current) => ({ ...current, primaryAssetUrl: event.target.value }))}
                  disabled={!signedIn || finalized}
                  placeholder="YouTube, Figma, GitHub, Google Drive, Website or Notion"
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

              {unavailableReasons.length ? (
                <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-50">
                  <p className="font-bold">Before you submit</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {unavailableReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={!canSave}
                  className="h-11 rounded-md bg-cyan-300 px-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={finalizeSubmission}
                  disabled={!canFinalize}
                  className="h-11 rounded-md bg-violet-500 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Submit entry
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-red-300/30 bg-red-400/10 p-4 text-sm text-red-100">
                <p className="font-bold">We could not complete that action</p>
                <p className="mt-2">{error.message}</p>
              </div>
            ) : null}
          </section>

          <aside className="space-y-4 rounded-xl border border-white/10 bg-white/[0.04] p-6">
            {steps.map(([label, done]) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span className={done ? "h-2.5 w-2.5 rounded-full bg-emerald-300" : "h-2.5 w-2.5 rounded-full bg-white/20"} />
                <span className={done ? "text-white" : "text-slate-400"}>{label}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-4 text-sm text-slate-300">
              Add your project link from YouTube, Figma, GitHub, Google Drive, a website or Notion. File upload is not enabled in this demo.
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white">
        {value}
      </p>
    </div>
  );
}
