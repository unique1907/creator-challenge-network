import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creator Challenge Network",
  description:
    "A creative competition platform where brands fund challenges and reward one winning submission with USDC secured on Arc.",
  metadataBase: new URL("https://creator-challenge-network.vercel.app"),
  openGraph: {
    title: "Creator Challenge Network",
    description:
      "Funded creative competitions, blind brand review, and Arc-secured USDC rewards.",
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
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
