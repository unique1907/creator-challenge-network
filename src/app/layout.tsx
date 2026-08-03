import type { Metadata } from "next";
import { AppChrome } from "@/components/layout/app-chrome";
import { getPublicSiteOrigin } from "@/config/site-url";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creator Challenge Network",
  description:
    "Programmable creative competitions where brands fund challenges, creators submit anonymously, and winners receive USDC payouts on Arc.",
  metadataBase: new URL(getPublicSiteOrigin()),
  openGraph: {
    title: "Creator Challenge Network",
    description:
      "Funded creative competitions, blind brand review, and programmable USDC payouts on Arc.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
