import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBrandAccountControlData } from "@/features/dashboard/brand-account-controls.server";
import { BrandAccountControls } from "@/features/dashboard/components/brand-workspace-navigation";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import {
  listCreateChallengeDraftStates,
  listWinnerFinalizationAttempts,
  type WinnerFinalizationAttemptRecord,
} from "@/services/create-challenge/create-challenge-store.server";
import type { CreateChallengeDraftState } from "@/types/create-challenge";

export const metadata: Metadata = {
  title: "Payments | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export default async function BrandPaymentsPage() {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");

  const drafts = await listCreateChallengeDraftStates({ ccnAccountId: context.ccnAccountId });
  const winnerAttempts = (await listWinnerFinalizationAttempts()).filter((attempt) => attempt.ccnAccountId === context.ccnAccountId);
  const accountControls = await getBrandAccountControlData(context);

  return (
    <main className="min-h-screen bg-[#030711] px-3 py-3 text-white xl:px-5">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/dashboard" className="text-[12px] font-semibold text-blue-300">Back to dashboard</Link>
            <h1 className="mt-1.5 text-lg font-semibold leading-[1.12] tracking-normal md:text-xl">Payments</h1>
            <p className="mt-1 max-w-3xl text-[12px] text-slate-400">
              Real funding and settlement status from your business challenges. Arc Testnet uses test USDC only.
            </p>
          </div>
          <BrandAccountControls {...accountControls} />
        </header>

        <section className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-violet-200">Challenge Funding</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">Prize pools locked before a challenge opens for solutions.</p>
            </div>
            <Link href="/dashboard/campaigns" className="text-[12px] font-semibold text-violet-200">View challenges -&gt;</Link>
          </div>
          <div className="mt-2 space-y-1.5">
            {drafts.length ? drafts.map((draft) => (
              <PaymentRow
                key={draft.challenge.id}
                title={draft.challenge.title || "Untitled business challenge"}
                detail={`${formatTestUsdc(draft.prizePool.totalRequiredUnits)} total required`}
                status={fundingStatusLabel(draft)}
                evidence={draft.funding.transactionHash || draft.funding.approvalTransactionHash || "No transaction evidence yet"}
                href={`/dashboard/challenges/${encodeURIComponent(draft.challenge.id ?? "")}#funding`}
              />
            )) : (
              <p className="text-[12px] text-slate-400">No business challenge funding records are available yet.</p>
            )}
          </div>
        </section>

        <section className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-violet-200">Selected Solution Settlement</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">Payout readiness and completion after a Brand finalizes a winner.</p>
          <div className="mt-2 space-y-1.5">
            {drafts.length ? drafts.map((draft) => {
              const attempt = winnerAttempts.find((item) =>
                item.draftId === draft.challenge.id &&
                item.challengeId === draft.challenge.challengeId &&
                item.fundingIntentId === draft.funding.fundingIntentId
              );
              return (
                <PaymentRow
                  key={`${draft.challenge.id}:settlement`}
                  title={draft.challenge.title || "Untitled business challenge"}
                  detail={`${formatTestUsdc(draft.prizePool.prizePoolUnits)} selected-solution reward`}
                  status={settlementStatusLabel(attempt)}
                  evidence={attempt?.transactionHash || attempt?.circleTransactionId || "No payout evidence yet"}
                  href={`/dashboard/challenges/${encodeURIComponent(draft.challenge.id ?? "")}#settlement`}
                />
              );
            }) : (
              <p className="text-[12px] text-slate-400">No settlement records are available yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function formatTestUsdc(units: string) {
  try {
    const value = BigInt(units || "0");
    const usdcBase = BigInt("1000000");
    const whole = value / usdcBase;
    const fraction = (value % usdcBase).toString().padStart(6, "0").replace(/0+$/, "");
    return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""} test USDC`;
  } catch {
    return "test USDC amount unavailable";
  }
}

function fundingStatusLabel(draft: CreateChallengeDraftState) {
  if (draft.funding.fundingStatus === "funded" || draft.funding.fundingStatus === "live") return "Funded";
  if (draft.funding.fundingStatus === "funding-pending") return "Funding pending";
  if (draft.funding.fundingStatus === "approved") return "Approved";
  if (draft.funding.fundingStatus === "approval-pending") return "Approval pending";
  return "Not funded";
}

function settlementStatusLabel(attempt?: WinnerFinalizationAttemptRecord) {
  if (!attempt) return "Winner not finalized";
  if (attempt.state === "PAYOUT_CONFIRMED") return "Paid";
  if (attempt.state === "TRANSACTION_SUBMITTED") return "Payout submitted";
  if (attempt.state === "READY_FOR_FINAL_SELECTION") return "Selection ready";
  if (attempt.state === "ACTION_REQUIRED" || attempt.state === "APPROVAL_CREATION_IN_PROGRESS") return "Approval pending";
  if (attempt.state === "APPROVAL_CREATED_RECONCILIATION_REQUIRED") return "Approval needs review";
  if (attempt.state === "RECONCILIATION_REQUIRED") return "Needs review";
  if (attempt.state === "FINALIZATION_FAILED") return "Finalization failed";
  if (attempt.state === "ALREADY_FINALIZED") return "Finalized";
  return "In progress";
}

function PaymentRow({
  title,
  detail,
  status,
  evidence,
  href,
}: {
  title: string;
  detail: string;
  status: string;
  evidence: string;
  href: string;
}) {
  return (
    <Link href={href} className="grid gap-2 rounded-md border border-white/10 bg-slate-950/35 p-2 transition hover:border-white/20 md:grid-cols-[minmax(0,1.3fr)_136px_minmax(0,1fr)]">
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-semibold text-white">{title}</span>
        <span className="mt-0.5 block text-[10px] text-slate-400">{detail}</span>
      </span>
      <span className="self-center rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-center text-[10px] font-semibold text-emerald-100">
        {status}
      </span>
      <span className="min-w-0 self-center truncate text-[10px] text-blue-200">{evidence}</span>
    </Link>
  );
}
