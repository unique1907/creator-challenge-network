"use client";

import { createChallengeSteps } from "@/features/create-challenge/data/demo-draft";
import { useCreateChallengeDraft } from "@/features/create-challenge/state/create-challenge-context";

export function WizardSidebar() {
  const { state, setCurrentStep } = useCreateChallengeDraft();

  return (
    <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Create Challenge
      </p>
      <div className="mt-4 space-y-2">
        {createChallengeSteps.map((step, index) => {
          const isActive = step.id === state.deployment.currentStep;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setCurrentStep(step.id)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-200 ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-bold">
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-bold">{step.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">
                  {step.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
