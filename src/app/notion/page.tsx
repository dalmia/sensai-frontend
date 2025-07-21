"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import 'react-notion-x/src/styles.css';
import 'prismjs/themes/prism-tomorrow.css';
import 'katex/dist/katex.min.css';

const NotionRenderer = dynamic(
  () => import('react-notion-x').then((m) => m.NotionRenderer),
  { ssr: false }
);
const Code = dynamic(() => import('react-notion-x/build/third-party/code').then((m) => m.Code), { ssr: false });
const Collection = dynamic(() => import('react-notion-x/build/third-party/collection').then((m) => m.Collection), { ssr: false });
const Equation = dynamic(() => import('react-notion-x/build/third-party/equation').then((m) => m.Equation), { ssr: false });
const Pdf = dynamic(() => import('react-notion-x/build/third-party/pdf').then((m) => m.Pdf), { ssr: false });
const Modal = dynamic(() => import('react-notion-x/build/third-party/modal').then((m) => m.Modal), { ssr: false });

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

type NotionItem = NotionPage | NotionDatabase;

export default function NotionPage() {
  const [token, setToken] = useState<string | null>(null);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [block, setBlocks] = useState<NotionItem | null>(null);
  const [recordMap, setRecordMap] = useState<any>(null);
  const [loadingRecordMap, setLoadingRecordMap] = useState(false);
  const [recordMapError, setRecordMapError] = useState<string | null>(null);
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
    setRecordMap(null);
    setRecordMapError(null);
    setLoadingRecordMap(false);
    const [type, id] = e.target.value.split(":");
    let item: NotionItem | null = null;
    if (type === "page") {
      item = pages.find((p) => p.id === id) || null;
      setBlocks(item);
      if (item) {
        setLoadingRecordMap(true);
        try {
          const res = await fetch("/api/notion/recordMap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId: id, token }),
          });
          const data = await res.json();
          if (res.ok && data.recordMap) {
            setRecordMap(data.recordMap);
          } else {
            setRecordMapError(data.error || 'Failed to fetch Notion content');
          }
        } catch (err: any) {
          setRecordMapError(err.message || 'Unknown error');
        } finally {
          setLoadingRecordMap(false);
        }
      }
    } else if (type === "db") {
      item = databases.find((d) => d.id === id) || null;
      setBlocks(item);
      setRecordMap(null);
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
    setBlocks(null);
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
          <div className="w-full max-w-md flex flex-col gap-6 items-center">
            <div className="w-full">
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
            <div className="w-full bg-[#111] rounded-md p-4 min-h-[120px] mt-4">
              {block ? (
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(block, null, 2)}</pre>
              ) : (
                <span className="text-gray-500">Select a page or database to preview</span>
              )}
            </div>
            {/* Render Notion content if recordMap is available and block is a page */}
            {selected.startsWith('page:') && (
              <div className="w-full bg-[#181818] rounded-md p-4 mt-4">
                {loadingRecordMap ? (
                  <div className="text-gray-400">Loading Notion content...</div>
                ) : recordMapError ? (
                  <div className="text-red-400">{recordMapError}</div>
                ) : recordMap ? (
                  <NotionRenderer
                    recordMap={recordMap}
                    fullPage={true}
                    darkMode={true}
                    components={{ Code, Collection, Equation, Modal, Pdf }}
                  />
                ) : (
                  <div className="text-gray-500">Select a Notion page to render its content</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 