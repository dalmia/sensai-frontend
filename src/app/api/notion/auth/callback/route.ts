import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
  const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
  const NOTION_REDIRECT_URI = process.env.NOTION_REDIRECT_URI;

  console.log("NOTION_CLIENT_ID", NOTION_CLIENT_ID);
  console.log("NOTION_CLIENT_SECRET", NOTION_CLIENT_SECRET);
  console.log("NOTION_REDIRECT_URI", NOTION_REDIRECT_URI);

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
      redirect_uri: process.env.NOTION_REDIRECT_URI,
      external_account: {
        type: 'user',
        key: 'default',
        name: 'User Account'
      },
    }),
  });

  console.log("tokenRes", tokenRes);

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const data = await tokenRes.json();
  // For demo: redirect to /notion with token in query (in production, use cookies/session)
  const baseUrl = req.nextUrl.origin;
  return NextResponse.redirect(`${baseUrl}/notion?token=${encodeURIComponent(data.access_token)}`);
}