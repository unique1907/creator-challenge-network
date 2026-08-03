import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { FinalLandingPage } from "@/features/landing";
import { getPublishedCreateChallenge } from "@/services/create-challenge/published-challenge.server";
import { getLandingAuthState } from "@/services/landing/landing-auth-state.server";

export default async function Home() {
  const [authState, featuredChallenge] = await Promise.all([
    getLandingAuthState(),
    getPublishedCreateChallenge().catch(() => null),
  ]);

  return (
    <>
      <SiteHeader authState={authState} />
      <FinalLandingPage authState={authState} featuredChallenge={featuredChallenge} />
      <SiteFooter />
    </>
  );
}
