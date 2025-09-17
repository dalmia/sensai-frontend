import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors or cancellation by redirecting back to state
  if (error || !code) {
    if (state) {
      const redirectUrl = error ? `${state}&error=${encodeURIComponent(error)}` : `${state}&error=access_denied`;
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.json({ error: "Missing code and no state to redirect to" }, { status: 400 });
  }

  const basicAuth = Buffer.from(
    `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    // If token request fails, redirect back to state
    if (state) {
      return NextResponse.redirect(state);
    }
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const data = await tokenRes.json();
  const redirectUrl = `${state}&access_token=${encodeURIComponent(data.access_token)}`;

  return NextResponse.redirect(redirectUrl);
}