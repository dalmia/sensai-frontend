import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || req.headers.get("authorization")?.replace(/^Bearer /, "");
  const pageId = searchParams.get("pageId");
  
  if (!token) {
    return NextResponse.json({ error: "Missing Integration access token" }, { status: 401 });
  }
  
  if (!pageId) {
    return NextResponse.json({ error: "Missing page ID" }, { status: 400 });
  }

  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch page" }, { status: response.status });
  }

  const page = await response.json();
  return NextResponse.json({ page });
} 