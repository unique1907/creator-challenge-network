import type { CreateChallengeStep } from "@/types/create-challenge";
import { StatusBadge } from "./status-badge";

type WizardStepHeaderProps = {
  step: CreateChallengeStep;
};

export function WizardStepHeader({ step }: WizardStepHeaderProps) {
  return (
    <div>
      <StatusBadge tone="demo">Demo foundation</StatusBadge>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
        {step.label}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        {step.description}
      </p>
    </div>
  );
}
