"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type {
  SpikeAppSession,
  SpikeBalanceSnapshot,
  SpikeWalletRecord,
} from "@/types/wallet-spike";

type AuthProvider = "google" | "apple" | "email";

type SafeError = {
  message: string;
  status?: number;
  code?: string | number;
  endpoint?: string;
};

function mask(value: string) {
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
    throw payload.error ?? { message: "Request failed." };
  }

  return payload as T;
}

export function WalletSpikeClient({
  appId,
  configured,
}: {
  appId: string;
  configured: boolean;
}) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProvider>("google");
  const [ccnAccountId, setCcnAccountId] = useState("google:demo-creator-001");
  const [session, setSession] = useState<SpikeAppSession | null>(null);
  const [wallet, setWallet] = useState<SpikeWalletRecord | null>(null);
  const [balances, setBalances] = useState<SpikeBalanceSnapshot | null>(null);
  const [status, setStatus] = useState(
    "Ready for CCN-authenticated Arc Testnet wallet spike.",
  );
  const [error, setError] = useState<SafeError | null>(null);
  const [pending, setPending] = useState(false);
  const [balancePending, setBalancePending] = useState(false);

  const canUseCircle = configured && Boolean(appId);

  useEffect(() => {
    let active = true;

    async function bootSdk() {
      if (!appId) return;
      const { W3SSdk: CircleSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new CircleSdk({ appSettings: { appId } });
      if (active) {
        sdkRef.current = sdk;
      }
    }

    void bootSdk().catch(() => {
      setError({ message: "Failed to initialize Circle challenge SDK." });
    });

    return () => {
      active = false;
    };
  }, [appId]);

  const masked = useMemo(
    () => ({
      circleUserId: mask(session?.circleUserId ?? wallet?.circleUserId ?? ""),
      walletId: mask(wallet?.walletId ?? ""),
      walletAddress: wallet?.walletAddress ?? "Not available",
    }),
    [session, wallet],
  );

  const explorerUrl = wallet?.walletAddress
    ? `https://testnet.arcscan.app/address/${wallet.walletAddress}`
    : balances?.explorerUrl;

  function showError(errorValue: unknown) {
    const safe =
      typeof errorValue === "object" && errorValue && "message" in errorValue
        ? (errorValue as SafeError)
        : { message: "Internal wallet spike request failed." };
    setError(safe);
    setStatus("Request failed safely.");
  }

  async function createAppSession() {
    setPending(true);
    setError(null);
    try {
      const data = await postJson<SpikeAppSession>(
        "/api/internal/circle/user/session",
        {
          ccnAccountId,
          authProvider,
        },
      );
      setSession(data);
      setStatus(
        "CCN app auth simulated. Circle user fetched and short-lived wallet session created.",
      );
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  async function initializeWallet() {
    if (!session || !sdkRef.current) return;
    setPending(true);
    setError(null);
    try {
      sdkRef.current.setAuthentication({
        userToken: session.userToken,
        encryptionKey: session.encryptionKey,
      });
      const data = await postJson<{
        alreadyMapped?: boolean;
        challengeId?: string;
        wallet?: SpikeWalletRecord;
      }>("/api/internal/circle/wallet/initialize", {
        ccnAccountId: session.ccnAccountId,
        authProvider: session.authProvider,
        userToken: session.userToken,
      });

      if (data.alreadyMapped && data.wallet) {
        setWallet(data.wallet);
        setStatus("Existing local wallet mapping loaded.");
        return;
      }

      if (!data.challengeId) {
        throw { message: "Circle did not return a wallet challenge ID." };
      }

      setStatus("Executing Circle wallet creation challenge...");
      sdkRef.current.execute(data.challengeId, (challengeError) => {
        if (challengeError) {
          setError({
            message:
              challengeError.message ?? "Circle wallet challenge failed.",
            code: challengeError.code,
          });
          setStatus("Wallet challenge failed.");
          return;
        }
        setStatus("Challenge complete. Refresh wallet status.");
        void refreshWalletStatus();
      });
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  async function refreshWalletStatus() {
    if (!session) return;
    setPending(true);
    setError(null);
    try {
      const data = await postJson<{ wallet: SpikeWalletRecord | null }>(
        "/api/internal/circle/wallet/status",
        {
          ccnAccountId: session.ccnAccountId,
          authProvider: session.authProvider,
          userToken: session.userToken,
        },
      );
      setWallet(data.wallet);
      if (!data.wallet) {
        setBalances(null);
      }
      setStatus(
        data.wallet
          ? "Wallet status loaded."
          : "No ARC-TESTNET SCA wallet found yet.",
      );
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  async function refreshBalances() {
    if (!session || !wallet) return;
    setBalancePending(true);
    setError(null);
    try {
      const data = await postJson<{ balances: SpikeBalanceSnapshot }>(
        "/api/internal/circle/wallet/balances",
        {
          ccnAccountId: session.ccnAccountId,
          authProvider: session.authProvider,
          userToken: session.userToken,
        },
      );
      setBalances(data.balances);
      setStatus("Wallet balance loaded.");
    } catch (requestError) {
      showError(requestError);
    } finally {
      setBalancePending(false);
    }
  }

  async function clearSession() {
    setSession(null);
    setWallet(null);
    setBalances(null);
    setError(null);
    setStatus("Local browser spike session cleared.");
  }

  return (
    <main className="min-h-screen bg-[#030a1f] px-6 py-10 text-white sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">
          Internal wallet spike
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          CCN-authenticated wallet on Arc Testnet
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Temporary development-only proof of concept. CCN owns authentication;
          Circle is used only for user-controlled wallet lifecycle, address,
          signing, Arc Testnet, and future USDC operations.
        </p>

        {!canUseCircle ? (
          <div className="mt-6 rounded-md border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            Missing required configuration: CIRCLE_API_KEY,
            NEXT_PUBLIC_CIRCLE_APP_ID, or INTERNAL_SPIKE_ACCESS_KEY.
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5 rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <label className="block text-sm font-semibold text-slate-200">
              CCN auth provider
              <select
                value={authProvider}
                onChange={(event) => setAuthProvider(event.target.value as AuthProvider)}
                className="mt-2 block h-11 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-white outline-none focus:ring-2 focus:ring-cyan-200"
              >
                <option value="google">Google</option>
                <option value="apple">Apple</option>
                <option value="email">Email</option>
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Authenticated CCN account ID
              <input
                type="text"
                value={ccnAccountId}
                onChange={(event) => setCcnAccountId(event.target.value)}
                placeholder="google:demo-creator-001"
                className="mt-2 block h-11 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-white outline-none focus:ring-2 focus:ring-cyan-200"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={createAppSession}
                disabled={!canUseCircle || pending || ccnAccountId.length < 5}
                className="h-11 rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create app wallet session
              </button>
              <button
                type="button"
                onClick={initializeWallet}
                disabled={!session || pending}
                className="h-11 rounded-md bg-emerald-500 px-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Initialize user-controlled wallet
              </button>
              <button
                type="button"
                onClick={refreshWalletStatus}
                disabled={!session || pending}
                className="h-11 rounded-md border border-white/15 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh wallet status
              </button>
            </div>

            <button
              type="button"
              onClick={clearSession}
              className="h-11 rounded-md border border-red-300/30 bg-red-400/10 px-4 text-sm font-bold text-red-100"
            >
              Clear local test session
            </button>

            <div className="rounded-md border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
              Wallet creation status: {status}
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">
                    ARC-TESTNET token balance
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Verified contract: 0x3600...0000
                  </p>
                </div>
                <button
                  type="button"
                  onClick={refreshBalances}
                  disabled={!session || !wallet || balancePending}
                  className="h-10 rounded-md border border-white/15 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {balancePending ? "Refreshing..." : "Refresh balances"}
                </button>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-slate-400">Test USDC balance</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {balances?.testUsdcBalance
                      ? `${balances.testUsdcBalance.amount} ${balances.testUsdcBalance.symbol}`
                      : "Not loaded"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {balances?.testUsdcBalance?.tokenContractVerified
                      ? "Official Arc Testnet USDC contract verified"
                      : "Awaiting verified token balance"}
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-slate-400">Last balance refresh</p>
                  <p className="mt-1 font-mono text-xs text-white">
                    {balances?.lastRefreshAt ?? "Not refreshed"}
                  </p>
                  <a
                    href="https://faucet-v2.circle.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-sm font-bold text-cyan-200 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  >
                    Open Circle Faucet
                  </a>
                </div>
              </div>
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

          <aside className="space-y-4 rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Circle user ID
              </p>
              <p className="mt-1 font-mono text-sm text-white">
                {masked.circleUserId}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Wallet ID
              </p>
              <p className="mt-1 font-mono text-sm text-white">
                {masked.walletId}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Wallet address
              </p>
              <p className="mt-1 break-all font-mono text-sm text-white">
                {masked.walletAddress}
              </p>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(wallet?.walletAddress ?? "")
                }
                disabled={!wallet?.walletAddress}
                className="mt-3 h-10 rounded-md border border-white/15 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Copy wallet address
              </button>
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-bold text-cyan-200 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                >
                  View on Arcscan
                </a>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-white/10 bg-slate-950/50 p-3">
                <p className="text-slate-400">Blockchain</p>
                <p className="mt-1 font-bold">ARC-TESTNET</p>
              </div>
              <div className="rounded-md border border-white/10 bg-slate-950/50 p-3">
                <p className="text-slate-400">Account type</p>
                <p className="mt-1 font-bold">SCA</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
