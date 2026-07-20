import { NextResponse } from "next/server";
import {
  getSpikeAccessCookieValue,
  isSpikeAllowedInEnvironment,
  SPIKE_ACCESS_COOKIE,
  validateSpikeAccessKey,
} from "@/services/internal-spike-auth.server";

export async function POST(request: Request) {
  if (!isSpikeAllowedInEnvironment()) {
    return NextResponse.json(
      { error: "Internal spike is disabled outside development." },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    accessKey?: unknown;
  };

  if (!validateSpikeAccessKey(body.accessKey)) {
    return NextResponse.json({ error: "Invalid access key." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SPIKE_ACCESS_COOKIE,
    value: await getSpikeAccessCookieValue(),
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SPIKE_ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 0,
  });
  return response;
}
