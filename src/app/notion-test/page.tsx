'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { BlockList } from "@udus/notion-renderer/components";
import "@udus/notion-renderer/styles/globals.css";
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

export default function NotionTestPage() {
    const [token, setToken] = useState<string | null>(null);
    const [blocks, setBlocks] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // OAuth-related state
    const [pages, setPages] = useState<NotionPage[]>([]);
    const [databases, setDatabases] = useState<NotionDatabase[]>([]);
    const [selectedPageId, setSelectedPageId] = useState<string>('');

    const searchParams = useSearchParams();

    // On mount, check for token in localStorage or URL
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
        if (t) {
            setToken(t);
        }
    }, [searchParams]);

    // Fetch pages/databases if token is present
    useEffect(() => {
        if (!token) return;
        fetch(`/api/notion/list?token=${encodeURIComponent(token)}`)
            .then(res => res.json())
            .then(data => {
                setPages(data.pages || []);
                setDatabases(data.databases || []);
            })
            .catch(err => {
                console.error('Error fetching pages/databases:', err);
                setError('Failed to fetch pages and databases');
            });
    }, [token]);

    const handleFetchBlocks = async () => {
        if (!selectedPageId.trim()) {
            setError('Please select a page');
            return;
        }

        if (!token) {
            setError('Please authenticate with Notion first');
            return;
        }

        setLoading(true);
        setError('');

        try {
            console.log('pageId', selectedPageId);

            // Call our API route instead of making direct Notion API calls
            const response = await fetch('/api/notion/fetchPage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pageId: selectedPageId.trim(),
                    token: token.trim()
                }),
            });

            const result = await response.json();

            console.log('result', result);

            if (!response.ok) {
                throw new Error(result.error || 'Failed to fetch page');
            }

            console.log('fetchPage result', result);

            // Handle the Result type - check if it's successful
            if (result.ok) {
                setBlocks(result.data);
            } else {
                setError(result.data?.message || 'Failed to fetch blocks');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch blocks');
            console.error('Error fetching blocks:', err);
        } finally {
            setLoading(false);
        }
    };

    // Connect to Notion OAuth
    const handleConnect = () => {
        window.location.href = NOTION_AUTH_URL;
    };

    // Disconnect from OAuth
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
        setSelectedPageId('');
        setBlocks(null);
        setError('');
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Notion Components Test</h1>

            {!token ? (
                <div className="mb-8 p-6 border border-gray-300 rounded-md text-center">
                    <h2 className="text-xl font-semibold mb-4">Connect to Notion</h2>
                    <p className="text-gray-600 mb-6">
                        To test Notion page rendering, you need to authenticate with Notion and grant access to your pages.
                    </p>
                    <button
                        onClick={handleConnect}
                        className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 cursor-pointer"
                    >
                        Connect to Notion
                    </button>
                </div>
            ) : (
                <>
                    <div className="mb-6 p-4 border border-gray-300 rounded-md">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="text-green-600 font-medium">✓ Connected to Notion</span>
                                <span className="text-sm text-gray-500">
                                    Found {pages.length} pages and {databases.length} databases
                                </span>
                            </div>
                            <button
                                onClick={handleDisconnect}
                                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 cursor-pointer"
                            >
                                Disconnect
                            </button>
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="flex flex-col gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 mb-2">Select a Notion Page</label>
                                <select
                                    value={selectedPageId}
                                    onChange={(e) => setSelectedPageId(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">-- Select a Page --</option>
                                    <optgroup label="Pages">
                                        {pages.map((p) => {
                                            let title = "";
                                            if (p.properties && p.properties.title && p.properties.title.title && p.properties.title.title.length > 0) {
                                                title = p.properties.title.title[0].plain_text;
                                            } else if (p.object === "page" && p.id) {
                                                title = p.id;
                                            }
                                            return (
                                                <option key={p.id} value={p.id}>{title || p.id}</option>
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
                                                <option key={d.id} value={d.id}>{title || d.id}</option>
                                            );
                                        })}
                                    </optgroup>
                                </select>
                            </div>

                            <button
                                onClick={handleFetchBlocks}
                                disabled={loading || !selectedPageId}
                                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {loading ? 'Loading...' : 'Fetch Blocks'}
                            </button>
                        </div>

                        {error && (
                            <div className="text-red-500 mb-4">
                                Error: {error}
                            </div>
                        )}
                    </div>

                    {blocks && (
                        <div className="border-t pt-8">
                            <h2 className="text-2xl font-semibold mb-4">Rendered Notion Content:</h2>
                            <BlockList blocks={blocks} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
} 