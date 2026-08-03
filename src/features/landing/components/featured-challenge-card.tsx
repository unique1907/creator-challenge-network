import type { Challenge } from "@/types/ccn";
import { LandingIcon } from "./landing-icons";

const verificationFacts = [
  { label: "Escrow", value: "Funded before publish", icon: "lock" as const },
  { label: "Wallets", value: "Circle Hosted approval", icon: "wallet" as const },
  { label: "Network", value: "Arc Testnet", icon: "arc" as const },
];

const sampleChallenge: Challenge = {
  source: "mock",
  slug: "sample-funded-brief",
  title: "Sample Creator Challenge",
  brand: "Sample brand",
  category: "Creative Strategy",
  rewardUsdc: 2500,
  deadline: "Open for submissions",
  submissions: 8,
  status: "open",
  usageRights: "Demo usage rights",
  escrowStatus: "Escrow ready",
  summary: "A sample funded creative brief for juror review, shown only when no live challenge is available.",
  brief: "A sample funded creative brief for juror review, shown only when no live challenge is available.",
  deliverables: [],
  evaluation: ["Blind scoring"],
  audience: "Creators exploring CCN.",
  accent: "blue",
  winnerModel: "Top 1",
};

function statusLabel(status: Challenge["status"]) {
  if (status === "reviewing") return "Review";
  if (status === "funded") return "Funded";
  return "Live";
}

function formatReward(challenge: Challenge) {
  return `${challenge.rewardUsdc.toLocaleString()} USDC`;
}

function deadlineLabel(challenge: Challenge) {
  if (challenge.submissionClosed) return "Submissions closed";
  if (/^\d{4}-\d{2}-\d{2}$/.test(challenge.deadline)) return `Open until ${challenge.deadline}`;
  return challenge.deadline;
}

export function FeaturedChallengeCard({ challenge }: { challenge?: Challenge | null }) {
  const featured = challenge ?? sampleChallenge;
  const campaignFacts = [
    { label: "Brand", value: featured.brand },
    { label: "Category", value: featured.category },
    { label: "Prize Pool", value: formatReward(featured) },
    { label: "Status", value: statusLabel(featured.status) },
    { label: "Deadline", value: deadlineLabel(featured) },
    { label: "Review", value: featured.evaluation[0] ?? "Blind scoring" },
  ];

  return (
    <article className="rounded-2xl border border-white/12 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Featured challenge</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">{featured.title}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
            {featured.summary}
          </p>
        </div>
        <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">
          {featured.source === "canonical" ? "Live" : "Sample"}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {campaignFacts.map((fact) => (
          <div key={fact.label} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{fact.label}</dt>
            <dd className="mt-2 text-sm font-bold text-white">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-slate-950/45 p-4">
        {verificationFacts.map((fact) => (
          <div key={fact.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <LandingIcon name={fact.icon} className="h-4 w-4 text-cyan-200" />
              {fact.label}
            </span>
            <span className="font-semibold text-white">{fact.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Submissions</p>
          <p className="mt-1 text-lg font-bold text-white">{featured.submissions}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Winner model</p>
          <p className="mt-1 text-lg font-bold text-white">{featured.winnerModel ?? "Top 1"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Creator entry</p>
          <p className="mt-1 text-lg font-bold text-white">{featured.submissionClosed ? "Closed" : "Open"}</p>
        </div>
      </div>
    </article>
  );
}
