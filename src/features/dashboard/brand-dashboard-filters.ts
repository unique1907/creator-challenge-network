import type { BrandDashboardCampaignRow } from "@/features/dashboard/brand-dashboard-view-model";

export type BrandDashboardFilter =
  | "All"
  | "Drafts"
  | "Active"
  | "Needs Action"
  | "Completed";

export const brandDashboardFilters: BrandDashboardFilter[] = [
  "All",
  "Drafts",
  "Active",
  "Needs Action",
  "Completed",
];

const legacyFilterAliases: Record<string, BrandDashboardFilter> = {
  "problem-draft": "Drafts",
  funding: "Active",
  "open-for-solutions": "Active",
  evaluation: "Needs Action",
  selection: "Needs Action",
  settlement: "Needs Action",
};

export function filterSlug(filter: BrandDashboardFilter) {
  return filter.toLowerCase().replace(/\s+/g, "-");
}

export function normalizeBrandDashboardFilter(value?: string): BrandDashboardFilter {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "All";
  const match = brandDashboardFilters.find((filter) => filterSlug(filter) === normalized || filter.toLowerCase() === normalized);
  return match ?? legacyFilterAliases[normalized] ?? "All";
}

export function brandDashboardFilterMatches(row: BrandDashboardCampaignRow, filter: BrandDashboardFilter) {
  if (filter === "All") return true;
  return row.bucket === filter;
}
