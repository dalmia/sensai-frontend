import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
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
      external_account: {
        type: 'user',
        key: 'default',
        name: 'User Account'
      },
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const data = await tokenRes.json();
  const redirectUrl = `${state}&access_token=${encodeURIComponent(data.access_token)}`;

  return NextResponse.redirect(redirectUrl);
}