import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { remainingDeadlineDurationLabel } from "../src/features/landing/lib/deadline-countdown.ts";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function excludes(source, needle, message) {
  assert.equal(source.includes(needle), false, message);
}

const page = read("src/app/page.tsx");
const landing = read("src/features/landing/components/final-landing-page.tsx");
const card = read("src/features/landing/components/landing-challenge-card.tsx");
const countdown = read("src/features/landing/components/deadline-countdown.tsx");
const countdownUtil = read("src/features/landing/lib/deadline-countdown.ts");
const projection = read("src/services/create-challenge/published-challenge.server.ts");
const deadlineUtils = read("src/utils/challenge-deadlines.ts");

includes(projection, "const submissionDeadline = parseChallengeDeadline(draft.reviewRules.submissionDeadline)", "Public projection must parse the canonical submission deadline.");
includes(projection, "deadline: submissionDeadline?.iso ?? draft.reviewRules.submissionDeadline", "Public projection must expose the canonical UTC submission deadline without date-only truncation.");
excludes(projection, "deadline: submissionDeadline?.iso.slice(0, 10)", "Public projection must not truncate the canonical submission deadline to a date.");
excludes(projection, "deadline: draft.reviewRules.reviewDeadline", "Public projection deadline must not use review deadline.");
excludes(projection, "createdAt", "Public countdown source must not be creation time.");
includes(projection, "Date.now() >= submissionDeadline.unix * 1000", "Expired challenge exclusion must remain based on canonical submission deadline.");
includes(projection, "!challenge.submissionClosed", "Expired challenges must remain excluded from the Live grid.");

includes(page, "const currentTimeIso = new Date().toISOString();", "Homepage must provide a stable server current time for initial countdown render.");
includes(page, "currentTimeIso={currentTimeIso}", "Homepage must pass server current time to the landing component.");
includes(landing, "currentTimeIso: string", "Landing component must require server current time.");
includes(card, '<DeadlineCountdown deadline={challenge.deadline} initialNowIso={currentTimeIso} />', "Live card countdown must use the canonical public deadline field.");
excludes(card, "Date.now()", "Live card must not compute countdown from browser-only time during render.");
excludes(card, "T23:59:59Z", "Live card must not inflate a date-only deadline to end-of-day.");

includes(countdown, '"use client"', "Countdown updater must be isolated to a client component.");
includes(countdown, "useState(initialNowIso)", "Client countdown first render must match the server-provided time.");
includes(countdown, "60000", "Countdown must update once per minute, not every second.");
excludes(countdown, "1000", "Countdown must not update every second.");
includes(countdownUtil, "deadlineMs - nowMs", "Countdown must calculate deadline minus current time.");
includes(countdownUtil, "Math.floor(remainingMs / 60000)", "Countdown must floor completed minutes.");
includes(countdownUtil, "padStart(2, \"0\")", "Minutes must be zero-padded when hours are shown.");
excludes(countdownUtil, "Math.ceil", "Countdown must not round up remaining minutes.");
excludes(countdownUtil, "minimumSubmissionLeadMinutes", "Countdown must not add smoke schedule duration separately.");

includes(deadlineUtils, "parseChallengeDeadline", "Canonical deadline parser must remain available.");
includes(deadlineUtils, "hasExplicitTimezone", "UTC timestamps must be parsed with explicit timezone awareness.");
includes(deadlineUtils, "LEGACY_FLOATING_TIMEZONE_OFFSET_MINUTES", "Legacy offset handling must remain centralized in the deadline utility.");

assert.equal(
  remainingDeadlineDurationLabel("2026-08-14T08:20:42.000Z", "2026-08-07T00:00:00.000Z"),
  "7d 8h 20m",
  "7 days, 8 hours, 20 minutes, 42 seconds must render as 7d 8h 20m",
);
assert.equal(
  remainingDeadlineDurationLabel("2026-08-07T11:20:42.000Z", "2026-08-07T00:00:00.000Z"),
  "11h 20m",
  "Less than one day must render hours and minutes.",
);
assert.equal(
  remainingDeadlineDurationLabel("2026-08-07T02:05:42.000Z", "2026-08-07T00:00:00.000Z"),
  "2h 05m",
  "Minutes must be zero-padded when hours are present.",
);
assert.equal(
  remainingDeadlineDurationLabel("2026-08-07T00:45:42.000Z", "2026-08-07T00:00:00.000Z"),
  "45m",
  "Less than one hour must render minutes only.",
);
assert.equal(
  remainingDeadlineDurationLabel("2026-08-07T00:00:00.000Z", "2026-08-07T00:01:00.000Z"),
  null,
  "Expired deadlines must not render negative countdown values.",
);

for (const preserved of [
  "formatUsdc(challenge.rewardUsdc)",
  "solutionLabel(challenge.submissions)",
  "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
  "max-h-[120px]",
  "aspect-[16/7]",
  "p-3.5",
]) {
  includes(`${card}\n${landing}`, preserved, `Card layout/data behavior must remain unchanged: ${preserved}`);
}

console.log("P0 public homepage real deadline countdown verifier passed.");
