type IconProps = {
  name:
    | "wallet"
    | "arc"
    | "usdc"
    | "blind"
    | "send"
    | "brand"
    | "lock"
    | "creators"
    | "payout"
    | "arrow"
    | "clock"
    | "submissions"
    | "trophy";
  className?: string;
};

export function LandingIcon({ name, className = "h-5 w-5" }: IconProps) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  switch (name) {
    case "wallet":
      return (
        <svg {...common}>
          <path d="M4 7.5h13.5A2.5 2.5 0 0 1 20 10v7.5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4H18" />
          <path d="M16.5 13h3.5" />
          <path d="M16 13.05v-.1" />
        </svg>
      );
    case "arc":
      return (
        <svg {...common}>
          <path d="m12 3 9 17H3L12 3Z" />
          <path d="m12 8 4.8 9H7.2L12 8Z" />
        </svg>
      );
    case "usdc":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v10" />
          <path d="M15 9.2c-.8-.9-4.4-1.1-4.4 1.1 0 2.5 4.8 1 4.8 3.5 0 2.2-3.6 2-4.8 1" />
        </svg>
      );
    case "blind":
      return (
        <svg {...common}>
          <path d="M3 3l18 18" />
          <path d="M10.7 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 5 9 7-.3 1.1-1.4 2.8-3.1 4.2" />
          <path d="M6.4 6.7C4.5 8.1 3.4 10.2 3 12c.5 2 4 7 9 7 1.7 0 3.2-.6 4.4-1.4" />
          <path d="M9.7 9.7a3.3 3.3 0 0 0 4.6 4.6" />
        </svg>
      );
    case "send":
      return (
        <svg {...common}>
          <path d="m21 3-7.5 18-3-7.5L3 10.5 21 3Z" />
          <path d="m10.5 13.5 4-4" />
        </svg>
      );
    case "brand":
      return (
        <svg {...common}>
          <path d="M4 20h16" />
          <path d="M6 20V9l6-4 6 4v11" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "creators":
      return (
        <svg {...common}>
          <path d="M16 19c0-2-1.7-3.5-4-3.5S8 17 8 19" />
          <circle cx="12" cy="9" r="3" />
          <path d="M20 18c-.2-1.7-1.4-3-3-3.5" />
          <path d="M4 18c.2-1.7 1.4-3 3-3.5" />
        </svg>
      );
    case "payout":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8" />
          <path d="M9.6 14.5c.9.8 4.8.9 4.8-1.1 0-2.2-4.6-.9-4.6-3.1 0-1.8 3.1-1.7 4.2-.9" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case "submissions":
      return (
        <svg {...common}>
          <path d="M17 19c0-2-2-3.5-5-3.5S7 17 7 19" />
          <circle cx="12" cy="9" r="3" />
          <path d="M20 18c-.2-1.5-1.1-2.7-2.5-3.2" />
          <path d="M4 18c.2-1.5 1.1-2.7 2.5-3.2" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
          <path d="M8 6H5a3 3 0 0 0 3 3" />
          <path d="M16 6h3a3 3 0 0 1-3 3" />
          <path d="M12 13v4" />
          <path d="M9 20h6" />
        </svg>
      );
  }
}
