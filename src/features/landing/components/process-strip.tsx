import { processSteps } from "@/features/landing/data/landing-page";
import { LandingIcon } from "./landing-icons";

export function ProcessStrip() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 pt-7 sm:px-8 lg:px-10">
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60 lg:grid-cols-5">
        {processSteps.map((step, index) => (
          <div key={step.label} className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <LandingIcon name={step.icon} className="h-6 w-6" />
            </span>
            <span className="absolute left-9 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-800">
              {index + 1}
            </span>
            <p className="max-w-28 text-sm font-medium leading-5 text-slate-950">
              {step.label}
            </p>
            {index < processSteps.length - 1 ? (
              <LandingIcon
                name="arrow"
                className="ml-auto hidden h-5 w-5 text-slate-300 lg:block"
              />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
