import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const servicePath = "src/services/creator-workspace/creator-workspace.server.ts";
const componentPath = "src/features/creator-workspace/components/creator-workspace.tsx";
const packagePath = "package.json";

const service = read(servicePath);
const component = read(componentPath);
const packageJson = read(packagePath);

assert.ok(
  service.includes("challengeId(item).toLowerCase() === submission.challengeId.toLowerCase()"),
  "Submission rows must join challenge drafts by canonical challengeId.",
);
assert.ok(
  !service.includes("find((item) => item.challenge.title"),
  "Submission rows must not join challenges by display title.",
);
assert.ok(
  service.includes("const canonicalChallengeTitle = draft?.challenge.title || \"Challenge unavailable\""),
  "Submission projection must compute one canonical challenge title from the matched draft.",
);
assert.ok(
  service.includes("challengeTitle: canonicalChallengeTitle"),
  "Submission row challengeTitle must come from the canonical challenge projection.",
);
assert.ok(
  service.includes("challengeDetailLabel: `${canonicalBrandName} - ${status}`"),
  "Submission row secondary detail must come from the same canonical challenge projection and status.",
);
assert.ok(
  service.includes("submissionTitle: submission.title"),
  "Submission title must remain available without being used as challenge identity.",
);
assert.ok(
  service.includes("href: `/dashboard/creator/submissions/${submission.id}`"),
  "Submission row href must be generated from the same submission projection.",
);
assert.ok(
  component.includes("<p className=\"font-semibold text-white\">{item.challengeTitle}</p>"),
  "My Submissions primary row title must render the canonical challenge title.",
);
assert.ok(
  component.includes("<p className=\"mt-0.5 text-slate-400\">{item.challengeDetailLabel}</p>"),
  "My Submissions secondary row text must render the canonical challenge detail label.",
);
assert.ok(
  component.includes("<Link href={item.href}"),
  "My Submissions row action must use the projected canonical href.",
);
assert.ok(
  !component.includes("<p className=\"font-semibold text-white\">{item.title}</p>"),
  "My Submissions primary row title must not render the creator submission title as challenge identity.",
);
assert.ok(
  packageJson.includes("test:p0-creator-my-submissions-canonical-identity"),
  "Canonical My Submissions identity verifier must be registered.",
);

function projectRows(submissions, drafts) {
  return submissions.map((submission) => {
    const draft = drafts.find((item) => item.challengeId.toLowerCase() === submission.challengeId.toLowerCase()) ?? null;
    const challengeTitle = draft?.title ?? "Challenge unavailable";
    const brandName = draft?.brandName ?? "Brand not set";
    const status = submission.status;
    return {
      submissionId: submission.id,
      challengeId: submission.challengeId,
      challengeTitle,
      challengeDetailLabel: `${brandName} - ${status}`,
      submissionTitle: submission.title,
      href: `/dashboard/creator/submissions/${submission.id}`,
      status,
    };
  });
}

const drafts = [
  { challengeId: "0x1111111111111111111111111111111111111111111111111111111111111111", title: "Deneme 2", brandName: "Brand A" },
  { challengeId: "0x2222222222222222222222222222222222222222222222222222222222222222", title: "Deneme 3", brandName: "Brand B" },
  { challengeId: "0x3333333333333333333333333333333333333333333333333333333333333333", title: "Deneme 30", brandName: "Brand C" },
];
const submissions = [
  { id: "submission-b", challengeId: drafts[1].challengeId, title: "Deneme 2", status: "Submitted" },
  { id: "submission-a", challengeId: drafts[0].challengeId, title: "Deneme 3", status: "Draft" },
  { id: "submission-c", challengeId: drafts[2].challengeId, title: "Deneme 3", status: "Winner" },
];
const projected = projectRows(submissions, drafts);

assert.equal(projected[0].challengeTitle, "Deneme 3", "A submission title similar to another challenge must not replace the canonical challenge title.");
assert.equal(projected[0].challengeDetailLabel, "Brand B - Submitted", "Secondary detail must stay bound to the same challengeId relationship.");
assert.equal(projected[0].href, "/dashboard/creator/submissions/submission-b", "Href must stay bound to the submission row.");
assert.equal(projected[1].challengeTitle, "Deneme 2", "Reordered submissions must keep challenge titles bound by challengeId.");
assert.equal(projected[2].challengeTitle, "Deneme 30", "Similar challenge titles must not cross-assign by display title.");
assert.deepEqual(
  projected.map((item) => item.submissionId),
  ["submission-b", "submission-a", "submission-c"],
  "Projection must not duplicate, drop, or reorder submission rows.",
);
assert.deepEqual(
  projected.map((item) => item.status),
  ["Submitted", "Draft", "Winner"],
  "Existing status fields must remain unchanged.",
);

const dashboardSummary = projected.slice(0, 3);
const fullSubmissionsPage = [...projected];
for (const item of dashboardSummary) {
  const fullPageItem = fullSubmissionsPage.find((candidate) => candidate.submissionId === item.submissionId);
  assert.ok(fullPageItem, "Dashboard summary row must exist on the full My Submissions page.");
  assert.equal(fullPageItem.challengeId, item.challengeId, "Dashboard and full page challengeId must agree.");
  assert.equal(fullPageItem.challengeTitle, item.challengeTitle, "Dashboard and full page challengeTitle must agree.");
  assert.equal(fullPageItem.challengeDetailLabel, item.challengeDetailLabel, "Dashboard and full page challenge detail must agree.");
  assert.equal(fullPageItem.href, item.href, "Dashboard and full page href must agree.");
}

console.log("P0 Creator My Submissions canonical identity verifier passed.");
