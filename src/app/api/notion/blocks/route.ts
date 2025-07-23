import { NextRequest, NextResponse } from 'next/server';

const NOTION_VERSION = "2022-06-28";

interface NotionBlock {
  object: string;
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: any;
}

async function getAllBlocks(pageId: string, token: string): Promise<NotionBlock[]> {
  const allBlocks: NotionBlock[] = [];
  let hasMore = true;
  let nextCursor: string | null = null;

  while (hasMore) {
    const url: string = `https://api.notion.com/v1/blocks/${pageId}/children${nextCursor ? `?start_cursor=${nextCursor}` : ''}`;
    
    const response: Response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch blocks: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    const blocks = data.results || [];
    allBlocks.push(...blocks);

    // Recursively fetch children blocks
    for (const block of blocks) {
      if (block.has_children) {
        try {
          const childBlocks = await getAllBlocks(block.id, token);
          allBlocks.push(...childBlocks);
        } catch (error) {
          console.warn(`Failed to fetch children for block ${block.id}:`, error);
        }
      }
    }

    hasMore = data.has_more;
    nextCursor = data.next_cursor;
  }

  return allBlocks;
}

export async function POST(req: NextRequest) {
  try {
    const { pageId } = await req.json();
    
    if (!pageId) {
      return NextResponse.json({ error: 'Missing pageId' }, { status: 400 });
    }
    
    // Use environment variable instead of user input
    const token = process.env.NOTION_TOKEN;
    
    if (!token) {
      return NextResponse.json({ 
        error: 'Notion integration not configured. Please set NOTION_TOKEN environment variable.' 
      }, { status: 500 });
    }

    console.log("Fetching blocks for pageId:", pageId);
    
    // Get all blocks recursively using Notion's official API
    const blocks = await getAllBlocks(pageId, token);
    
    console.log(`Fetched ${blocks.length} blocks for page ${pageId}`);
    
    return NextResponse.json({ 
      success: true,
      blocks: blocks,
      totalBlocks: blocks.length
    });
  } catch (error: any) {
    console.error('Error fetching Notion blocks:', error);
    return NextResponse.json({ 
      error: error.message || 'Unknown error' 
    }, { status: 500 });
  }
} 