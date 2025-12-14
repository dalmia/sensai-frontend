import { NextRequest, NextResponse } from 'next/server';
import { fetchBlockList } from "@udus/notion-renderer/libs";
import { Client } from '@notionhq/client';

export async function POST(req: NextRequest) {
  const { pageId, token } = await req.json();
  
  if (!pageId) {
    return NextResponse.json({ error: 'Missing pageId' }, { status: 400 });
  }
  
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const client = new Client({ auth: token });
  
  // Call fetchBlockList with just the pageId - the library handles the rest
  const result = await fetchBlockList(client, { block_id: pageId });
  
  return NextResponse.json(result);
} 