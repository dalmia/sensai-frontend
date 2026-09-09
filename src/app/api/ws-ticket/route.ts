import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { mintWsTicket } from "@/lib/server/backendToken";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const courseId = Number(request.nextUrl.searchParams.get("courseId"));
  if (!Number.isInteger(courseId) || courseId <= 0) {
    return NextResponse.json({ detail: "Invalid courseId" }, { status: 400 });
  }

  let ticket: string;
  try {
    ticket = mintWsTicket(userId, courseId);
  } catch (error) {
    console.error("Cannot mint websocket ticket:", error);
    return NextResponse.json({ detail: "Server misconfigured" }, { status: 500 });
  }

  // Empty origin means the websocket is served from this same origin, so the
  // client builds the URL from window.location and the backend host stays private.
  return NextResponse.json({
    ticket,
    origin: process.env.WS_PUBLIC_ORIGIN ?? "",
  });
}

export const dynamic = "force-dynamic";
