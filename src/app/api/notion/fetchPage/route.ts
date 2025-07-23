import { NextRequest, NextResponse } from 'next/server';
import { fetchBlockList } from "@udus/notion-renderer/libs";
import { Client } from '@notionhq/client';

export async function POST(req: NextRequest) {
  try {
    const { pageId, token } = await req.json();
    
    if (!pageId) {
      return NextResponse.json({ error: 'Missing pageId' }, { status: 400 });
    }
    
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    console.log("Fetching page for pageId:", pageId);
    
    // Set the token as environment variable temporarily for this request
    // Note: @udus/notion-renderer expects NOTION_TOKEN as env var
    process.env.NOTION_TOKEN = token;

    const client = new Client({ auth: token });
    
    // Call fetchBlockList with just the pageId - the library handles the rest
    const result = await fetchBlockList(client, { block_id: pageId });
    
    console.log('fetchPage result:', result);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching Notion page:', error);
    return NextResponse.json({ 
      error: error.message || 'Unknown error' 
    }, { status: 500 });
  }
} 