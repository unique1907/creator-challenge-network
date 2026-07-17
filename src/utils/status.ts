import type { ValidationItem } from "@/types/ccn";

export function statusLabel(status: ValidationItem["status"]) {
  switch (status) {
    case "ready":
      return "Ready";
    case "in-progress":
      return "In progress";
    case "planned":
      return "Planned";
  }
}

export function statusClassName(status: ValidationItem["status"]) {
  switch (status) {
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "in-progress":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "planned":
      return "border-stone-200 bg-stone-50 text-stone-700";
  }
}
