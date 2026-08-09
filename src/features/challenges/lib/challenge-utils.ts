import { challenges } from "@/features/challenges/data/challenges";
import type { Challenge } from "@/types/ccn";

export function formatUsdc(amount: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDeadline(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function getChallengeBySlug(slug: string) {
  return challenges.find((challenge) => challenge.slug === slug);
}

export function accentClassName(accent: Challenge["accent"]) {
  switch (accent) {
    case "blue":
      return "border-blue-400/35 bg-blue-400/10 text-blue-100";
    case "purple":
      return "border-purple-400/35 bg-purple-400/10 text-purple-100";
    case "teal":
      return "border-teal-400/35 bg-teal-400/10 text-teal-100";
  }
}

export function statusClassName(status: Challenge["status"]) {
  switch (status) {
    case "open":
      return "border-emerald-400/35 bg-emerald-400/10 text-emerald-100";
    case "reviewing":
      return "border-purple-400/35 bg-purple-400/10 text-purple-100";
    case "closed":
      return "border-slate-400/35 bg-slate-400/10 text-slate-200";
    case "selection":
      return "border-amber-400/35 bg-amber-400/10 text-amber-100";
    case "settlement":
      return "border-blue-400/35 bg-blue-400/10 text-blue-100";
    case "completed":
      return "border-slate-300/35 bg-slate-300/10 text-slate-100";
  }
}
