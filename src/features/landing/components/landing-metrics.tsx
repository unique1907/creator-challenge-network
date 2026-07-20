import { testnetMetrics } from "@/features/landing/data/landing-page";
import { LandingIcon } from "./landing-icons";

export function LandingMetrics() {
  return (
    <section className="relative z-10 mx-auto -mt-12 max-w-7xl px-6 sm:px-8 lg:px-10">
      <div className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl shadow-slate-950/15 md:grid-cols-4">
        {testnetMetrics.map((metric, index) => (
          <div
            key={metric.label}
            className="flex items-center gap-4 md:border-r md:border-slate-200 md:pr-5 md:last:border-r-0"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
              <LandingIcon name={metric.icon} className="h-8 w-8" />
            </span>
            <div>
              <p className="text-2xl font-bold tracking-tight">{metric.value}</p>
              <p className="mt-1 text-sm font-semibold">{metric.label}</p>
              <p className="text-xs text-slate-600">{metric.detail}</p>
              {index < 3 ? (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Demo metric
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
