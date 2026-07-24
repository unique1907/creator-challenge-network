import Link from "next/link";
import Image from "next/image";

const navItems = [
  { href: "/challenges", label: "Explore Challenges" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/challenges", label: "For Brands" },
  { href: "/challenges", label: "Sign In" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#030a1f]/95 text-white backdrop-blur">
      <div className="mx-auto flex h-[88px] max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="flex items-center rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200"
        >
          <Image
            src="/brand/ccn-logo.png"
            alt="Creator Challenge Network"
            width={154}
            height={48}
            priority
            className="h-12 w-auto object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-11 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-md px-1 py-2 text-sm font-semibold text-white transition hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/create-challenge?new=1"
          className="hidden h-12 items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-950/25 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200 lg:inline-flex"
        >
          Launch a Challenge
        </Link>

        <details className="group relative lg:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-white/15 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-200">
            <span className="sr-only">Open menu</span>
            <span className="block h-0.5 w-5 bg-current before:block before:h-0.5 before:w-5 before:-translate-y-2 before:bg-current after:block after:h-0.5 after:w-5 after:translate-y-1.5 after:bg-current" />
          </summary>
          <div className="absolute right-0 top-14 w-72 rounded-xl border border-white/10 bg-slate-950 p-3 shadow-2xl shadow-black/40">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="block rounded-md px-3 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/create-challenge?new=1"
              className="mt-2 flex h-11 items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              Launch a Challenge
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
