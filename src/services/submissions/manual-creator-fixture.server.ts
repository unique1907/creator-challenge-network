import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import type { CreatorSession } from "@/services/creator-session.server";
import type {
  FundedChallengeRead,
  Submission,
  SubmissionAsset,
  SubmissionDraftInput,
} from "@/types/submission";

const STORE_PATH = join(process.cwd(), ".local", "manual-creator-ux-01-1.json");
const ASSET_DIR = join(process.cwd(), ".local", "manual-creator-assets");
const FIXTURE_ID = "manual-creator-ux-01-1";
const FIXTURE_SLUG = "development-manual-creator-fixture";
const FIXTURE_CHALLENGE_ID = "0x1111111111111111111111111111111111111111111111111111111111110111" as `0x${string}`;
const MANUAL_CREATOR_WALLET = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 250 * 1024 * 1024;

type AllowedPolicy = {
  extensions: string[];
  mimePrefixes?: string[];
  mimeTypes?: string[];
  maxBytes: number;
};

const ALLOWED_POLICIES: AllowedPolicy[] = [
  { extensions: [".png", ".jpg", ".jpeg", ".webp"], mimePrefixes: ["image/"], maxBytes: 20 * 1024 * 1024 },
  { extensions: [".mp4", ".mov", ".webm"], mimePrefixes: ["video/"], mimeTypes: ["application/octet-stream"], maxBytes: 200 * 1024 * 1024 },
  { extensions: [".pdf"], mimeTypes: ["application/pdf"], maxBytes: 50 * 1024 * 1024 },
  { extensions: [".ai", ".psd"], mimeTypes: ["application/postscript", "application/octet-stream", "image/vnd.adobe.photoshop"], maxBytes: 50 * 1024 * 1024 },
  { extensions: [".zip"], mimeTypes: ["application/zip", "application/x-zip-compressed", "application/octet-stream"], maxBytes: 50 * 1024 * 1024 },
];

type ManualFixtureStore = {
  fixtureId: string;
  submission: Submission | null;
  uploads: Record<string, SubmissionAsset>;
  finalizeKeys: Record<string, string>;
  resetAt?: string;
};

function enabled() {
  return process.env.NODE_ENV === "development" && process.env.CCN_SMOKE_TEST_MODE === "true";
}

function assertEnabled() {
  if (!enabled()) {
    throw new CircleSpikeError({
      message: "Development manual test fixture is unavailable.",
      status: 404,
    });
  }
}

function emptyStore(): ManualFixtureStore {
  return {
    fixtureId: FIXTURE_ID,
    submission: null,
    uploads: {},
    finalizeKeys: {},
  };
}

async function readStore(): Promise<ManualFixtureStore> {
  assertEnabled();
  try {
    const parsed = JSON.parse(await readFile(STORE_PATH, "utf8")) as Partial<ManualFixtureStore>;
    return parsed.fixtureId === FIXTURE_ID
      ? {
          fixtureId: FIXTURE_ID,
          submission: parsed.submission ?? null,
          uploads: parsed.uploads ?? {},
          finalizeKeys: parsed.finalizeKeys ?? {},
          resetAt: parsed.resetAt,
        }
      : emptyStore();
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: ManualFixtureStore) {
  assertEnabled();
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function futureSeconds(days: number) {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

function challenge(): FundedChallengeRead {
  assertEnabled();
  return {
    challengeId: FIXTURE_CHALLENGE_ID,
    bytecodeExists: false,
    isFunded: false,
    sponsorMatchesBrand: false,
    prizePool: "0",
    platformFee: "0",
    winnerCount: 1,
    prizeDistribution: ["0"],
    submissionDeadline: futureSeconds(7),
    reviewDeadline: futureSeconds(14),
    acceptsSubmissions: true,
    paused: false,
    draftId: FIXTURE_ID,
    fundingIntentId: undefined,
    publicationStatus: "manual-test-only",
    escrowContractAddress: undefined,
    verified: true,
    blockers: [],
  };
}

function extensionOf(filename: string) {
  const clean = filename.replace(/\\/g, "/").split("/").pop() ?? "upload";
  const index = clean.lastIndexOf(".");
  return index >= 0 ? clean.slice(index).toLowerCase() : "";
}

function displayFilename(filename: string) {
  const clean = filename.replace(/\\/g, "/").split("/").pop() ?? "upload";
  return clean.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || "upload";
}

function policyFor(filename: string, mimeType: string) {
  const extension = extensionOf(filename);
  const mime = mimeType || "application/octet-stream";
  const policy = ALLOWED_POLICIES.find(
    (item) =>
      item.extensions.includes(extension) &&
      (item.mimePrefixes?.some((prefix) => mime.startsWith(prefix)) || item.mimeTypes?.includes(mime)),
  );
  if (!policy) {
    throw new CircleSpikeError({
      message: "Unsupported file type. Upload PNG, JPG, WEBP, MP4, MOV, WEBM, PDF, AI, PSD or ZIP files.",
      status: 400,
    });
  }
  return { policy, extension, mime };
}

function normalizeUrl(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new CircleSpikeError({ message: `${label} is required.`, status: 400 });
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("bad protocol");
    }
    return url.toString();
  } catch {
    throw new CircleSpikeError({ message: `${label} must be a valid URL.`, status: 400 });
  }
}

function normalizeLinks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string" && item.trim())
    .slice(0, 1)
    .map((item) => normalizeUrl(item, "Optional supporting link"));
}

function linkAsset(url: string, order: number, primary: boolean): SubmissionAsset {
  return {
    id: randomUUID(),
    type: "LINK",
    displayName: "Project link",
    linkUrl: url,
    reviewUrl: url,
    order,
    primary,
    createdAt: new Date().toISOString(),
  };
}

function normalizeAssetList(value: unknown, linkUrl: string) {
  if (!Array.isArray(value)) return linkUrl ? [linkAsset(linkUrl, 0, true)] : [];
  const now = new Date().toISOString();
  const files = value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new CircleSpikeError({ message: "Uploaded asset metadata is invalid.", status: 400 });
    }
    const asset = item as Partial<SubmissionAsset>;
    if (asset.type !== "FILE" || typeof asset.id !== "string" || typeof asset.storageKey !== "string") {
      throw new CircleSpikeError({ message: "Uploaded asset metadata is invalid.", status: 400 });
    }
    return {
      ...asset,
      type: "FILE",
      displayName: String(asset.displayName ?? "Uploaded file"),
      order: index,
      primary: index === 0 && !linkUrl,
      createdAt: asset.createdAt ?? now,
    } as SubmissionAsset;
  });
  const assets = linkUrl ? [...files, linkAsset(linkUrl, files.length, files.length === 0)] : files;
  if (assets.length === 0) {
    throw new CircleSpikeError({ message: "Add at least one uploaded file or project link.", status: 400 });
  }
  if (assets.length > MAX_FILES) {
    throw new CircleSpikeError({ message: `You can add up to ${MAX_FILES} assets.`, status: 400 });
  }
  const totalBytes = assets.reduce((sum, asset) => sum + (asset.fileSize ?? 0), 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new CircleSpikeError({ message: "Total uploaded file size is too large for this manual test.", status: 400 });
  }
  return assets;
}

function normalizeDraft(input: SubmissionDraftInput) {
  if (typeof input.title !== "string" || !input.title.trim()) {
    throw new CircleSpikeError({ message: "Project title is required.", status: 400 });
  }
  if (typeof input.description !== "string" || !input.description.trim()) {
    throw new CircleSpikeError({ message: "Short description is required.", status: 400 });
  }
  const primaryAssetUrl =
    typeof input.primaryAssetUrl === "string" && input.primaryAssetUrl.trim()
      ? normalizeUrl(input.primaryAssetUrl, "Project link")
      : "";
  const assets = normalizeAssetList(input.assets, primaryAssetUrl);
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    primaryAssetUrl,
    supportingLinks: normalizeLinks(input.supportingLinks),
    assets,
  };
}

export function isManualCreatorFixtureEnabled() {
  return enabled();
}

export function getManualCreatorFixtureUploadLimits() {
  return {
    maxFiles: MAX_FILES,
    maxTotalBytes: MAX_TOTAL_BYTES,
    formats: ["png", "jpg", "jpeg", "webp", "mp4", "mov", "webm", "pdf", "ai", "psd", "zip"],
    perFile: {
      image: "20 MB",
      video: "200 MB",
      documentOrDesign: "50 MB",
      archive: "50 MB",
    },
  };
}

export function getManualCreatorFixtureMeta() {
  assertEnabled();
  return {
    fixtureId: FIXTURE_ID,
    slug: FIXTURE_SLUG,
    title: "Development manual test fixture",
    description: "Local-only Creator UX acceptance fixture. No funding, Circle approval, payout, wallet creation or on-chain action is available.",
  };
}

export async function getManualCreatorFixtureStatus(session: CreatorSession | null) {
  const store = await readStore();
  return {
    fixture: getManualCreatorFixtureMeta(),
    authenticated: Boolean(session),
    session: session
      ? {
          displayName: session.displayName,
          authProvider: session.authProvider,
          testOnly: session.testOnly,
        }
      : null,
    challenge: challenge(),
    submission: session ? store.submission : null,
    uploadLimits: getManualCreatorFixtureUploadLimits(),
    isolation: {
      manualTestOnly: true,
      noFundingIntent: true,
      noCircleOperation: true,
      noPayoutEligibility: true,
      noWinnerFinalization: true,
    },
  };
}

export async function uploadManualCreatorFixtureAsset(file: File) {
  assertEnabled();
  const originalFilename = displayFilename(file.name || "upload");
  if (originalFilename.includes("..")) {
    throw new CircleSpikeError({ message: "Filename is not allowed.", status: 400 });
  }
  const { policy, extension, mime } = policyFor(originalFilename, file.type);
  if (file.size <= 0) {
    throw new CircleSpikeError({ message: "Uploaded file is empty.", status: 400 });
  }
  if (file.size > policy.maxBytes) {
    throw new CircleSpikeError({ message: "Uploaded file is larger than the allowed manual test limit.", status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const id = randomUUID();
  const storageKey = `manual-fixture/${id}${extension}`;
  const diskName = `${id}${extension}`;
  await mkdir(ASSET_DIR, { recursive: true });
  await writeFile(join(ASSET_DIR, diskName), bytes);
  const asset: SubmissionAsset = {
    id,
    type: "FILE",
    displayName: originalFilename,
    originalFilename,
    mimeType: mime,
    extension,
    fileSize: file.size,
    storageKey,
    reviewUrl: `/api/internal/submissions/manual-fixture/assets/${id}`,
    checksum,
    order: 0,
    primary: true,
    createdAt: new Date().toISOString(),
  };
  const store = await readStore();
  if (Object.keys(store.uploads).length >= MAX_FILES) {
    throw new CircleSpikeError({ message: `You can upload up to ${MAX_FILES} files for this manual test.`, status: 400 });
  }
  store.uploads[id] = asset;
  await writeStore(store);
  return { asset, limits: getManualCreatorFixtureUploadLimits() };
}

export async function saveManualCreatorFixtureDraft(session: CreatorSession, draft: SubmissionDraftInput) {
  const store = await readStore();
  if (store.submission?.status === "SUBMITTED") {
    throw new CircleSpikeError({ message: "Submission already finalized.", status: 400 });
  }
  const normalized = normalizeDraft(draft);
  const missingUploads = normalized.assets.filter(
    (asset) => asset.type === "FILE" && (!asset.id || !store.uploads[asset.id]),
  );
  if (missingUploads.length) {
    throw new CircleSpikeError({ message: "Uploaded asset metadata is invalid.", status: 400 });
  }
  const now = new Date().toISOString();
  store.submission = {
    id: store.submission?.id ?? randomUUID(),
    challengeId: FIXTURE_CHALLENGE_ID,
    creatorAccountId: session.ccnAccountId,
    creatorWalletAddress: MANUAL_CREATOR_WALLET,
    anonymousEntryCode: store.submission?.anonymousEntryCode ?? "MANUAL-ENTRY-0001",
    ...normalized,
    status: "DRAFT",
    version: (store.submission?.version ?? 0) + 1,
    updatedAt: now,
  };
  await writeStore(store);
  return getManualCreatorFixtureStatus(session);
}

export async function finalizeManualCreatorFixtureSubmission(session: CreatorSession, idempotencyKey: unknown) {
  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
    throw new CircleSpikeError({ message: "Finalize idempotency key is required.", status: 400 });
  }
  const store = await readStore();
  if (!store.submission) {
    throw new CircleSpikeError({ message: "Create a draft before finalizing a submission.", status: 400 });
  }
  const key = `${session.ccnAccountId}:${FIXTURE_ID}:${idempotencyKey}`;
  if (store.finalizeKeys[key] && store.submission.status === "SUBMITTED") {
    return getManualCreatorFixtureStatus(session);
  }
  const now = new Date().toISOString();
  store.submission.status = "SUBMITTED";
  store.submission.submittedAt = store.submission.submittedAt ?? now;
  store.submission.updatedAt = now;
  store.finalizeKeys[key] = store.submission.id;
  await writeStore(store);
  return getManualCreatorFixtureStatus(session);
}

export async function getManualCreatorFixtureAsset(assetId: string) {
  assertEnabled();
  const store = await readStore();
  const asset = store.uploads[assetId] ?? store.submission?.assets.find((item) => item.id === assetId);
  if (!asset || asset.type !== "FILE" || !asset.storageKey) {
    throw new CircleSpikeError({ message: "Uploaded asset was not found.", status: 404 });
  }
  const diskName = asset.storageKey.replace("manual-fixture/", "");
  if (diskName.includes("..") || diskName.includes("/") || diskName.includes("\\")) {
    throw new CircleSpikeError({ message: "Stored asset reference is invalid.", status: 400 });
  }
  const filePath = join(ASSET_DIR, diskName);
  const fileStat = await stat(filePath);
  return { asset, filePath, size: fileStat.size };
}

export async function resetManualCreatorFixture() {
  assertEnabled();
  await rm(STORE_PATH, { force: true });
  await rm(ASSET_DIR, { recursive: true, force: true });
  const store = emptyStore();
  store.resetAt = new Date().toISOString();
  await writeStore(store);
  return {
    ok: true,
    fixture: getManualCreatorFixtureMeta(),
    cleared: ["manual fixture submission", "manual fixture uploaded assets", "manual fixture finalize keys"],
  };
}
