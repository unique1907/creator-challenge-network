import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getManualCreatorFixtureAsset } from "@/services/submissions/manual-creator-fixture.server";
import { requireInternalDevelopmentRoute, safeRouteError } from "../../../../circle/_utils";

type AssetRouteProps = {
  params: Promise<{ assetId: string }>;
};

export async function GET(_request: Request, { params }: AssetRouteProps) {
  const blocked = requireInternalDevelopmentRoute();
  if (blocked) return blocked;

  try {
    const { assetId } = await params;
    const { asset, filePath } = await getManualCreatorFixtureAsset(assetId);
    const bytes = await readFile(filePath);
    return new NextResponse(bytes, {
      headers: {
        "content-type": asset.mimeType ?? "application/octet-stream",
        "content-disposition": `attachment; filename="${asset.displayName.replace(/"/g, "_")}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return safeRouteError(error);
  }
}
