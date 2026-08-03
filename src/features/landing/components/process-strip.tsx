import { processSteps } from "@/features/landing/data/landing-page";
import { LandingIcon } from "./landing-icons";

export function ProcessStrip() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 pt-16 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">How CCN works</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          One funded challenge, one blind review path, one verified payout.
        </h2>
        <p className="mt-3 text-base leading-7 text-slate-600">
          CCN keeps the creative workflow simple while preserving the financial guarantees the jury will inspect.
        </p>
      </div>
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/70 lg:grid-cols-5">
        {processSteps.map((step, index) => (
          <div key={step.label} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4 lg:border-0 lg:bg-transparent">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <LandingIcon name={step.icon} className="h-5 w-5" />
              </span>
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Step {index + 1}</span>
            </div>
            <h3 className="mt-4 text-sm font-black text-slate-950">{step.label}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-600">{step.description}</p>
            {index < processSteps.length - 1 ? (
              <LandingIcon name="arrow" className="absolute right-3 top-7 hidden h-4 w-4 text-slate-300 lg:block" />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
