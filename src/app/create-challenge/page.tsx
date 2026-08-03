import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ARC_TESTNET_CHAIN_ID,
  getCreateChallengeDeadlinePolicy,
} from "@/config/create-challenge-deadline-policy";
import { CreateChallengeWizard } from "@/features/create-challenge";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";

export const metadata: Metadata = {
  title: "Create Challenge | Creator Challenge Network",
  description:
    "Create a funded creative competition with test USDC secured on Arc Testnet.",
};

type CreateChallengePageSearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CreateChallengePage({ searchParams }: { searchParams?: CreateChallengePageSearchParams }) {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) {
    return (
      <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0c1222] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Create Challenge</p>
          <h1 className="mt-3 text-3xl font-semibold">Brand access required</h1>
          <p className="mt-3 text-slate-300">This CCN account cannot create Brand campaigns.</p>
        </div>
      </main>
    );
  }
  if (!context.brandOnboardingComplete) redirect("/auth/onboarding/brand");
  const params = (await searchParams) ?? {};
  const mode = firstSearchValue(params.mode);
  const draftId = firstSearchValue(params.draftId);
  const entryMode = mode === "smoke" ? "smoke" : firstSearchValue(params.new) === "1" ? "new" : draftId ? "existing" : "idle";
  const initialDeadlinePolicy = getCreateChallengeDeadlinePolicy({
    runtimeBlockchain: "ARC-TESTNET",
    chainId: ARC_TESTNET_CHAIN_ID,
    isSmokeTestChallenge: entryMode === "smoke",
  });
  return (
    <CreateChallengeWizard
      appId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? ""}
      entryMode={entryMode}
      initialDeadlinePolicy={initialDeadlinePolicy}
    />
  );
}
