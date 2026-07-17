import type { PlatformStat } from "@/types/ccn";

type MetricCardProps = {
  stat: PlatformStat;
};

export function MetricCard({ stat }: MetricCardProps) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/15">
      <p className="text-sm font-medium text-slate-400">{stat.label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {stat.value}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-300">{stat.detail}</p>
    </article>
  );
}
