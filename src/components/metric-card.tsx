import type { PlatformStat } from "@/types/ccn";

type MetricCardProps = {
  stat: PlatformStat;
};

export function MetricCard({ stat }: MetricCardProps) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-stone-500">{stat.label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
        {stat.value}
      </p>
      <p className="mt-3 text-sm leading-6 text-stone-600">{stat.detail}</p>
    </article>
  );
}
