import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/challenges", label: "Challenges" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/88 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-sm font-bold text-cyan-100">
            CCN
          </span>
          <span className="hidden text-sm font-semibold uppercase tracking-[0.16em] text-white sm:inline">
            Creator Challenge Network
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
