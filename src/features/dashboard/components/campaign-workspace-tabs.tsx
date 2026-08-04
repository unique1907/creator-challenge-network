"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BlindReviewEntry } from "@/types/submission";
import type { SubmissionReviewRecord } from "@/types/review";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

type WorkspaceTab = "overview" | "review" | "funding" | "settlement" | "blockchain";

type PrimaryAction = {
  label: string;
  href: string;
  primary: boolean;
  external?: boolean;
};

type ActivityItem = {
  label: string;
  detail: string;
  at?: string;
  tone: "blue" | "green" | "amber" | "violet";
};

type InfoItem = {
  label: string;
  value: string;
  detail?: string;
  tone?: ActivityItem["tone"];
};

type WinnerAttemptSummary = {
  state: string;
  finalizedAt?: string;
  selectedWinnerEntryIds: string[];
  winnerWalletAddresses: string[];
  payoutWalletAddress?: string;
  circleStatus?: string;
  circleChallengeId?: string;
  circleTransactionId?: string | null;
  transactionHash?: string;
  blockNumber?: number;
  receiptStatus?: "success";
  payoutConfirmedAt?: string;
  reconciliationSource?: string;
  finalContractStatus?: string;
  errorMessage?: string;
  reconciliation?: {
    receiptVerified?: boolean;
    eventVerified?: boolean;
    challengeVerified?: boolean;
    winnersVerified?: boolean;
    amountsVerified?: boolean;
    feeVerified?: boolean;
    treasuryVerified?: boolean;
  };
} | null;

type SettlementRecord = NonNullable<WinnerAttemptSummary> & {
  userToken?: string;
  encryptionKey?: string;
};

type CampaignWorkspaceTabsProps = {
  draftId: string;
  blindEntries: BlindReviewEntry[];
  initialReviews: SubmissionReviewRecord[];
  reviewCriteria: string[];
  overviewCards: InfoItem[];
  actions: PrimaryAction[];
  fundingItems: InfoItem[];
  creatorItems: InfoItem[];
  blockchainItems: InfoItem[];
  winnerAttempt: WinnerAttemptSummary;
  winnerCount: 1 | 3;
  circleAppId: string;
  prizePool: string;
  fundedAmount: string;
  fundingTransaction: string;
  escrowStatus: string;
  contractAddress: string;
  verificationState: string;
};

const tabs: { id: WorkspaceTab; label: string }[] = [
  { id: "overview", label: "Business Challenge Overview" },
  { id: "review", label: "Evaluation" },
  { id: "funding", label: "Funding" },
  { id: "settlement", label: "Settlement" },
  { id: "blockchain", label: "Blockchain" },
];
const DEFAULT_WORKSPACE_TAB: WorkspaceTab = "overview";

function tabFromHash(hash: string, options: { settlementUnlocked: boolean }): WorkspaceTab {
  const value = hash.replace("#", "");
  if (value === "finalize-review") return "review";
  if (value === "settlement" && !options.settlementUnlocked) return DEFAULT_WORKSPACE_TAB;
  return tabs.some((tab) => tab.id === value) ? (value as WorkspaceTab) : DEFAULT_WORKSPACE_TAB;
}

function browserTabFromHash(options: { settlementUnlocked: boolean }): WorkspaceTab {
  return tabFromHash(window.location.hash, options);
}

function syncHashTab(setActiveTab: (tab: WorkspaceTab) => void, options: { settlementUnlocked: boolean }) {
  setActiveTab(browserTabFromHash(options));
}

function toneClass(tone: ActivityItem["tone"] = "blue") {
  if (tone === "green") return "bg-emerald-400/15 text-emerald-200";
  if (tone === "amber") return "bg-amber-400/15 text-amber-200";
  if (tone === "violet") return "bg-violet-400/15 text-violet-200";
  return "bg-blue-400/15 text-blue-200";
}

function reviewMap(records: SubmissionReviewRecord[]) {
  return Object.fromEntries(records.map((record) => [record.submissionId, record]));
}

function emptyReview(entry: BlindReviewEntry): SubmissionReviewRecord {
  return {
    challengeId: entry.blindEntryId,
    submissionId: entry.blindEntryId,
    creativity: null,
    brandFit: null,
    execution: null,
    notes: "",
    status: "NOT_STARTED",
    updatedAt: null,
  };
}

function traceFinalizeReview(event: string, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[ccn-finalize-review]", { event, ...details });
}

function normalizedReviewCriteria(criteria: string[]) {
  return criteria.map((item) => item.trim()).filter(Boolean);
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

export function CampaignWorkspaceTabs(props: CampaignWorkspaceTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(DEFAULT_WORKSPACE_TAB);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(props.blindEntries[0]?.blindEntryId ?? "");
  const [reviews, setReviews] = useState(() => reviewMap(props.initialReviews));
  const [reviewLocked, setReviewLocked] = useState(Boolean(props.winnerAttempt?.finalizedAt));
  const settlementUnlocked = Boolean(props.winnerAttempt?.finalizedAt);
  const [finalizedWinnerCodes, setFinalizedWinnerCodes] = useState<string[]>(() => {
    const ids = new Set(props.winnerAttempt?.selectedWinnerEntryIds ?? []);
    return props.blindEntries.filter((entry) => ids.has(entry.blindEntryId)).map((entry) => entry.anonymousEntryCode);
  });
  const effectiveSelectedSubmissionId = props.blindEntries.some((entry) => entry.blindEntryId === selectedSubmissionId)
    ? selectedSubmissionId
    : props.blindEntries[0]?.blindEntryId ?? "";
  const selectedEntry = props.blindEntries.find((entry) => entry.blindEntryId === effectiveSelectedSubmissionId) ?? null;
  const selectedReview = selectedEntry ? reviews[selectedEntry.blindEntryId] ?? emptyReview(selectedEntry) : null;
  const completedCount = props.blindEntries.filter((entry) => reviews[entry.blindEntryId]?.status === "COMPLETED").length;
  const allCompleted = props.blindEntries.length > 0 && completedCount === props.blindEntries.length;

  useEffect(() => {
    function syncTabFromHash() {
      syncHashTab(setActiveTab, { settlementUnlocked });
    }

    function syncAfterAnchorClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest("a[href*='#']") : null;
      if (!target) return;
      window.setTimeout(syncTabFromHash, 0);
    }

    const syncTimer = window.setTimeout(syncTabFromHash, 0);
    window.addEventListener("hashchange", syncTabFromHash);
    window.addEventListener("popstate", syncTabFromHash);
    window.addEventListener("pageshow", syncTabFromHash);
    window.addEventListener("click", syncAfterAnchorClick, true);
    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener("hashchange", syncTabFromHash);
      window.removeEventListener("popstate", syncTabFromHash);
      window.removeEventListener("pageshow", syncTabFromHash);
      window.removeEventListener("click", syncAfterAnchorClick, true);
    };
  }, [settlementUnlocked]);

  const visibleTabs = tabs.filter((tab) => tab.id !== "settlement" || settlementUnlocked);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#0a1020]/90 p-2">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              window.history.replaceState(null, "", `#${tab.id}`);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-950/30"
                : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="mt-5 space-y-5">
          <Section title="Overview Cards">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              {props.overviewCards.map((item) => (
                <Metric key={item.label} item={item} />
              ))}
            </div>
          </Section>

          <Section title="Primary Actions">
            {props.actions.length ? (
              <div className="flex flex-wrap gap-3">
                {props.actions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    target={action.external ? "_blank" : undefined}
                    rel={action.external ? "noreferrer" : undefined}
                    className={
                      action.primary
                        ? "rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110"
                        : "rounded-lg border border-cyan-200/30 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:border-cyan-200/60"
                    }
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState text="No campaign action is available for the current lifecycle state." />
            )}
          </Section>
        </div>
      ) : null}

      {activeTab === "review" ? (
        <ReviewTab
          draftId={props.draftId}
          entries={props.blindEntries}
          reviewCriteria={normalizedReviewCriteria(props.reviewCriteria)}
          selectedEntry={selectedEntry}
          selectedReview={selectedReview}
          reviews={reviews}
          allCompleted={allCompleted}
          reviewLocked={reviewLocked}
          finalizedWinnerCodes={finalizedWinnerCodes}
          winnerCount={props.winnerCount}
          onSelect={setSelectedSubmissionId}
          onSaved={(review) => setReviews((current) => ({ ...current, [review.submissionId]: review }))}
          onFinalized={(codes) => {
            setReviewLocked(true);
            setFinalizedWinnerCodes(codes);
            router.refresh();
          }}
        />
      ) : null}

      {activeTab === "funding" ? (
        <Section title="Funding">
          <div className="grid gap-3 md:grid-cols-2">
            {props.fundingItems.map((item) => (
              <Info key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </Section>
      ) : null}

      {activeTab === "settlement" && settlementUnlocked ? (
        <SettlementTab
          draftId={props.draftId}
          circleAppId={props.circleAppId}
          winnerAttempt={props.winnerAttempt}
          winnerCodes={finalizedWinnerCodes}
          selectedBlindEntryIds={props.winnerAttempt?.selectedWinnerEntryIds ?? []}
          prizePool={props.prizePool}
          fundedAmount={props.fundedAmount}
          fundingTransaction={props.fundingTransaction}
          escrowStatus={props.escrowStatus}
          contractAddress={props.contractAddress}
          verificationState={props.verificationState}
          onUpdated={() => router.refresh()}
        />
      ) : null}

      {activeTab === "blockchain" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Section title="Creator Summary">
            <div className="grid gap-3">
              {props.creatorItems.map((item) => (
                <Info key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </Section>
          <Section title="Blockchain">
            <div className="grid gap-3 md:grid-cols-2">
              {props.blockchainItems.map((item) => (
                <Info key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </Section>
        </div>
      ) : null}
    </div>
  );
}

function ReviewTab({
  draftId,
  entries,
  reviewCriteria,
  selectedEntry,
  selectedReview,
  reviews,
  allCompleted,
  reviewLocked,
  finalizedWinnerCodes,
  winnerCount,
  onSelect,
  onSaved,
  onFinalized,
}: {
  draftId: string;
  entries: BlindReviewEntry[];
  reviewCriteria: string[];
  selectedEntry: BlindReviewEntry | null;
  selectedReview: SubmissionReviewRecord | null;
  reviews: Record<string, SubmissionReviewRecord>;
  allCompleted: boolean;
  reviewLocked: boolean;
  finalizedWinnerCodes: string[];
  winnerCount: 1 | 3;
  onSelect: (value: string) => void;
  onSaved: (review: SubmissionReviewRecord) => void;
  onFinalized: (codes: string[]) => void;
}) {
  const winnerPreviewCodes = [...entries]
    .filter((entry) => reviews[entry.blindEntryId]?.status === "COMPLETED")
    .sort((left, right) => {
      const leftReview = reviews[left.blindEntryId];
      const rightReview = reviews[right.blindEntryId];
      const leftScore = ((leftReview?.creativity ?? 0) + (leftReview?.brandFit ?? 0) + (leftReview?.execution ?? 0)) / 3;
      const rightScore = ((rightReview?.creativity ?? 0) + (rightReview?.brandFit ?? 0) + (rightReview?.execution ?? 0)) / 3;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return left.anonymousEntryCode.localeCompare(right.anonymousEntryCode);
    })
    .slice(0, winnerCount)
    .map((entry) => entry.anonymousEntryCode);
  const selectedWinnerEntryIds = winnerCount === 1 ? [selectedEntry?.blindEntryId].filter((id): id is string => Boolean(id)) : [];
  const selectedWinnerCodes = winnerCount === 1 ? [selectedEntry?.anonymousEntryCode].filter((code): code is string => Boolean(code)) : winnerPreviewCodes;

  if (!selectedEntry || !selectedReview) {
    return (
      <Section title="Evaluation">
        <EmptyState text="No anonymous solutions are available for evaluation yet." />
      </Section>
    );
  }

  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_1.2fr_0.95fr]">
      <Section title={`Anonymous solutions (${entries.length}/${entries.length})`}>
        <div className="space-y-3">
          {entries.map((entry) => {
            const completed = reviews[entry.blindEntryId]?.status === "COMPLETED";
            const selected = selectedEntry.blindEntryId === entry.blindEntryId;
            return (
              <button
                key={entry.blindEntryId}
                type="button"
                onClick={() => onSelect(entry.blindEntryId)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selected
                    ? "border-cyan-300/40 bg-cyan-300/10"
                    : "border-white/10 bg-slate-950/40 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white">{entry.anonymousEntryCode}</p>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${completed ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-slate-300"}`}>
                    {completed ? "Completed" : "Open"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-1 text-sm text-slate-400">{entry.title}</p>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Solution Preview">
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">{selectedEntry.anonymousEntryCode}</p>
          <h3 className="mt-3 text-2xl font-bold text-white">{selectedEntry.title}</h3>
          <p className="mt-4 text-sm leading-6 text-slate-300">{selectedEntry.description}</p>
          <div className="mt-5 grid gap-3">
            <ExternalUrlInfo label="Primary supporting asset" value={selectedEntry.primaryAssetUrl} linkLabel="Open main project" />
            <SupportingLinksInfo links={selectedEntry.supportingLinks} />
            <Info label="Submitted" value={new Date(selectedEntry.submittedAt).toLocaleString()} />
          </div>
        </div>
      </Section>

      <EvaluationPanel
        key={selectedEntry.blindEntryId}
        draftId={draftId}
        selectedEntry={selectedEntry}
        selectedReview={selectedReview}
        reviewCriteria={reviewCriteria}
        allCompleted={allCompleted}
        reviewLocked={reviewLocked}
        selectedWinnerEntryIds={selectedWinnerEntryIds}
        selectedWinnerCodes={selectedWinnerCodes}
        finalizedWinnerCodes={finalizedWinnerCodes}
        onSaved={onSaved}
        onFinalized={onFinalized}
      />
    </section>
  );
}

function ScoreControl({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
        <span className="text-cyan-100">{value}</span>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        className="mt-3 w-full accent-cyan-300 disabled:opacity-50"
      />
    </label>
  );
}

function ExternalUrlInfo({ label, value, linkLabel }: { label: string; value: string; linkLabel: string }) {
  const href = safeExternalUrl(value);
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      {href ? (
        <dd className="mt-2 space-y-2">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-sm font-bold text-cyan-100 transition hover:text-cyan-50"
          >
            {linkLabel}
          </a>
          <span className="block break-words text-xs text-slate-400">{value}</span>
        </dd>
      ) : (
        <dd className="mt-2 break-words text-sm font-bold text-white">{value || "None"}</dd>
      )}
    </div>
  );
}

function SupportingLinksInfo({ links }: { links: string[] }) {
  const cleanLinks = links.map((link) => link.trim()).filter(Boolean);
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Supporting links</dt>
      {cleanLinks.length ? (
        <dd className="mt-2 space-y-3">
          {cleanLinks.map((link) => {
            const href = safeExternalUrl(link);
            return href ? (
              <div key={link} className="space-y-1">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-sm font-bold text-cyan-100 transition hover:text-cyan-50"
                >
                  Open supporting link
                </a>
                <span className="block break-words text-xs text-slate-400">{link}</span>
              </div>
            ) : (
              <span key={link} className="block break-words text-sm font-bold text-white">
                {link}
              </span>
            );
          })}
        </dd>
      ) : (
        <dd className="mt-2 text-sm font-bold text-white">None</dd>
      )}
    </div>
  );
}

function EvaluationPanel({
  draftId,
  selectedEntry,
  selectedReview,
  reviewCriteria,
  allCompleted,
  reviewLocked,
  selectedWinnerEntryIds,
  selectedWinnerCodes,
  finalizedWinnerCodes,
  onSaved,
  onFinalized,
}: {
  draftId: string;
  selectedEntry: BlindReviewEntry;
  selectedReview: SubmissionReviewRecord;
  reviewCriteria: string[];
  allCompleted: boolean;
  reviewLocked: boolean;
  selectedWinnerEntryIds: string[];
  selectedWinnerCodes: string[];
  finalizedWinnerCodes: string[];
  onSaved: (review: SubmissionReviewRecord) => void;
  onFinalized: (codes: string[]) => void;
}) {
  const [creativity, setCreativity] = useState(selectedReview.creativity ?? 80);
  const [brandFit, setBrandFit] = useState(selectedReview.brandFit ?? 80);
  const [execution, setExecution] = useState(selectedReview.execution ?? 80);
  const [notes, setNotes] = useState(selectedReview.notes);
  const [status, setStatus] = useState("");
  const [finalizationError, setFinalizationError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  async function saveReview() {
    if (reviewLocked) return;
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/dashboard/review-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          submissionId: selectedEntry.blindEntryId,
          creativity,
          brandFit,
          execution,
          notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Review could not be saved.");
      onSaved(data.review as SubmissionReviewRecord);
      setStatus("Evaluation saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Evaluation could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Evaluation Panel">
      <div className="space-y-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Blind evaluation</p>
        <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Judging Criteria</p>
          {reviewCriteria.length ? (
            <ul className="mt-3 space-y-2 text-sm font-semibold text-white">
              {reviewCriteria.map((criterion) => (
                <li key={criterion} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
                  {criterion}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No business-challenge-specific judging criteria were saved for this challenge.</p>
          )}
        </div>
        <ScoreControl label="Creativity" value={creativity} onChange={setCreativity} disabled={reviewLocked} />
        <ScoreControl label="Brand Fit" value={brandFit} onChange={setBrandFit} disabled={reviewLocked} />
        <ScoreControl label="Execution" value={execution} onChange={setExecution} disabled={reviewLocked} />
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={reviewLocked}
            rows={7}
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
            placeholder="Private evaluation notes for this anonymous solution."
          />
        </label>
        <button
          type="button"
          onClick={saveReview}
          disabled={saving || reviewLocked}
          className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {saving ? "Saving Evaluation" : "Save Evaluation"}
        </button>
        {status ? <p className="text-sm font-bold text-cyan-100">{status}</p> : null}
        {reviewLocked ? (
          <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100">
            Evaluation locked. Selected solution: {finalizedWinnerCodes.length ? finalizedWinnerCodes.join(", ") : "anonymous entry selected"}.
          </div>
        ) : null}
        <button
          id="finalize-review"
          type="button"
          onClick={() => {
            traceFinalizeReview("confirm-button-click", {
              draftId,
              blindEntryId: selectedEntry.blindEntryId,
              anonymousEntryCode: selectedEntry.anonymousEntryCode,
              allCompleted,
              reviewLocked,
            });
            setFinalizationError("");
            setConfirmOpen(true);
          }}
          disabled={!allCompleted || reviewLocked || finalizing}
          className="w-full rounded-lg border border-emerald-300/40 px-5 py-3 text-sm font-bold text-emerald-100 transition enabled:hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
        >
          {finalizing ? "Finalizing Winner" : reviewLocked ? "Winner Finalized" : "Finalize Winner"}
        </button>
        <p className="text-xs leading-5 text-slate-500">
          Finalize Winner becomes active after every anonymous submission receives a completed evaluation.
        </p>
        {confirmOpen ? (
          <FinalizeReviewModal
            draftId={draftId}
            winnerPreviewCodes={selectedWinnerCodes}
            finalizing={finalizing}
            error={finalizationError}
            onCancel={() => {
              if (finalizing) return;
              setFinalizationError("");
              setConfirmOpen(false);
            }}
            onConfirm={async () => {
              traceFinalizeReview("request-start", {
                draftId,
                winnerPreviewCodes: selectedWinnerCodes,
                selectedWinnerEntryIds,
              });
              setFinalizing(true);
              setStatus("");
              setFinalizationError("");
              try {
                const response = await fetch("/api/dashboard/finalize-review", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ draftId, selectedBlindEntryIds: selectedWinnerEntryIds }),
                });
                traceFinalizeReview("response-status", {
                  draftId,
                  status: response.status,
                  ok: response.ok,
                });
                const data = await response.json().catch(() => ({}));
                traceFinalizeReview("response-body", {
                  draftId,
                  ok: response.ok,
                  body: data,
                });
                if (!response.ok) throw new Error(data?.error?.message ?? "Evaluation could not be finalized.");
                const codes = Array.isArray(data?.winner?.selectedAnonymousEntryCodes) ? data.winner.selectedAnonymousEntryCodes : selectedWinnerCodes;
                setStatus("Winner finalized. Selected solution is locked for payout preparation.");
                setConfirmOpen(false);
                onFinalized(codes);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Evaluation could not be finalized.";
                traceFinalizeReview("catch", {
                  draftId,
                  message,
                });
                setFinalizationError(message);
                setStatus(message);
              } finally {
                traceFinalizeReview("finally", { draftId });
                setFinalizing(false);
              }
            }}
          />
        ) : null}
      </div>
    </Section>
  );
}

function maskValue(value?: string | null) {
  if (!value) return "Not available";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function settlementStatusLabel(state?: string) {
  if (state === "PAYOUT_CONFIRMED") return "Verified settlement";
  if (state === "TRANSACTION_SUBMITTED") return "releasePayout submitted";
  if (state === "FINALIZATION_IN_PROGRESS") return "releasePayout pending";
  if (state === "ACTION_REQUIRED") return "PAYOUT approval pending";
  if (state === "FINALIZATION_FAILED") return "Payout failed";
  if (state === "RECONCILIATION_REQUIRED") return "Reconciliation required";
  return "Ready for PAYOUT approval";
}

async function postWinnerFinalization<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/create-challenge/winner-finalization", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Settlement request failed.");
  return payload as T;
}

function SettlementTab({
  draftId,
  circleAppId,
  winnerAttempt,
  winnerCodes,
  selectedBlindEntryIds,
  prizePool,
  fundedAmount,
  fundingTransaction,
  escrowStatus,
  contractAddress,
  verificationState,
  onUpdated,
}: {
  draftId: string;
  circleAppId: string;
  winnerAttempt: WinnerAttemptSummary;
  winnerCodes: string[];
  selectedBlindEntryIds: string[];
  prizePool: string;
  fundedAmount: string;
  fundingTransaction: string;
  escrowStatus: string;
  contractAddress: string;
  verificationState: string;
  onUpdated: () => void;
}) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [record, setRecord] = useState<SettlementRecord | null>(winnerAttempt);
  const [pending, setPending] = useState<"approval" | "status" | "reconcile" | null>(null);
  const [error, setError] = useState("");
  const [hostedApprovalCompleted, setHostedApprovalCompleted] = useState(false);
  const current = record ?? winnerAttempt;
  const payoutConfirmed = current?.state === "PAYOUT_CONFIRMED";
  const hasChallenge = Boolean(current?.circleChallengeId);
  const hasTransaction = Boolean(current?.transactionHash);
  const settlementDisplayStatus =
    hostedApprovalCompleted && hasChallenge && !hasTransaction && current?.state !== "FINALIZATION_FAILED"
      ? "PAYOUT submitted / awaiting transaction confirmation"
      : settlementStatusLabel(current?.state);

  useEffect(() => {
    let active = true;
    async function bootSdk() {
      if (!circleAppId) return;
      const { W3SSdk: CircleSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new CircleSdk({ appSettings: { appId: circleAppId } });
      if (active) sdkRef.current = sdk;
    }
    void bootSdk().catch(() => setError("Circle Hosted PAYOUT approval could not be initialized."));
    return () => {
      active = false;
    };
  }, [circleAppId]);

  async function refreshStatus() {
    setPending("status");
    setError("");
    try {
      const data = await postWinnerFinalization<SettlementRecord>({
        mode: "status",
        draftId,
        authority: "BRAND",
      });
      setRecord(data);
      onUpdated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Settlement status could not be refreshed.");
    } finally {
      setPending(null);
    }
  }

  async function reconcile() {
    setPending("reconcile");
    setError("");
    try {
      const data = await postWinnerFinalization<SettlementRecord>({
        mode: "reconcile",
        draftId,
        authority: "BRAND",
      });
      setRecord(data);
      onUpdated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Settlement reconciliation could not be completed.");
    } finally {
      setPending(null);
    }
  }

  async function initiateApproval() {
    if (!sdkRef.current || pending) return;
    setPending("approval");
    setError("");
    try {
      const data = await postWinnerFinalization<SettlementRecord>({
        mode: "create-approval",
        draftId,
        authority: "BRAND",
        selectedBlindEntryIds,
      });
      setRecord(data);
      setHostedApprovalCompleted(false);
      if (!data.circleChallengeId || !data.userToken || !data.encryptionKey) {
        throw new Error("Circle Hosted PAYOUT approval is not ready yet.");
      }
      sdkRef.current.setAuthentication({
        userToken: data.userToken,
        encryptionKey: data.encryptionKey,
      });
      sdkRef.current.execute(data.circleChallengeId, (challengeError) => {
        if (challengeError) {
          setError(challengeError.message ?? "Circle Hosted PAYOUT approval was not completed.");
          setPending(null);
          return;
        }
        setHostedApprovalCompleted(true);
        void refreshStatus();
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "PAYOUT approval could not be initiated.");
      setPending(null);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <Section title="Selected Solution Summary">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Info label="Anonymous selected solution" value={winnerCodes.length ? winnerCodes.join(", ") : "Anonymous selected solution locked"} />
          <Info label="Prize amount" value={prizePool} />
          <Info label="Destination wallet" value={maskValue(current?.winnerWalletAddresses?.[0])} />
          <Info label="Solution status" value={settlementDisplayStatus} />
          <Info label="Evaluation locked" value={current?.finalizedAt ? "Yes" : "No"} />
        </div>
      </Section>

      <Section title="Funding Verification">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Info label="Funded amount" value={fundedAmount} />
          <Info label="Funding transaction" value={fundingTransaction} />
          <Info label="Escrow status" value={escrowStatus} />
          <Info label="Contract" value={contractAddress} />
          <Info label="Verification" value={verificationState} />
        </div>
      </Section>

      <Section title="Payout Approval">
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="PAYOUT wallet" value={maskValue(current?.payoutWalletAddress)} />
            <Info label="Approval status" value={current?.circleStatus ?? settlementStatusLabel(current?.state)} />
            <Info label="Circle challenge" value={maskValue(current?.circleChallengeId)} />
            <Info label="Circle transaction" value={maskValue(current?.circleTransactionId)} />
          </div>
          <div className="rounded-lg border border-cyan-200/20 bg-cyan-300/10 p-4 text-sm text-cyan-50">
            <p className="font-bold">Circle PIN required</p>
            <p className="mt-2 leading-6 text-cyan-100/80">
              Initiating approval opens Circle Hosted UI. Complete the PIN prompt there; no PIN, token or secret is stored by CCN.
            </p>
            <button
              type="button"
              onClick={initiateApproval}
              disabled={!circleAppId || pending !== null || payoutConfirmed || hasChallenge}
              className="mt-4 w-full rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {pending === "approval" ? "Opening Hosted Approval" : hasChallenge ? "PAYOUT Approval Created" : "Initiate PAYOUT Approval"}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Settlement Execution">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Info label="releasePayout status" value={settlementDisplayStatus} />
          <Info label="Transaction hash" value={maskValue(current?.transactionHash)} />
          <Info label="Failure" value={current?.errorMessage ?? "None"} />
          <Info label="Recovery" value={hasTransaction && !payoutConfirmed ? "Reconcile available" : payoutConfirmed ? "No retry needed" : "Waiting for approval"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={refreshStatus}
            disabled={pending !== null || payoutConfirmed}
            className="rounded-lg border border-cyan-200/30 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending === "status" ? "Refreshing" : "Refresh Payout Status"}
          </button>
          <button
            type="button"
            onClick={reconcile}
            disabled={pending !== null || !hasTransaction || payoutConfirmed}
            className="rounded-lg border border-emerald-300/40 px-5 py-3 text-sm font-bold text-emerald-100 transition enabled:hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
          >
            {pending === "reconcile" ? "Reconciling" : "Reconcile Settlement"}
          </button>
        </div>
      </Section>

      <Section title="On-Chain Verification">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Info label="WinnersPaid event" value={current?.reconciliation?.eventVerified ? "Verified" : "Not verified"} />
          <Info label="Receipt status" value={current?.receiptStatus ?? "Not confirmed"} />
          <Info label="Block number" value={current?.blockNumber ? String(current.blockNumber) : "Not available"} />
          <Info label="Reconciliation" value={current?.reconciliationSource ?? "Not reconciled"} />
          <Info label="Canonical state" value={current?.state ?? "READY_FOR_FINAL_SELECTION"} />
        </div>
      </Section>

      <Section title="Completion">
        <div className="grid gap-3 md:grid-cols-3">
          <Info label="Campaign status" value={payoutConfirmed ? "Completed" : "Settlement open"} />
          <Info label="Campaign health" value={payoutConfirmed ? "Settled" : "Payout pending"} />
          <Info label="Payout transaction" value={maskValue(current?.transactionHash)} />
        </div>
        {current?.transactionHash ? (
          <a
            href={`https://testnet.arcscan.app/tx/${current.transactionHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded-lg border border-cyan-200/30 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:border-cyan-200/60"
          >
            View Payout Transaction
          </a>
        ) : null}
      </Section>

      {error ? (
        <div className="rounded-lg border border-red-300/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}
function FinalizeReviewModal({
  draftId,
  winnerPreviewCodes,
  finalizing,
  error,
  onCancel,
  onConfirm,
}: {
  draftId: string;
  winnerPreviewCodes: string[];
  finalizing: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0a1020] p-6 shadow-2xl shadow-black/40">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Finalize blind review</p>
        <h3 className="mt-3 text-2xl font-bold text-white">Lock review and persist winner?</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This locks the completed anonymous reviews and stores the winning anonymous submission for payout preparation. Creator identity remains hidden.
        </p>
        <div className="mt-5 rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-200">Selected anonymous winner</p>
          <p className="mt-2 text-lg font-bold text-white">{winnerPreviewCodes.length ? winnerPreviewCodes.join(", ") : "Calculated on server"}</p>
          <p className="mt-2 break-all text-xs text-slate-400">Draft: {draftId}</p>
        </div>
        {error ? (
          <div className="mt-4 rounded-lg border border-red-300/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={finalizing}
            className="rounded-lg border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.04] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={finalizing}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 disabled:opacity-50"
          >
            {finalizing ? "Finalizing" : "Confirm Finalization"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0a1020]/90 p-5 shadow-xl shadow-black/10">
      <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-300">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-2 break-words text-sm font-bold text-white">{value}</dd>
    </div>
  );
}

function Metric({ item }: { item: InfoItem }) {
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5">
      <span className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-bold ${toneClass(item.tone)}`}>{item.label.slice(0, 1)}</span>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-white">{item.value}</p>
      {item.detail ? <p className="mt-1 text-sm text-slate-400">{item.detail}</p> : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-slate-950/30 p-5 text-sm text-slate-400">
      {text}
    </div>
  );
}
