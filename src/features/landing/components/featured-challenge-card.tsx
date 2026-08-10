import Link from "next/link";
import { BusinessChallengeCover, formatBusinessChallengeHierarchy } from "@/components/ui/business-challenge-cover";
import type { Challenge } from "@/types/ccn";
import { formatDeadlineDateLabel } from "@/features/landing/lib/deadline-countdown";
import { LandingIcon } from "./landing-icons";

type EvidencePill = {
  label: string;
  icon: "lock" | "blind" | "arc" | "wallet" | "payout";
  tone: "green" | "violet" | "cyan";
};

function statusLabel(status: Challenge["status"]) {
  if (status === "open") return "Open for Solutions";
  if (status === "reviewing") return "Under Evaluation";
  if (status === "closed") return "Closed - No Submissions";
  if (status === "selection") return "Selection in Progress";
  if (status === "settlement") return "Settlement in Progress";
  return "Completed";
}

function formatReward(challenge: Challenge) {
  return `${challenge.rewardUsdc.toLocaleString()} test USDC`;
}

function deadlineLabel(challenge: Challenge) {
  if (challenge.status === "completed") return "Completed";
  if (challenge.submissionClosed) return "Submissions closed";
  return formatDeadlineDateLabel(challenge.deadline);
}

function solutionLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "solution" : "solutions"}`;
}

function ctaLabel(challenge: Challenge) {
  if (challenge.publicCtaLabel) return challenge.publicCtaLabel;
  if (challenge.status === "open") return "View Challenge";
  if (challenge.status === "completed") return "View Outcome";
  return "View Progress";
}

function evidencePills(challenge: Challenge): EvidencePill[] {
  if (challenge.status === "completed") {
    return [
      { label: "Payout verified on Arc", icon: "payout", tone: "green" },
      { label: "Circle Wallets", icon: "wallet", tone: "cyan" },
      { label: "Arc Testnet", icon: "arc", tone: "cyan" },
    ];
  }

  return [
    { label: "Prize Pool Funded", icon: "lock", tone: "green" },
    { label: "Blind Review", icon: "blind", tone: "violet" },
    { label: "Arc Testnet", icon: "arc", tone: "cyan" },
  ];
}

function pillClassName(tone: EvidencePill["tone"]) {
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "violet") return "border-violet-200 bg-violet-50 text-violet-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

export function FeaturedChallengeCard({ challenge }: { challenge?: Challenge | null }) {
  if (!challenge) {
    const placeholderPills: EvidencePill[] = [
      { label: "Prize Pool Funded", icon: "lock", tone: "green" },
      { label: "Blind Review", icon: "blind", tone: "violet" },
      { label: "Arc Testnet", icon: "arc", tone: "cyan" },
    ];

    return (
      <article className="rounded-xl border border-slate-200 bg-[#F3F4F6] p-5 shadow-xl shadow-slate-950/10">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Live challenge</p>
          <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">Public preview</span>
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">Funded challenges appear after verification</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Published Business Challenges appear here once funding and escrow evidence are verified.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {placeholderPills.map((pill) => (
            <span key={pill.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${pillClassName(pill.tone)}`}>
              <LandingIcon name={pill.icon} className="h-3.5 w-3.5" />
              {pill.label}
            </span>
          ))}
        </div>
      </article>
    );
  }

  const featured = challenge;
  const stats = [
    { label: "Prize Pool", value: formatReward(featured) },
    { label: "Solutions", value: solutionLabel(featured.submissions) },
    { label: "Deadline", value: deadlineLabel(featured) },
  ];
  const publicStatus = statusLabel(featured.status);
  const pills = evidencePills(featured).slice(0, 3);
  const hierarchy = formatBusinessChallengeHierarchy({
    brand: featured.brand,
    title: featured.title,
    category: featured.category,
  });

  return (
    <article className="rounded-xl border border-[#D9DEE7] bg-[#F3F4F6] p-5 shadow-xl shadow-slate-950/10">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Featured challenge</p>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
          Live
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
        <BusinessChallengeCover
          src={featured.coverImageUrl}
          alt={featured.coverImageAlt}
          title={featured.title}
          tone="light"
          className="aspect-[16/10] w-full rounded-lg shadow-sm shadow-slate-950/5 sm:w-40"
          imageClassName="p-2"
        />
        <div className="min-w-0">
          {hierarchy.brand ? <p className="truncate text-xs font-semibold text-slate-500">{hierarchy.brand}</p> : null}
          <h2 className="mt-2 line-clamp-3 text-2xl font-bold leading-tight tracking-tight text-slate-950">
            {hierarchy.title}
          </h2>
          <span className="mt-2 inline-flex rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-900">
            {hierarchy.category}
          </span>
          {featured.summary ? (
            <p className="mt-2 line-clamp-1 text-sm text-slate-600">{featured.summary}</p>
          ) : null}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {stats.map((stat, index) => (
          <div key={stat.label} className={`px-3 py-3 ${index ? "border-l border-slate-200" : ""}`}>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">{stat.label}</dt>
            <dd className="mt-1 text-sm font-bold leading-5 text-slate-950">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className={`h-2.5 w-2.5 rounded-full ${featured.status === "completed" || featured.status === "open" ? "bg-emerald-300" : "bg-cyan-300"}`} />
        {publicStatus}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((pill) => (
          <span key={pill.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${pillClassName(pill.tone)}`}>
            <LandingIcon name={pill.icon} className="h-3.5 w-3.5" />
            {pill.label}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link href={`/challenges/${featured.slug}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-cyan-200">
          {ctaLabel(featured)}
          <LandingIcon name="arrow" className="h-4 w-4" />
        </Link>
        {featured.status === "completed" && featured.payoutTransactionHash ? (
          <a href={`https://testnet.arcscan.app/tx/${featured.payoutTransactionHash}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-md border border-blue-200 px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-cyan-200">
            View Settlement
          </a>
        ) : null}
      </div>
    </article>
  );
}
