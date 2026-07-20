"use client";

import { useState } from "react";

export function WalletSpikeAccessForm({
  configured,
}: {
  configured: boolean;
}) {
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function unlock() {
    setPending(true);
    setError("");
    const response = await fetch("/api/internal/spike/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey }),
    });
    setPending(false);

    if (!response.ok) {
      setError("Invalid or missing internal spike access key.");
      return;
    }

    window.location.reload();
  }

  return (
    <main className="min-h-screen bg-[#030a1f] px-6 py-16 text-white">
      <section className="mx-auto max-w-xl rounded-xl border border-white/10 bg-white/[0.04] p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">
          Internal development route
        </p>
        <h1 className="mt-4 text-3xl font-bold">Wallet spike locked</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          This route is disabled outside development and requires a server-side
          access key. The key is submitted in the request body and is not placed
          in a URL.
        </p>
        {!configured ? (
          <p className="mt-6 rounded-md border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            INTERNAL_SPIKE_ACCESS_KEY is not configured.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-200">
              Internal access key
              <input
                type="password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                className="mt-2 block h-11 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-white outline-none focus:ring-2 focus:ring-cyan-200"
              />
            </label>
            {error ? <p className="text-sm text-red-200">{error}</p> : null}
            <button
              type="button"
              onClick={unlock}
              disabled={pending || accessKey.length < 8}
              className="inline-flex h-11 items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Checking..." : "Unlock spike"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
