"use client";

import { useEffect, useRef, useState } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type {
  WinnerFinalizationAuthority,
  WinnerFinalizationRecord,
  WinnerFinalizationSelection,
} from "@/types/winner-finalization";

type SafeError = {
  message: string;
  status?: number;
  code?: string | number;
  endpoint?: string;
};

async function postJson<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/create-challenge/winner-finalization", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: SafeError;
  };
  if (!response.ok) {
    throw payload.error ?? { message: "Winner payout approval request failed." };
  }
  return payload as T;
}

export function PayoutApprovalClient({
  appId,
  draftId,
  authority,
  selectedWinners,
}: {
  appId: string;
  draftId: string;
  authority: WinnerFinalizationAuthority;
  selectedWinners: WinnerFinalizationSelection[];
}) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [record, setRecord] = useState<WinnerFinalizationRecord | null>(null);
  const [error, setError] = useState<SafeError | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    async function bootSdk() {
      if (!appId) return;
      const { W3SSdk: CircleSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new CircleSdk({ appSettings: { appId } });
      if (active) sdkRef.current = sdk;
    }

    void bootSdk().catch(() => {
      setError({ message: "Failed to initialize Circle hosted payout approval." });
    });
    return () => {
      active = false;
    };
  }, [appId]);

  async function reconcile() {
    const data = await postJson<WinnerFinalizationRecord>({
      mode: "reconcile",
      draftId,
      authority,
      selectedWinners,
    });
    setRecord(data);
  }

  async function requestHostedApproval() {
    if (!sdkRef.current || pending) return;
    setPending(true);
    setError(null);
    try {
      const data = await postJson<WinnerFinalizationRecord>({
        mode: "create-approval",
        draftId,
        authority,
        selectedWinners,
      });
      setRecord(data);
      if (!data.circleChallengeId || !data.userToken || !data.encryptionKey) {
        throw { message: "Circle payout approval challenge is not ready." };
      }
      sdkRef.current.setAuthentication({
        userToken: data.userToken,
        encryptionKey: data.encryptionKey,
      });
      sdkRef.current.execute(data.circleChallengeId, (challengeError) => {
        if (challengeError) {
          setError({
            message: challengeError.message ?? "Circle payout approval was not completed.",
            code: challengeError.code,
          });
          return;
        }
        void reconcile().catch((requestError) => {
          setError(
            typeof requestError === "object" && requestError && "message" in requestError
              ? requestError as SafeError
              : { message: "Winner payout reconciliation failed." },
          );
        });
      });
    } catch (requestError) {
      setError(
        typeof requestError === "object" && requestError && "message" in requestError
          ? requestError as SafeError
          : { message: "Winner payout approval failed." },
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm text-white">
      <p className="font-bold">Winner payout approval</p>
      <p className="mt-2 text-slate-300">
        Hosted Circle approval is required before any payout can be reconciled.
      </p>
      <button
        type="button"
        onClick={requestHostedApproval}
        disabled={!appId || pending}
        className="mt-4 rounded-md bg-emerald-400 px-4 py-2 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Confirm Winners and Release Payment
      </button>
      {record ? (
        <p className="mt-3 text-slate-300">State: {record.state}</p>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-md border border-red-300/30 bg-red-400/10 p-3 text-red-100">
          <p>{error.message}</p>
        </div>
      ) : null}
    </div>
  );
}
