"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";

interface NotionPage {
  id: string;
  object: "page";
  properties?: {
    title?: { title: { plain_text: string }[] };
  };
}

interface LoadingButtonProps {
  onClick: (e?: React.MouseEvent) => void | Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  loadingText: string;
  normalText: string;
  bgColor: string;
  textColor?: string;
  className?: string;
}

// Reusable loading button component
const LoadingButton = ({
  onClick,
  disabled = false,
  isLoading = false,
  loadingText,
  normalText,
  bgColor,
  textColor = "text-white",
  className = ""
}: LoadingButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`px-3 py-2 ${bgColor} ${textColor} rounded-full font-light text-sm hover:opacity-80 transition cursor-pointer ${isLoading ? 'opacity-70' : ''} ${className}`}
    >
      {isLoading ? (
        <div className="flex items-center">
          <div className={`w-4 h-4 border-2 ${textColor === 'text-black' ? 'border-black' : 'border-white'} border-t-transparent rounded-full animate-spin mr-2`}></div>
          {loadingText}
        </div>
      ) : (
        normalText
      )}
    </button>
  );
};

interface NotionIntegrationProps {
  onPageSelect?: (pageId: string, pageTitle: string) => void | Promise<void>;
  onPageRemove?: () => void | Promise<void>;
  className?: string;
  isEditMode?: boolean;
  editorContent?: Array<{
    type: string;
    props: {
      integration_type?: string;
      resource_id?: string;
    };
  }>;
}

export default function NotionIntegration({
  onPageSelect,
  onPageRemove,
  className = "",
  isEditMode = false,
  editorContent = []
}: NotionIntegrationProps) {
  const { user } = useAuth();
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasIntegration, setHasIntegration] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [integrationId, setIntegrationId] = useState<number | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [selectedPageTitle, setSelectedPageTitle] = useState<string>("");
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const checkIntegration = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/?user_id=${user.id}`);
      if (response.ok) {
        const integrations = await response.json();
        const notionIntegration = integrations.find((integration: { integration_type: string; access_token: string; id: number }) => integration.integration_type === 'notion');
        if (notionIntegration) {
          setHasIntegration(true);
          setAccessToken(notionIntegration.access_token);
          setIntegrationId(notionIntegration.id);
        }
      }
    } catch (err) {
      console.error('Error checking integration:', err);
    }
  };

  // Check for existing integration block in editor content
  useEffect(() => {
    if (editorContent && editorContent.length > 0) {
      const integrationBlock = editorContent.find(block => block.type === 'integration');
      if (integrationBlock && integrationBlock.props.integration_type === 'notion') {
        setSelectedPageId(integrationBlock.props.resource_id || "");
        // Try to find the page title from the pages list
        const page = pages.find(p => p.id === integrationBlock.props.resource_id);
        if (page) {
          setSelectedPageTitle(page.properties?.title?.title?.[0]?.plain_text || integrationBlock.props.resource_id || "");
        }
      }
    }
  }, [editorContent, pages]);

  // Check if the currently selected page is already in the database
  const isPageAlreadyInDatabase = () => {
    if (!editorContent || editorContent.length === 0) return false;
    const integrationBlock = editorContent.find(block => block.type === 'integration');
    return integrationBlock &&
      integrationBlock.props.integration_type === 'notion' &&
      integrationBlock.props.resource_id === selectedPageId;
  };

  // Check if user has Notion integration and handle OAuth callback
  useEffect(() => {
    if (!user?.id) return;

    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const notionToken = urlParams.get('notion_token');

    if (notionToken) {
      // Create the integration
      const createIntegration = async () => {
        setIsConnecting(true);
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id,
              integration_type: 'notion',
              access_token: notionToken,
            }),
          });

          if (response.ok) {
            // Clear URL parameters and refresh integration status
            const url = new URL(window.location.href);
            url.searchParams.delete('notion_token');
            window.history.replaceState({}, document.title, url.pathname + url.search);

            // Refresh integration status
            checkIntegration();
          } else {
            console.error('Failed to create integration');
          }
        } catch (err) {
          console.error('Error creating integration:', err);
        } finally {
          setIsConnecting(false);
        }
      };

      createIntegration();
    } else {
      // Check existing integration
      checkIntegration();
    }

  }, [user?.id]);

  // Fetch pages when we have an access token
  useEffect(() => {
    if (!accessToken) return;

    const fetchPages = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/notion/pages?token=${encodeURIComponent(accessToken)}`);
        const data = await response.json();

        if (response.ok) {
          setPages(data.pages || []);
        } else {
          setError(data.error || 'Failed to fetch pages');
        }
      } catch (err) {
        setError('Failed to fetch pages');
        console.error('Error fetching pages:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPages();
  }, [accessToken]);

  const handleConnectNotion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConnecting(true);
    const NOTION_CLIENT_ID = process.env.NEXT_PUBLIC_NOTION_CLIENT_ID || "";
    const currentUrl = window.location.href;
    const NOTION_AUTH_URL = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&response_type=code&state=${encodeURIComponent(currentUrl)}`;
    window.location.href = NOTION_AUTH_URL;
  };

  const handleDisconnectNotion = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!integrationId) return;

    setIsDisconnecting(true);
    try {
      // First revoke the token with Notion
      if (accessToken) {
        await fetch('/api/notion/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: accessToken }),
        });
      }

      // Then delete from our database
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/${integrationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setHasIntegration(false);
        setAccessToken(null);
        setIntegrationId(null);
        setPages([]);
        setSelectedPageId("");
        setSelectedPageTitle("");
      } else {
        console.error('Failed to disconnect Notion');
      }
    } catch (err) {
      console.error('Error disconnecting Notion:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handlePageSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const pageId = e.target.value;
    if (pageId) {
      const selectedPage = pages.find(page => page.id === pageId);
      const pageTitle = selectedPage?.properties?.title?.title?.[0]?.plain_text || pageId;
      setSelectedPageId(pageId);
      setSelectedPageTitle(pageTitle);
    } else {
      setSelectedPageId("");
      setSelectedPageTitle("");
    }
  };

  const handleInsertPage = async () => {
    if (selectedPageId && selectedPageTitle && onPageSelect) {
      setIsInserting(true);
      try {
        // Add a small delay to show loading state if callback is synchronous
        const result = onPageSelect(selectedPageId, selectedPageTitle);
        if (result instanceof Promise) {
          await result;
        } else {
          // If synchronous, add a small delay to show loading state
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error('Error inserting page:', error);
      } finally {
        setIsInserting(false);
      }
    }
  };

  const handleRemovePage = async () => {
    setIsRemoving(true);
    try {
      // Add a small delay to show loading state if callback is synchronous
      if (onPageRemove) {
        const result = onPageRemove();
        if (result instanceof Promise) {
          await result;
        } else {
          // If synchronous, add a small delay to show loading state
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      setSelectedPageId("");
      setSelectedPageTitle("");
    } catch (error) {
      console.error('Error removing page:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  // Don't show anything if not in edit mode
  if (!isEditMode) {
    return null;
  }

  if (!hasIntegration) {
    return (
      <div
        className={`flex items-center gap-3 mr-5 ${className}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <LoadingButton
          onClick={handleConnectNotion}
          isLoading={isConnecting}
          loadingText="Connecting..."
          normalText="Connect Notion"
          bgColor="bg-white"
          textColor="text-black"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 mr-5 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="relative">
        <select
          onChange={handlePageSelect}
          value={selectedPageId}
          disabled={isLoading}
          className={`px-3 pr-10 py-2 bg-[#111] text-white rounded-md font-light text-sm focus:outline-none cursor-pointer border border-[#333] hover:bg-[#222] transition-colors appearance-none ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          <option value="">Select Notion Page</option>
          {pages.map((page) => {
            const title = page.properties?.title?.title?.[0]?.plain_text || page.id;
            return (
              <option key={page.id} value={page.id}>
                {title}
              </option>
            );
          })}
        </select>
        {/* Custom dropdown arrow */}
        <div className="pointer-events-none absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 8L10 12L14 8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {selectedPageId && (
        <>
          {isPageAlreadyInDatabase() ? (
            <LoadingButton
              onClick={handleRemovePage}
              isLoading={isRemoving}
              loadingText="Removing..."
              normalText="Remove Page"
              bgColor="bg-red-600"
            />
          ) : (
            <LoadingButton
              onClick={handleInsertPage}
              isLoading={isInserting}
              loadingText="Inserting..."
              normalText="Insert Page"
              bgColor="bg-green-600"
            />
          )}
        </>
      )}

      <LoadingButton
        onClick={handleDisconnectNotion}
        isLoading={isDisconnecting}
        loadingText="Disconnecting..."
        normalText="Disconnect"
        bgColor="bg-gray-600"
      />

      {error && (
        <div className="text-xs text-red-400">{error}</div>
      )}
    </div>
  );
} 