import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) {
    return NextResponse.json({ error: "Missing Integration access token" }, { status: 401 });
  }

  const response = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: { value: "page", property: "object" },
      page_size: 50,
    }),
  });

  let pages = [];
  if (response.ok) {
    const data = await response.json();
    pages = data.results || [];
  }

  return NextResponse.json({ pages });
} 