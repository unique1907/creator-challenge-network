import type { ReactNode } from "react";

type StatusBadgeTone = "demo" | "testnet" | "ready" | "pending" | "neutral";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
};

const toneClassNames: Record<StatusBadgeTone, string> = {
  demo: "border-violet-300/30 bg-violet-400/10 text-violet-100",
  testnet: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
  ready: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  pending: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  neutral: "border-white/15 bg-white/5 text-slate-200",
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${toneClassNames[tone]}`}
    >
      {children}
    </span>
  );
}
