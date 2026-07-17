import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 text-sm sm:px-8 md:grid-cols-[1fr_auto] lg:px-10">
        <div>
          <p className="font-semibold text-white">Creator Challenge Network</p>
          <p className="mt-2 max-w-xl leading-6">
            A DeFi / Programmable Money track prototype for funded creative
            competitions, blind brand review, and Arc-secured USDC rewards.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/challenges" className="transition hover:text-white">
            Challenges
          </Link>
          <a
            href="https://github.com/unique1907/creator-challenge-network"
            className="transition hover:text-white"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
