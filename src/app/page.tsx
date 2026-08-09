import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthUrlErrorRedirect } from "@/features/auth/components/auth-url-error-redirect";
import { FinalLandingPage } from "@/features/landing";
import {
  listFeaturedHomepageChallenges,
  listLiveHomepageChallenges,
} from "@/services/create-challenge/published-challenge.server";
import { getLandingAuthState } from "@/services/landing/landing-auth-state.server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<{
    error?: string;
    error_code?: string;
  }>;
};

function authErrorRedirectCode(params?: { error?: string; error_code?: string }) {
  if (!params?.error && !params?.error_code) return null;
  if (params.error_code === "otp_expired") return "callback_expired";
  if (params.error === "access_denied") return "callback";
  return null;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const authError = authErrorRedirectCode(params);
  if (authError) redirect(`/auth/sign-in?error=${encodeURIComponent(authError)}`);

  const currentTimeIso = new Date().toISOString();
  const authState = await getLandingAuthState();
  const [featuredChallengesResult, liveHomepageChallengesResult] = await Promise.allSettled([
    listFeaturedHomepageChallenges(),
    listLiveHomepageChallenges(),
  ]);
  const featuredChallenges = featuredChallengesResult.status === "fulfilled" ? featuredChallengesResult.value : [];
  const liveHomepageChallenges = liveHomepageChallengesResult.status === "fulfilled" ? liveHomepageChallengesResult.value : [];
  const liveHomepageStatus = liveHomepageChallengesResult.status === "fulfilled" ? "ready" : "error";

  if (featuredChallengesResult.status === "rejected") {
    console.error("[ccn-public-homepage] Featured challenge projection failed.", featuredChallengesResult.reason);
  }
  if (liveHomepageChallengesResult.status === "rejected") {
    console.error("[ccn-public-homepage] Live challenge projection failed.", liveHomepageChallengesResult.reason);
  }

  return (
    <>
      <AuthUrlErrorRedirect />
      <SiteHeader authState={authState} />
      <FinalLandingPage
        authState={authState}
        featuredChallenges={featuredChallenges}
        liveHomepageChallenges={liveHomepageChallenges}
        liveHomepageStatus={liveHomepageStatus}
        currentTimeIso={currentTimeIso}
      />
      <SiteFooter />
    </>
  );
}
