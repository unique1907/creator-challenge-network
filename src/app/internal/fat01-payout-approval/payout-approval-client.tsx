"use client";

import { useEffect, useRef, useState } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

type Operation = {
  draftId: string;
  challengeId: string;
  canonicalWinner: string;
  payoutAmount: string;
  platformFee: string;
  escrow: string;
  payoutWallet: string;
  treasury: string;
  chainId: string;
  selectedBlindEntryIds: readonly string[];
};

type SafeError = {
  message: string;
  status?: number;
  code?: string | number;
};

type ApprovalResponse = {
  state: string;
  circleChallengeId?: string;
  circleTransactionId?: string;
  transactionHash?: string;
  userToken?: string;
  encryptionKey?: string;
};

async function postJson<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/create-challenge/winner-finalization", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: SafeError };
  if (!response.ok) {
    throw payload.error ?? { message: "Hosted payout approval request failed." };
  }
  return payload as T;
}

export function Fat01PayoutApprovalClient({
  appId,
  operation,
}: {
  appId: string;
  operation: Operation;
}) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [record, setRecord] = useState<ApprovalResponse | null>(null);
  const [status, setStatus] = useState("Ready for hosted approval creation.");
  const [error, setError] = useState<SafeError | null>(null);
  const [pending, setPending] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function bootSdk() {
      if (!appId) return;
      const { W3SSdk: CircleSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new CircleSdk({ appSettings: { appId } });
      if (active) {
        sdkRef.current = sdk;
        setSdkReady(true);
      }
    }

    void bootSdk().catch(() => {
      setError({ message: "Failed to initialize Circle hosted payout approval." });
    });
    return () => {
      active = false;
    };
  }, [appId]);

  async function openApproval() {
    if (!sdkRef.current || pending || record?.circleChallengeId) return;
    setPending(true);
    setError(null);
    setStatus("Creating hosted payout approval challenge...");
    try {
      const data = await postJson<ApprovalResponse>({
        mode: "create-approval",
        draftId: operation.draftId,
        authority: "BRAND",
        selectedBlindEntryIds: operation.selectedBlindEntryIds,
      });
      setRecord(data);
      if (!data.circleChallengeId || !data.userToken || !data.encryptionKey) {
        throw { message: "Circle payout approval challenge is not ready." };
      }
      sdkRef.current.setAuthentication({
        userToken: data.userToken,
        encryptionKey: data.encryptionKey,
      });
      setStatus("Opening Circle Hosted PAYOUT approval UI. Waiting for PIN.");
      sdkRef.current.execute(data.circleChallengeId, (challengeError) => {
        if (challengeError) {
          setError({
            message: challengeError.message ?? "Circle payout approval was not completed.",
            code: challengeError.code,
          });
          setStatus("Hosted approval returned an error before reconciliation.");
          return;
        }
        setStatus("Hosted approval callback completed. Waiting for operator confirmation before reconciliation.");
      });
    } catch (requestError) {
      setError(
        typeof requestError === "object" && requestError && "message" in requestError
          ? requestError as SafeError
          : { message: "Hosted payout approval failed." },
      );
      setStatus("Hosted approval did not open.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6 space-y-4 text-sm">
      <dl className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/70 p-4 sm:grid-cols-2">
        <div><dt className="text-slate-400">Draft ID</dt><dd className="break-all font-mono">{operation.draftId}</dd></div>
        <div><dt className="text-slate-400">Challenge ID</dt><dd className="break-all font-mono">{operation.challengeId}</dd></div>
        <div><dt className="text-slate-400">Canonical winner</dt><dd className="break-all font-mono">{operation.canonicalWinner}</dd></div>
        <div><dt className="text-slate-400">Payout amount</dt><dd className="font-mono">{operation.payoutAmount} units</dd></div>
        <div><dt className="text-slate-400">PAYOUT wallet</dt><dd className="break-all font-mono">{operation.payoutWallet}</dd></div>
        <div><dt className="text-slate-400">Escrow</dt><dd className="break-all font-mono">{operation.escrow}</dd></div>
      </dl>
      <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
        <p className="font-bold text-cyan-100">Status</p>
        <p className="mt-1 text-cyan-50">{status}</p>
        {record ? (
          <p className="mt-2 text-cyan-50">Attempt state: {record.state}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={openApproval}
        disabled={!appId || !sdkReady || pending || Boolean(record?.circleChallengeId)}
        className="rounded-md bg-emerald-400 px-4 py-2 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Opening approval..." : "Open Hosted PAYOUT Approval"}
      </button>
      {error ? (
        <div className="rounded-md border border-red-300/30 bg-red-400/10 p-3 text-red-100">
          <p>{error.message}</p>
        </div>
      ) : null}
    </section>
  );
}
