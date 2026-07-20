"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type {
  EscrowFundingVerification,
  EscrowPreflightSnapshot,
  EscrowTransactionSnapshot,
  EscrowTransactionStage,
} from "@/types/escrow-funding-spike";
import type { SpikeAppSession } from "@/types/wallet-spike";

type SafeError = {
  message: string;
  status?: number;
  code?: string | number;
  endpoint?: string;
};

type PreflightResponse = EscrowPreflightSnapshot & {
  display: Record<string, string>;
};

function mask(value?: string | null) {
  if (!value) return "Not available";
  if (value.length <= 12) return `${value.slice(0, 3)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: SafeError;
  };
  if (!response.ok) {
    throw payload.error ?? { message: "Request failed safely." };
  }
  return payload as T;
}

export function EscrowFundingSpikeClient({
  appId,
  configured,
}: {
  appId: string;
  configured: boolean;
}) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [session, setSession] = useState<SpikeAppSession | null>(null);
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [approval, setApproval] = useState<EscrowTransactionSnapshot | null>(null);
  const [funding, setFunding] = useState<EscrowTransactionSnapshot | null>(null);
  const [verification, setVerification] =
    useState<EscrowFundingVerification | null>(null);
  const [links, setLinks] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState("Ready for Brand funding preflight.");
  const [error, setError] = useState<SafeError | null>(null);
  const [pending, setPending] = useState(false);

  const canUseCircle = configured && Boolean(appId);
  const ccnAccountId = "ccn-test-email-001";
  const authProvider = "email";

  useEffect(() => {
    let active = true;

    async function bootSdk() {
      if (!appId) return;
      const { W3SSdk: CircleSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new CircleSdk({ appSettings: { appId } });
      if (active) sdkRef.current = sdk;
    }

    void bootSdk().catch(() => {
      setError({ message: "Failed to initialize Circle challenge SDK." });
    });
    return () => {
      active = false;
    };
  }, [appId]);

  const steps = useMemo<[string, boolean][]>(
    () => [
      ["Brand wallet ready", Boolean(preflight?.wallet.walletAddress)],
      ["Balance verified", Boolean(preflight?.ready)],
      [
        "Approval required",
        Boolean(preflight && BigInt(preflight.allowance) < BigInt(preflight.amounts.totalRequired)),
      ],
      [
        "Approval confirmed",
        Boolean(
          preflight &&
            BigInt(preflight.allowance) >= BigInt(preflight.amounts.totalRequired),
        ),
      ],
      ["Escrow funding required", Boolean(preflight?.ready && !preflight.escrow.isFunded)],
      ["Funding confirmed", Boolean(verification?.isFunded)],
      ["Challenge secured", Boolean(verification?.eventVerified)],
    ],
    [preflight, verification],
  );

  function showError(errorValue: unknown) {
    const safe =
      typeof errorValue === "object" && errorValue && "message" in errorValue
        ? (errorValue as SafeError)
        : { message: "Escrow funding spike request failed safely." };
    setError(safe);
    setStatus("Stopped on safe error.");
  }

  async function createSessionAndPreflight() {
    setPending(true);
    setError(null);
    try {
      const appSession = await postJson<SpikeAppSession>(
        "/api/internal/circle/user/session",
        { ccnAccountId, authProvider },
      );
      setSession(appSession);
      const data = await postJson<{ preflight: PreflightResponse }>(
        "/api/internal/circle/escrow-funding/preflight",
        { userToken: appSession.userToken },
      );
      setPreflight(data.preflight);
      setStatus(
        data.preflight.ready
          ? "Preflight passed. Ready for exact USDC approval."
          : "Preflight completed with blockers.",
      );
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  async function refreshPreflight() {
    if (!session) return;
    const data = await postJson<{ preflight: PreflightResponse }>(
      "/api/internal/circle/escrow-funding/preflight",
      { userToken: session.userToken },
    );
    setPreflight(data.preflight);
  }

  async function reconcile(stage: EscrowTransactionStage) {
    if (!session) return null;
    setError(null);
    try {
      const data = await postJson<{ result: EscrowTransactionSnapshot }>(
        "/api/internal/circle/escrow-funding/reconcile",
        { userToken: session.userToken, stage },
      );
      if (stage === "approval") setApproval(data.result);
      if (stage === "funding") setFunding(data.result);
      await refreshPreflight();
      return data.result;
    } catch (requestError) {
      showError(requestError);
      return null;
    }
  }

  async function executeChallenge(challengeId: string, stage: EscrowTransactionStage) {
    if (!sdkRef.current || !session) return;
    sdkRef.current.setAuthentication({
      userToken: session.userToken,
      encryptionKey: session.encryptionKey,
    });
    setStatus(`Executing Circle ${stage} challenge...`);
    sdkRef.current.execute(challengeId, (challengeError) => {
      if (challengeError) {
        setError({
          message: challengeError.message ?? "Circle challenge failed.",
          code: challengeError.code,
        });
        setStatus(`${stage} challenge failed.`);
        return;
      }
      setStatus(`${stage} challenge completed. Reconciling transaction...`);
      void reconcile(stage);
    });
  }

  async function approveUsdc() {
    if (!session) return;
    setPending(true);
    setError(null);
    try {
      const data = await postJson<{
        approval: { alreadyApproved?: boolean; challengeId?: string };
      }>("/api/internal/circle/escrow-funding/approve", {
        userToken: session.userToken,
      });
      if (data.approval.alreadyApproved) {
        setStatus("Allowance already sufficient. Funding can proceed.");
        await refreshPreflight();
        return;
      }
      if (!data.approval.challengeId) {
        throw { message: "Circle did not return an approval challenge ID." };
      }
      await executeChallenge(data.approval.challengeId, "approval");
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  async function fundChallenge() {
    if (!session) return;
    setPending(true);
    setError(null);
    try {
      const data = await postJson<{ funding: { challengeId?: string } }>(
        "/api/internal/circle/escrow-funding/fund",
        { userToken: session.userToken },
      );
      if (!data.funding.challengeId) {
        throw { message: "Circle did not return a funding challenge ID." };
      }
      await executeChallenge(data.funding.challengeId, "funding");
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  async function verifyFunding() {
    if (!session) return;
    setPending(true);
    setError(null);
    try {
      const data = await postJson<{
        verification: EscrowFundingVerification;
        links: Record<string, string | null>;
      }>("/api/internal/circle/escrow-funding/verify", {
        userToken: session.userToken,
      });
      setVerification(data.verification);
      setLinks(data.links);
      setStatus(
        data.verification.eventVerified
          ? "Challenge secured and verified on Arc Testnet."
          : "Funding state loaded; event verification is not complete yet.",
      );
      await refreshPreflight();
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030a1f] px-6 py-10 text-white sm:px-8 lg:px-10">
      <section className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">
          Internal escrow funding spike
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          First Brand funding on Arc Testnet
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Development-only approve + fund flow for the existing CCN Brand SCA
          wallet and deployed CCNEscrow contract.
        </p>

        {!canUseCircle ? (
          <div className="mt-6 rounded-md border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            Missing required Circle or internal spike configuration.
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5 rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={createSessionAndPreflight}
                disabled={!canUseCircle || pending}
                className="h-11 rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Run preflight
              </button>
              <button
                type="button"
                onClick={approveUsdc}
                disabled={!session || !preflight?.ready || pending}
                className="h-11 rounded-md bg-emerald-500 px-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Approve 10.10 USDC
              </button>
              <button
                type="button"
                onClick={fundChallenge}
                disabled={
                  !session ||
                  !preflight ||
                  BigInt(preflight.allowance) < BigInt(preflight.amounts.totalRequired) ||
                  preflight.escrow.isFunded ||
                  pending
                }
                className="h-11 rounded-md bg-cyan-300 px-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Fund challenge
              </button>
              <button
                type="button"
                onClick={verifyFunding}
                disabled={!session || pending}
                className="h-11 rounded-md border border-white/15 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Verify funding
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void reconcile("approval")}
                disabled={!session || pending}
                className="h-10 rounded-md border border-white/15 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reconcile approval
              </button>
              <button
                type="button"
                onClick={() => void reconcile("funding")}
                disabled={!session || pending}
                className="h-10 rounded-md border border-white/15 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reconcile funding
              </button>
            </div>

            <div className="rounded-md border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
              Status: {status}
            </div>

            {preflight?.blockers.length ? (
              <div className="rounded-md border border-red-300/30 bg-red-400/10 p-4 text-sm text-red-100">
                <p className="font-bold">Preflight blockers</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {preflight.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Brand wallet" value={mask(preflight?.wallet.walletAddress)} />
              <Info label="Challenge ID" value={mask(preflight?.challengeId)} />
              <Info label="Brand USDC" value={preflight?.display.brandUsdc ?? "Not loaded"} />
              <Info label="Allowance" value={preflight?.display.allowance ?? "Not loaded"} />
              <Info label="Escrow USDC" value={preflight?.display.escrowUsdc ?? "Not loaded"} />
              <Info label="Liabilities" value={preflight?.escrow.totalLockedLiabilities ?? "Not loaded"} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Approval tx" value={mask(approval?.transactionHash)} />
              <Info label="Approval status" value={approval?.state ?? "Not submitted"} />
              <Info label="Funding tx" value={mask(funding?.transactionHash)} />
              <Info label="Funding status" value={funding?.state ?? "Not submitted"} />
            </div>

            {verification ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm">
                <p className="font-bold text-white">Post-funding verification</p>
                <div className="mt-3 grid gap-2 text-slate-300 sm:grid-cols-2">
                  <p>Funded: {verification.isFunded ? "yes" : "no"}</p>
                  <p>Event: {verification.eventVerified ? "verified" : "not verified"}</p>
                  <p>Sponsor: {mask(verification.challenge.sponsor)}</p>
                  <p>Distribution: {verification.distribution.join(", ")}</p>
                  <p>Duplicate simulation: {verification.duplicateSimulation.rejected ? "rejected" : "not rejected"}</p>
                  <p>Allowance after: {verification.allowance}</p>
                </div>
              </div>
            ) : null}

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

          <aside className="space-y-4 rounded-xl border border-white/10 bg-white/[0.04] p-6">
            {steps.map(([label, done]) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span
                  className={
                    done
                      ? "h-2.5 w-2.5 rounded-full bg-emerald-300"
                      : "h-2.5 w-2.5 rounded-full bg-white/20"
                  }
                />
                <span className={done ? "text-white" : "text-slate-400"}>{label}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-4 text-sm text-slate-300">
              <p>Network: ARC-TESTNET</p>
              <p>USDC: 0x3600...0000</p>
              <p>Escrow: 0x5714...eBF6</p>
            </div>
            <div className="space-y-2 text-sm">
              {links.contract ? <SafeLink href={links.contract} label="Contract Arcscan" /> : null}
              {links.approval ? <SafeLink href={links.approval} label="Approval Arcscan" /> : null}
              {links.funding ? <SafeLink href={links.funding} label="Funding Arcscan" /> : null}
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
      <p className="mt-1 break-all font-mono text-sm font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function SafeLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block font-bold text-cyan-200 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200"
    >
      {label}
    </a>
  );
}
