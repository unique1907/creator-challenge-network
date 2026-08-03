"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Overview", href: "/dashboard/creator", id: "overview", icon: "home", badge: null },
  { label: "Discover Challenges", href: "/dashboard/creator/discover", id: "discover", icon: "search", badge: null },
  { label: "My Submissions", href: "/dashboard/creator/submissions", id: "submissions", icon: "file", badge: null },
  { label: "Wallet", href: "/dashboard/creator/wallet", id: "wallet", icon: "wallet", badge: null },
  { label: "Notifications", href: "/dashboard/creator/notifications", id: "notifications", icon: "bell", badge: null },
  { label: "Profile", href: "/dashboard/creator/profile", id: "profile", icon: "user", badge: null },
] as const;

function activeNavId(pathname: string) {
  if (pathname.startsWith("/dashboard/creator/discover") || pathname.startsWith("/dashboard/creator/challenges/")) {
    return "discover";
  }
  if (pathname.startsWith("/dashboard/creator/submissions")) return "submissions";
  if (pathname.startsWith("/dashboard/creator/wallet")) return "wallet";
  if (pathname.startsWith("/dashboard/creator/notifications")) return "notifications";
  if (pathname.startsWith("/dashboard/creator/profile")) return "profile";
  return "overview";
}

type NavIconName = (typeof navItems)[number]["icon"];

function NavIcon({ name }: { name: NavIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.8" } as const;
  if (name === "home") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...common}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>;
  }
  if (name === "search") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  }
  if (name === "file") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...common}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></svg>;
  }
  if (name === "wallet") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...common}><path d="M4 7h16v12H4z" /><path d="M16 12h4" /><path d="M7 7V5h10v2" /></svg>;
  }
  if (name === "bell") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

export function CreatorWorkspaceNav() {
  const pathname = usePathname();
  const active = activeNavId(pathname);

  return (
    <nav className="mt-3 grid gap-2 sm:grid-cols-2 lg:block lg:space-y-2" aria-label="Creator workspace navigation">
      {navItems.map((item) => {
        const selected = item.id === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-current={selected ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
              selected
                ? "bg-gradient-to-r from-blue-600 to-violet-700 text-white shadow-lg shadow-violet-950/30"
                : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <span className={`grid h-5 w-5 place-items-center ${selected ? "text-white" : "text-slate-400 group-hover:text-white"}`} aria-hidden="true">
              <NavIcon name={item.icon} />
            </span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
