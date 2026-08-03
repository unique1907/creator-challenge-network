"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const appSurface = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const serverRenderedLanding = pathname === "/";

  if (appSurface || serverRenderedLanding) return <>{children}</>;

  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
