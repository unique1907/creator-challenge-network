"use client";

import { useState } from "react";
import type { BlindReviewEntry, FundedChallengeRead } from "@/types/submission";

type SafeError = {
  message: string;
  status?: number;
  code?: string | number;
  endpoint?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = (await response.json().catch(() => ({}))) as {
    error?: SafeError;
  };
  if (!response.ok) throw payload.error ?? { message: "Request failed safely." };
  return payload as T;
}

export function BlindReviewSpikeClient() {
  const [entries, setEntries] = useState<BlindReviewEntry[]>([]);
  const [fieldList, setFieldList] = useState<string[]>([]);
  const [identityLeakTest, setIdentityLeakTest] = useState("Not run");
  const [challenge, setChallenge] = useState<FundedChallengeRead | null>(null);
  const [status, setStatus] = useState("Ready to load anonymous entries.");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<SafeError | null>(null);

  async function loadEntries() {
    setPending(true);
    setError(null);
    try {
      const data = await getJson<{
        entries: BlindReviewEntry[];
        fieldList: string[];
        identityLeakTest: string;
        challenge: FundedChallengeRead;
      }>("/api/internal/blind-review/entries");
      setEntries(data.entries);
      setFieldList(data.fieldList);
      setIdentityLeakTest(data.identityLeakTest);
      setChallenge(data.challenge);
      setStatus("Anonymous blind-review entries loaded.");
    } catch (requestError) {
      const safe =
        typeof requestError === "object" && requestError && "message" in requestError
          ? (requestError as SafeError)
          : { message: "Blind review request failed safely." };
      setError(safe);
      setStatus("Stopped on safe error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030a1f] px-6 py-10 text-white sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">
          Internal blind review spike
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Anonymous Brand review preview
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Development-only Brand view. The API response is projected on the
          server and excludes Creator identity fields.
        </p>

        <div className="mt-8 space-y-5 rounded-xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadEntries}
              disabled={pending}
              className="h-11 rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Load anonymous entries
            </button>
            <span className="text-sm text-slate-300">Status: {status}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Info label="Funded challenge" value={challenge?.verified ? "Verified" : "Not loaded"} />
            <Info label="Identity-leak test" value={identityLeakTest} />
            <Info label="Entry count" value={String(entries.length)} />
          </div>

          <div className="rounded-md border border-white/10 bg-slate-950/60 p-4">
            <p className="text-sm font-bold text-white">API field list</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-300">
              {fieldList.length ? fieldList.join(", ") : "No submitted entries yet"}
            </p>
          </div>

          <div className="grid gap-4">
            {entries.map((entry) => (
              <article
                key={entry.anonymousEntryCode}
                className="rounded-md border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-sm font-bold text-cyan-200">
                    {entry.anonymousEntryCode}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                    {entry.status}
                  </p>
                </div>
                <h2 className="mt-3 text-lg font-bold text-white">{entry.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {entry.description}
                </p>
                <a
                  href={entry.primaryAssetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-bold text-cyan-200 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                >
                  Primary asset reference
                </a>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.supportingLinks.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-violet-200 transition hover:text-violet-100 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    >
                      Supporting link
                    </a>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Submitted: {entry.submittedAt}
                </p>
              </article>
            ))}
          </div>

          {error ? (
            <div className="rounded-md border border-red-300/30 bg-red-400/10 p-4 text-sm text-red-100">
              <p className="font-bold">Safe error</p>
              <p className="mt-2">{error.message}</p>
              {error.status ? <p>HTTP Status: {error.status}</p> : null}
              {error.code ? <p>Circle Code: {error.code}</p> : null}
              {error.endpoint ? <p>Endpoint: {error.endpoint}</p> : null}
            </div>
          ) : null}
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
      <p className="mt-1 break-all font-mono text-sm font-bold text-white">
        {value}
      </p>
    </div>
  );
}
