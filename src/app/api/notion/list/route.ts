import { NextRequest, NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";

export async function GET(req: NextRequest) {
  // Get token from query param (?token=...) or Authorization header
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) {
    return NextResponse.json({ error: "Missing Notion access token" }, { status: 401 });
  }

  // Helper to call Notion search
  async function notionSearch(objectType: "page" | "database") {
    const res = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { value: objectType, property: "object" },
        page_size: 50,
      }),
    });
    // console.log("res", res);
    if (!res.ok) return [];
    const data = await res.json();
    // console.log("data", data);
    return data.results || [];
  }

  const [pages, databases] = await Promise.all([
    notionSearch("page"),
    notionSearch("database"),
  ]);

  return NextResponse.json({ pages, databases });
} 