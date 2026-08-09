/* eslint-disable @next/next/no-img-element */
import { testnetMetrics } from "@/features/landing/data/landing-page";
import { LandingIcon } from "./landing-icons";

export function LandingMetrics() {
  return (
    <section className="relative z-10 mx-auto -mt-6 max-w-7xl px-6 sm:px-8 lg:px-10" aria-label="Platform and testnet metrics">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-xl shadow-slate-950/10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {testnetMetrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`flex items-start gap-3 rounded-lg bg-slate-50/70 px-3 py-3 sm:min-h-[104px] lg:rounded-none lg:bg-transparent lg:py-2.5 lg:pr-5 ${index > 0 ? "lg:border-l lg:border-slate-200/80 lg:pl-6" : ""}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                {metric.logoSrc ? (
                  <img src={metric.logoSrc} alt={metric.logoAlt ?? `${metric.value} logo`} className="h-7 w-7 object-contain" />
                ) : (
                  <LandingIcon name={metric.icon} className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[17px] font-semibold leading-5 tracking-tight">{metric.value}</p>
                <p className="mt-0.5 text-[12.5px] font-semibold leading-4 text-slate-700">{metric.label}</p>
                <p className="mt-1 text-[12px] leading-[1.45] text-slate-500">{metric.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
