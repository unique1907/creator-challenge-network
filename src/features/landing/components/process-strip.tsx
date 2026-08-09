import { processSteps } from "@/features/landing/data/landing-page";
import { LandingIcon } from "./landing-icons";

export function ProcessStrip() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 pt-12 sm:px-8 lg:px-10">
      <div className="mb-7 max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">How It Works</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-[38px] sm:leading-tight">
          From Business Problem to Verified Settlement
        </h2>
        <p className="mt-2.5 text-[15px] leading-6 text-slate-600">
          Five simple steps from funding to settlement on Arc.
        </p>
      </div>
      <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-lg shadow-slate-200/70 sm:grid-cols-2 lg:grid-cols-5 lg:px-8">
        {processSteps.map((step, index) => (
          <div key={step.label} className="relative">
            <div className="flex items-start gap-3 lg:block">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <LandingIcon name={step.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0 lg:mt-2.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">Step {index + 1}</span>
                <h3 className="mt-2 text-[15px] font-semibold leading-5 text-slate-950">{step.label}</h3>
                <p className="mt-1.5 text-[12px] leading-[1.45] text-slate-600">{step.description}</p>
              </div>
            </div>
            {index < processSteps.length - 1 ? (
              <LandingIcon name="arrow" className="absolute right-4 top-3 hidden h-4 w-4 text-slate-300 lg:block" />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
