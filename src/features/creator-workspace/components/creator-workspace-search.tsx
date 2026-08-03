"use client";

import { useSearchParams } from "next/navigation";

export function CreatorWorkspaceSearch() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  return (
    <form action="/dashboard/creator/discover" role="search" className="relative">
      <label htmlFor="creator-workspace-search" className="sr-only">
        Search challenges, brands, categories
      </label>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        id="creator-workspace-search"
        name="q"
        type="search"
        defaultValue={query}
        placeholder="Search challenges, brands, categories..."
        className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-violet-300/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-400/20"
      />
    </form>
  );
}