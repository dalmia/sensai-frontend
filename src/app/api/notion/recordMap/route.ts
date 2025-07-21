import { NextRequest, NextResponse } from 'next/server';
import { NotionAPI } from 'notion-client';

export async function POST(req: NextRequest) {
  try {
    const { pageId, token } = await req.json();
    if (!pageId) {
      return NextResponse.json({ error: 'Missing pageId' }, { status: 400 });
    }
    const notion = new NotionAPI();
    console.log("pageId", pageId);
    console.log("token", token);
    const recordMap = await notion.getPage(pageId);
    console.log("recordMap", recordMap);
    return NextResponse.json({ recordMap });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
} 