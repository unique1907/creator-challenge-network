import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, expected, message) {
  assert.ok(read(path).includes(expected), `${message}: missing ${expected}`);
}

function excludes(path, forbidden, message) {
  assert.ok(!read(path).includes(forbidden), `${message}: found ${forbidden}`);
}

function count(path, needle) {
  return read(path).split(needle).length - 1;
}

const page = "src/app/create-challenge/page.tsx";
const wizard = "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx";
const loading = "src/app/create-challenge/loading.tsx";
const dashboard = "src/features/dashboard/components/brand-dashboard.tsx";
const campaigns = "src/app/dashboard/campaigns/page.tsx";
const wallet = "src/app/dashboard/wallet/page.tsx";
const footer = "src/components/layout/site-footer.tsx";
const success = "src/features/create-challenge/components/create-challenge-success-placeholder.tsx";
const route = "src/app/api/create-challenge/draft/route.ts";
const pkg = "package.json";

includes(page, "searchParams", "create challenge page must inspect the explicit entry query");
includes(page, 'firstSearchValue(params.new) === "1" ? "new"', "new=1 must select new entry mode");
includes(page, 'mode === "smoke" ? "smoke"', "mode=smoke must select smoke entry mode");
includes(page, "draftId ? \"existing\" : \"idle\"", "draftId must select existing entry mode");
includes(page, "entryMode={entryMode}", "entry mode must be passed to the wizard");

includes(wizard, "demoCreateChallengeDraft", "new entry shell must use the canonical demo draft template");
includes(wizard, "function immediateDraftForEntry", "wizard must create an immediate shell for new/smoke entries");
includes(wizard, "entryMode !== \"new\" && entryMode !== \"smoke\"", "immediate shell must be limited to explicit new/smoke entries");
includes(wizard, 'useState<CreateChallengeDraftState | null>(() => immediateDraftForEntry(entryMode))', "wizard must render the edit shell before the server draft returns");
includes(wizard, 'entryMode === "new" || entryMode === "smoke" ? "Preparing draft..." : "Loading saved draft..."', "new/smoke entry must not start with the saved-draft recovery copy");
includes(wizard, "const rendersImmediateShell = shouldCreateNew || shouldCreateSmoke", "init must distinguish immediate shell entries from restore entries");
includes(wizard, 'const [pending, setPending] = useState(entryMode === "new" || entryMode === "smoke");', "actions must be locked while canonical draft creation is pending");
includes(wizard, "const initialDraftRequests = new Map<string, Promise<DraftResponse>>();", "new/smoke draft creation must share one in-flight request");
includes(wizard, "function requestInitialDraft(url: string, cacheRequest: boolean)", "wizard must use an initial draft request guard");
includes(wizard, "const existing = initialDraftRequests.get(url);", "duplicate new/smoke initialization must reuse the in-flight request");
includes(wizard, "requestInitialDraft(initialUrl, rendersImmediateShell)", "init effect must call the guarded initial draft request");
includes(wizard, "rendersImmediateShell ? payload.draft : mergeInitializedDraft(current, payload.draft)", "explicit new/smoke entries must adopt the canonical fresh server draft without merging old wizard state");
includes(wizard, "current.challenge.title", "existing draft restore merge helper must remain available for non-immediate initialization");
includes(wizard, "current.prizePool", "existing draft restore merge helper must preserve editable fields when used");
includes(wizard, "if (!rendersImmediateShell) {\n          setStep(payload.draft.deployment.currentStep);", "existing draft restore must keep using the saved step");
includes(wizard, "/create-challenge?draftId=", "successful creation must replace the URL with the canonical draft id");
includes(wizard, "const draftReadyForActions = Boolean(draft?.challenge.id ?? draftId);", "actions must depend on canonical draft identity");
includes(wizard, "!draftReadyForActions", "save/continue must remain disabled until canonical draft identity exists");
includes(wizard, "Start a Business Challenge", "recovery screen must remain available for idle/manual recovery paths");
includes(route, 'url.searchParams.get("new") === "1"', "new draft API route must remain explicit");
includes(route, "createNewCreateChallengeDraft({", "new draft route must create exactly through the canonical store path");
includes(route, "ccnAccountId: context.ccnAccountId", "new draft route must keep owner-scoped account id");
includes(route, "brandName: context.brandName", "new draft route may autofill brand name from canonical Brand/company identity");
excludes(route, "brandName: context.brandName ?? context.displayName", "new draft route must not fall back to personal display name as Brand identity");
includes(wizard, 'href="/create-challenge?new=1"', "published success state Create Another Challenge CTA must use the canonical explicit new route");
includes(wizard, "Create Another Challenge", "published success state must keep the Create Another Challenge CTA");

includes(loading, "Brand flow", "route transition loading state must show the Brand Flow shell");
includes(loading, "Challenge Details", "route transition loading state must show the Challenge Details shell");
includes(loading, "Preparing draft...", "route transition loading state must use new-draft preparation copy");
excludes(loading, "Loading saved draft", "route transition loading state must not show saved-draft recovery copy");
excludes(loading, "Start a Business Challenge", "route transition loading state must not show recovery action");

assert.equal(
  count(wizard, "const draftInitializationPending = Boolean(draft && !draft.challenge.id);"),
  1,
  "top-level draft initialization guard must be declared once",
);
excludes(wizard, "const draftInitializationPending = Boolean(draft && !draft.challenge.id);\n  const draftReadyForActions = Boolean(draft?.challenge.id ?? draftId);\n  const draftInitializationPending", "draft initialization guard must not be duplicated");
excludes(wizard, "`r`n", "wizard must not contain malformed literal newline markers");

includes(dashboard, 'const NEW_DRAFT_HREF = "/create-challenge?new=1";', "dashboard new draft route must use the canonical explicit new entry");
includes(dashboard, "fallback.href || NEW_DRAFT_HREF", "dashboard fallback CTA must route to a new draft");
includes(campaigns, 'href="/create-challenge?new=1" prefetch', "campaigns New Challenge CTA must use explicit prefetched new entry");
includes(wallet, 'href="/create-challenge?new=1" prefetch', "wallet workspace CTA must use explicit prefetched new entry");
includes(footer, 'href: "/create-challenge?new=1"', "site footer launch CTA must use explicit new entry");
includes(success, 'href="/create-challenge?new=1"\n          prefetch', "success placeholder CTA must use explicit prefetched new entry");
includes(pkg, '"test:p0-new-challenge-entry"', "package must expose the P0 new challenge entry verifier");

console.log(JSON.stringify({
  result: "P0 new challenge entry verification passed",
  immediateShellForNewEntry: true,
  recoveryScreenPreserved: true,
  canonicalDraftCreationPreserved: true,
  urlReplacePreserved: true,
  noDuplicateGuardDeclarations: true,
}, null, 2));
