import { challenges } from "@/features/challenges/data/challenges";
import type { Challenge } from "@/types/ccn";

export function formatUsdc(amount: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDeadline(date: string) {
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
    case "funded":
      return "border-blue-400/35 bg-blue-400/10 text-blue-100";
    case "reviewing":
      return "border-purple-400/35 bg-purple-400/10 text-purple-100";
  }
}
