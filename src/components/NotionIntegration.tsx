"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import ConfirmationDialog from "./ConfirmationDialog";

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
    content?: Array<{
      text?: string;
    }>;
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
  const [isRemoving, setIsRemoving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noPagesFound, setNoPagesFound] = useState(false);

  // Add state for confirmation dialog
  const [showOverwriteConfirmation, setShowOverwriteConfirmation] = useState(false);
  const [pendingPageSelection, setPendingPageSelection] = useState<{ pageId: string; pageTitle: string } | null>(null);

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
          setNoPagesFound(false);
          setError(null);
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
      setNoPagesFound(false); // Reset no pages found state

      try {
        const response = await fetch(`/api/notion/pages?token=${encodeURIComponent(accessToken)}`);
        const data = await response.json();

        if (response.ok) {
          setPages(data.pages || []);
          setShowDropdown(true);
          if (data.pages && data.pages.length === 0) {
            setNoPagesFound(true);
          }
        } else {
          setError(data.error || 'Failed to fetch pages');
          setNoPagesFound(true); // Set to true if API returns an error
        }
      } catch (err) {
        setError('Failed to fetch pages');
        setNoPagesFound(true); // Set to true on network error
        console.error('Error fetching pages:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPages();
  }, [accessToken]);

  const handleConnectNotion = (e?: React.MouseEvent) => {
    e?.stopPropagation();

    setIsConnecting(true);
    const NOTION_CLIENT_ID = process.env.NEXT_PUBLIC_NOTION_CLIENT_ID || "";
    const currentUrl = window.location.href;
    const NOTION_AUTH_URL = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&response_type=code&state=${encodeURIComponent(currentUrl)}`;
    window.location.href = NOTION_AUTH_URL;
  };

  const handleDisconnectNotion = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
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
        setShowDropdown(false);
        setNoPagesFound(false);
        setError(null);

        // If this was triggered from "Disconnect & Reconnect", automatically start reconnection
        if (noPagesFound) {
          // Start reconnection immediately
          handleConnectNotion();
        }
      } else {
        console.error('Failed to disconnect Notion');
      }
    } catch (err) {
      console.error('Error disconnecting Notion:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };



  // Function to check if there are existing blocks that would be overwritten
  const hasExistingContent = () => {
    if (!editorContent || editorContent.length === 0) return false;

    // Check if there are any blocks beyond the first default paragraph
    if (editorContent.length > 1) return true;

    // If there's only one block, check if it has actual content
    if (editorContent.length === 1) {
      const block = editorContent[0];

      // If it's already an integration block, don't consider it as "existing content"
      if (block.type === 'integration') return false;

      // Check if the block has actual content
      if (block.content && Array.isArray(block.content)) {
        return block.content.some((item: { text?: string }) =>
          item.text && item.text.trim() !== ""
        );
      }
    }

    return false;
  };

  const handlePageSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const pageId = e.target.value;
    if (pageId) {
      const selectedPage = pages.find(page => page.id === pageId);
      const pageTitle = selectedPage?.properties?.title?.title?.[0]?.plain_text || pageId;

      // Check if there's existing content that would be overwritten
      if (hasExistingContent()) {
        // Store the pending selection and show confirmation dialog
        setPendingPageSelection({ pageId, pageTitle });
        setShowOverwriteConfirmation(true);
        // Reset the select value
        e.target.value = "";
      } else {
      // No existing content, proceed immediately
        setSelectedPageId(pageId);
        setSelectedPageTitle(pageTitle);

        // Automatically insert the page when selected
        if (onPageSelect) {
          onPageSelect(pageId, pageTitle);
        }
      }
    } else {
      setSelectedPageId("");
      setSelectedPageTitle("");
    }
  };

  // Handle confirmation to overwrite existing content
  const handleConfirmOverwrite = () => {
    if (pendingPageSelection) {
      setSelectedPageId(pendingPageSelection.pageId);
      setSelectedPageTitle(pendingPageSelection.pageTitle);

      // Automatically insert the page when confirmed
      if (onPageSelect) {
        onPageSelect(pendingPageSelection.pageId, pendingPageSelection.pageTitle);
      }
    }

    // Reset the pending selection and close dialog
    setPendingPageSelection(null);
    setShowOverwriteConfirmation(false);
  };

  // Handle canceling the overwrite confirmation
  const handleCancelOverwrite = () => {
    setPendingPageSelection(null);
    setShowOverwriteConfirmation(false);
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
      setShowDropdown(true);
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
        className={`flex items-center gap-3 ml-4 ${className}`}
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
    <>
      <div
        className={`flex items-center gap-3 ml-4 ${className}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!isLoading ?
          <LoadingButton
            onClick={handleDisconnectNotion}
            isLoading={isDisconnecting || (noPagesFound && isConnecting)}
            loadingText="Processing..."
            normalText={noPagesFound ? "Disconnect & Reconnect" : "Disconnect"}
            bgColor={noPagesFound ? "bg-yellow-600" : "bg-gray-600"}
          /> :
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            <span className="text-sm text-white">Checking pages...</span>
          </div>}

        {/* Show dropdown only when pages are loaded and no page is selected */}
        {showDropdown && !isLoading && !selectedPageId && pages.length > 0 && (
          <div className="relative">
            <select
              onChange={handlePageSelect}
              value=""
              className="px-3 pr-10 py-2 bg-[#111] text-white rounded-md font-light text-sm focus:outline-none cursor-pointer border border-[#333] hover:bg-[#222] transition-colors appearance-none"
            >
              <option value="" disabled>Select Notion Page</option>
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
        )}

        {/* Show message when no pages are found */}
        {noPagesFound && !isLoading && !selectedPageId && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-yellow-400 font-light">
              No pages found
            </span>
          </div>
        )}

        {/* Show selected page info and remove button */}
        {selectedPageId && !isLoading && (
          <div className="flex items-center gap-2">
            <span className="text-base text-white font-light">
              {selectedPageTitle}
            </span>
            <LoadingButton
              onClick={handleRemovePage}
              isLoading={isRemoving}
              loadingText="Removing..."
              normalText="Remove"
              bgColor="bg-red-600"
            />
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400">{error}</div>
        )}
      </div>

      {/* Overwrite confirmation dialog */}
      <ConfirmationDialog
        open={showOverwriteConfirmation}
        title="Are you sure you want to proceed?"
        message="Adding a Notion page will replace all existing content in the editor."
        confirmButtonText="Overwrite"
        cancelButtonText="Cancel"
        onConfirm={handleConfirmOverwrite}
        onCancel={handleCancelOverwrite}
        type="delete"
      />
    </>
  );
} 