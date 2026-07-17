import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creator Challenge Network",
  description:
    "A creator challenge platform for proof-based rewards and Arc testnet USDC settlement with Circle Wallets.",
  metadataBase: new URL("https://creator-challenge-network.vercel.app"),
  openGraph: {
    title: "Creator Challenge Network",
    description:
      "Launch creator challenges, validate submissions, and prepare wallet-native rewards.",
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
      <body>{children}</body>
    </html>
  );
}
