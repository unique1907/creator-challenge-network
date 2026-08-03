import { testnetMetrics } from "@/features/landing/data/landing-page";
import { LandingIcon } from "./landing-icons";

export function LandingMetrics() {
  return (
    <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-6 sm:px-8 lg:px-10" aria-label="Platform and testnet metrics">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl shadow-slate-950/15">
        <div className="grid gap-4 md:grid-cols-4">
          {testnetMetrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 md:border-0 md:bg-transparent md:px-3"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <LandingIcon name={metric.icon} className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xl font-black tracking-tight">{metric.value}</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{metric.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{metric.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
