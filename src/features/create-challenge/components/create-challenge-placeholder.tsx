"use client";

import { CCNLogo } from "@/components/ui/ccn-logo";
import { createChallengeSteps } from "@/features/create-challenge/data/demo-draft";
import { CreateChallengeProvider, useCreateChallengeDraft } from "@/features/create-challenge/state/create-challenge-context";
import { ChallengeLivePreview } from "./challenge-live-preview";
import { NetworkStatusCard } from "./network-status-card";
import { StatusBadge } from "./status-badge";
import { WizardFooterActions } from "./wizard-footer-actions";
import { WizardShell } from "./wizard-shell";
import { WizardStepHeader } from "./wizard-step-header";

function CreateChallengePlaceholderContent() {
  const { state } = useCreateChallengeDraft();
  const currentStep =
    createChallengeSteps.find((step) => step.id === state.deployment.currentStep) ??
    createChallengeSteps[0];

  return (
    <WizardShell>
      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <div>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="relative h-12 w-44 overflow-hidden rounded-md border border-white/10 bg-black">
              <div className="grid h-full place-items-center">
                <CCNLogo size="lg" priority />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="demo">Demo draft</StatusBadge>
              <StatusBadge tone="testnet">Arc Testnet</StatusBadge>
            </div>
          </div>

          <WizardStepHeader step={currentStep} />

          <div className="mt-8 rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-6">
            <h2 className="text-lg font-bold text-white">
              Create Challenge flow foundation
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              The final form UI is intentionally not implemented yet. This shell
              prepares typed state, step navigation, demo data, and reusable
              primitives for the upcoming Create Challenge wizard.
            </p>
          </div>

          <div className="mt-8">
            <WizardFooterActions primaryLabel="Final UI pending" />
          </div>
        </div>

        <div className="space-y-5">
          <ChallengeLivePreview draft={state} />
          <NetworkStatusCard funding={state.funding} />
        </div>
      </div>
    </WizardShell>
  );
}

export function CreateChallengePlaceholder() {
  return (
    <CreateChallengeProvider>
      <CreateChallengePlaceholderContent />
    </CreateChallengeProvider>
  );
}
