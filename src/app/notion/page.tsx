"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { BlockList, RenderConfig } from "@udus/notion-components";
// import "@udus/notion-components/dist/globals.css";
import "katex/dist/katex.min.css";

const NOTION_CLIENT_ID = process.env.NEXT_PUBLIC_NOTION_CLIENT_ID || "";
const NOTION_REDIRECT_URI = process.env.NEXT_PUBLIC_NOTION_REDIRECT_URI || "http://localhost:3000/api/notion/auth/callback";
const NOTION_AUTH_URL = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&redirect_uri=${encodeURIComponent(NOTION_REDIRECT_URI)}&response_type=code`;

// Types for Notion API responses
interface NotionTitle {
  plain_text: string;
}
interface NotionPage {
  id: string;
  object: "page";
  properties?: {
    title?: { title: NotionTitle[] };
  };
}
interface NotionDatabase {
  id: string;
  object: "database";
  title?: NotionTitle[];
}

interface NotionBlock {
  object: string;
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: any;
}

interface NotionPageData {
  page: NotionPage;
  blocks: NotionBlock[];
  totalBlocks: number;
}

type NotionItem = NotionPage | NotionDatabase;

export default function NotionPage() {
  const [token, setToken] = useState<string | null>(null);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<NotionItem | null>(null);
  const [pageData, setPageData] = useState<NotionPageData | null>(null);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const searchParams = useSearchParams();

  // On mount, check for token in localStorage or URL (for demo)
  useEffect(() => {
    let t = typeof window !== "undefined" ? localStorage.getItem("notion_token") : null;
    const urlToken = searchParams?.get("token");
    if (urlToken) {
      t = urlToken;
      if (typeof window !== "undefined") {
        localStorage.setItem("notion_token", urlToken);
        // Remove token from URL
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState({}, document.title, url.pathname);
      }
    }
    if (t) setToken(t);
  }, [searchParams]);

  // Fetch pages/databases if token is present
  useEffect(() => {
    if (!token) return;
    fetch(`/api/notion/list?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        setPages(data.pages || []);
        setDatabases(data.databases || []);
      });
  }, [token]);

  // Handle selection change
  const handleSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelected(e.target.value);
    setPageData(null);
    setBlocksError(null);
    setLoadingBlocks(false);

    const [type, id] = e.target.value.split(":");
    let item: NotionItem | null = null;

    if (type === "page") {
      item = pages.find((p) => p.id === id) || null;
      setSelectedItem(item);

      if (item) {
        setLoadingBlocks(true);
        try {
          const res = await fetch("/api/notion/recordMap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId: id, token }),
          });
          const data = await res.json();
          if (res.ok && data.page && data.blocks) {
            console.log("data", data);
            setPageData(data);
          } else {
            setBlocksError(data.error || 'Failed to fetch Notion content');
          }
        } catch (err: any) {
          setBlocksError(err.message || 'Unknown error');
        } finally {
          setLoadingBlocks(false);
        }
      }
    } else if (type === "db") {
      item = databases.find((d) => d.id === id) || null;
      setSelectedItem(item);
      setPageData(null);
    }
  };

  // Connect button handler
  const handleConnect = () => {
    window.location.href = NOTION_AUTH_URL;
  };

  // Disconnect handler
  const handleDisconnect = async () => {
    if (!token) return;
    await fetch("/api/notion/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (typeof window !== "undefined") {
      localStorage.removeItem("notion_token");
    }
    setToken(null);
    setPages([]);
    setDatabases([]);
    setSelected("");
    setSelectedItem(null);
    setPageData(null);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-light mb-8">Notion Integration</h1>
      {!token ? (
        <button
          onClick={handleConnect}
          className="px-6 py-3 bg-white text-black rounded-full font-medium text-lg hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-white transition cursor-pointer"
        >
          Connect to Notion
        </button>
      ) : (
        <>
          <button
            onClick={handleDisconnect}
            className="mb-6 px-6 py-2 bg-red-600 text-white rounded-full font-medium text-base hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-red-400 transition cursor-pointer"
          >
            Disconnect
          </button>
          <div className="w-full max-w-6xl flex flex-col gap-6 items-center">
            <div className="w-full max-w-md">
              <label className="block text-gray-300 mb-2">Select a Notion Page or Database</label>
              <select
                className="w-full p-3 rounded-md bg-[#181818] text-white border border-gray-700 focus:outline-none"
                value={selected}
                onChange={handleSelect}
              >
                <option value="">-- Select --</option>
                <optgroup label="Pages">
                  {pages.map((p) => {
                    let title = "";
                    if (p.properties && p.properties.title && p.properties.title.title && p.properties.title.title.length > 0) {
                      title = p.properties.title.title[0].plain_text;
                    } else if (p.object === "page" && p.id) {
                      title = p.id;
                    }
                    return (
                      <option key={p.id} value={`page:${p.id}`}>{title || p.id}</option>
                    );
                  })}
                </optgroup>
                <optgroup label="Databases">
                  {databases.map((d) => {
                    let title = "";
                    if (d.title && d.title.length > 0) {
                      title = d.title[0].plain_text;
                    } else if (d.object === "database" && d.id) {
                      title = d.id;
                    }
                    return (
                      <option key={d.id} value={`db:${d.id}`}>{title || d.id}</option>
                    );
                  })}
                </optgroup>
              </select>
            </div>

            {/* Selected Item Preview */}
            {selectedItem && (
              <div className="w-full bg-[#111] rounded-md p-4 min-h-[120px]">
                <h3 className="text-lg font-light mb-2">Selected {selectedItem.object === 'page' ? 'Page' : 'Database'} Details:</h3>
                <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-60">{JSON.stringify(selectedItem, null, 2)}</pre>
              </div>
            )}

            {/* Page Blocks Content */}
            {selected.startsWith('page:') && (
              <div className="w-full bg-[#181818] rounded-md p-4">
                {loadingBlocks ? (
                  <div className="text-gray-400">Loading all page blocks...</div>
                ) : blocksError ? (
                  <div className="text-red-400">Error: {blocksError}</div>
                ) : pageData ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-light">Page Content</h3>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">Total blocks: {pageData.totalBlocks}</span>
                        <button
                          onClick={() => setShowJson(!showJson)}
                          className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:opacity-80 cursor-pointer"
                        >
                          {showJson ? 'Show Rendered' : 'Show JSON'}
                        </button>
                      </div>
                    </div>

                    {showJson ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-md font-light mb-2 text-gray-300">Page Metadata:</h4>
                          <div className="bg-[#111] rounded p-3 overflow-auto max-h-60">
                            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(pageData.page, null, 2)}</pre>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-md font-light mb-2 text-gray-300">All Blocks ({pageData.blocks.length}):</h4>
                          <div className="bg-[#111] rounded p-3 overflow-auto max-h-96">
                            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(pageData.blocks, null, 2)}</pre>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white text-black rounded p-4 overflow-auto max-h-96">
                        <RenderConfig theme="light">
                          <BlockList blocks={pageData.blocks} />
                        </RenderConfig>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500">Select a Notion page to fetch all its blocks</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 