import type { Challenge } from "@/types/ccn";

export const challenges: Challenge[] = [
  {
    slug: "product-launch-video",
    title: "30-second product launch video",
    brand: "Northstar Hydration",
    category: "Video production",
    rewardUsdc: 2400,
    deadline: "2026-08-12",
    submissions: 42,
    status: "open",
    usageRights:
      "Winner grants 12-month paid social and web usage rights for the final video.",
    escrowStatus: "Arc-funded",
    summary:
      "Create a launch-ready short video for a premium electrolyte drink entering urban fitness channels.",
    brief:
      "Northstar Hydration needs a polished 30-second product launch video that can run across paid social, landing pages, and retail partner screens. The winning entry should feel premium, energetic, and credible without leaning on generic wellness tropes.",
    deliverables: [
      "30-second 16:9 hero video",
      "15-second vertical cutdown",
      "Thumbnail frame and short production note",
    ],
    evaluation: [
      "Creative clarity in the first five seconds",
      "Product visibility and brand fit",
      "Readiness for paid social usage",
    ],
    audience: "Urban runners, boutique gym members, and performance shoppers.",
    accent: "blue",
  },
  {
    slug: "retail-campaign-visual-concept",
    title: "Retail campaign visual concept",
    brand: "Luma & Co.",
    category: "Campaign design",
    rewardUsdc: 1800,
    deadline: "2026-08-19",
    submissions: 27,
    status: "funded",
    usageRights:
      "Winner transfers 6-month digital campaign usage rights for the selected concept.",
    escrowStatus: "Funding locked",
    summary:
      "Design a visual campaign direction for a clean beauty retail launch across window, social, and web placements.",
    brief:
      "Luma & Co. is preparing a seasonal retail push for its refillable skincare line. The brand is seeking a campaign visual concept that can scale from storefront windows to social ads while keeping a premium, low-waste message at the center.",
    deliverables: [
      "Primary campaign key visual",
      "Three placement mockups",
      "Color, type, and art direction notes",
    ],
    evaluation: [
      "Retail shelf impact",
      "Consistency across placements",
      "Originality and usage-rights readiness",
    ],
    audience: "Design-aware beauty shoppers and sustainable retail buyers.",
    accent: "purple",
  },
  {
    slug: "in-store-brand-experience-mockup",
    title: "In-store brand experience mockup",
    brand: "Atlas Roasters",
    category: "Experience design",
    rewardUsdc: 3200,
    deadline: "2026-08-26",
    submissions: 18,
    status: "reviewing",
    usageRights:
      "Winner grants implementation rights for one pilot store and case-study usage.",
    escrowStatus: "Escrow ready",
    summary:
      "Prototype an in-store experience concept for a specialty coffee brand launching a flagship tasting bar.",
    brief:
      "Atlas Roasters wants an in-store concept that makes origin stories, tasting notes, and membership signups feel tactile. The brand will review submissions blindly and select one winning mockup for pilot planning.",
    deliverables: [
      "Experience journey map",
      "Hero zone mockup",
      "Activation mechanics and measurement plan",
    ],
    evaluation: [
      "Customer flow and operational realism",
      "Brand storytelling quality",
      "Feasibility for a flagship pilot",
    ],
    audience: "Specialty coffee customers, retail partners, and membership leads.",
    accent: "teal",
  },
];
