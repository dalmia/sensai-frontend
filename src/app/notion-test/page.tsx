'use client';

import { useState } from 'react';
import { BlockList } from "@udus/notion-renderer/components";

export default function NotionTestPage() {
    const [pageId, setPageId] = useState('2397e7c237cb80bfb622d6294a627566');
    const [token, setToken] = useState('');
    const [blocks, setBlocks] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFetchBlocks = async () => {
        if (!pageId.trim()) {
            setError('Please enter a page ID');
            return;
        }

        const token = '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';

        setLoading(true);
        setError('');

        try {
            console.log('pageId', pageId);

            // Call our API route instead of making direct Notion API calls
            const response = await fetch('/api/notion/fetchPage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pageId: pageId.trim(),
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

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Notion Components Test</h1>

            <div className="mb-8">
                <div className="flex flex-col gap-4 mb-4">
                    <input
                        type="text"
                        value={pageId}
                        onChange={(e) => setPageId(e.target.value)}
                        placeholder="Enter Notion Page ID"
                        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleFetchBlocks}
                        disabled={loading}
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
        </div>
    );
} 