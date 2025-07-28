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

interface ButtonProps {
  onClick: (e?: React.MouseEvent) => void | Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  loadingText: string;
  normalText: string;
  bgColor: string;
  textColor?: string;
  className?: string;
  showIcon?: boolean;
}

// Notion icon component
const NotionIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632" />
  </svg>
);

// Reusable loading button component
const Button = ({
  onClick,
  disabled = false,
  isLoading = false,
  loadingText,
  normalText,
  bgColor,
  textColor = "text-white",
  className = "",
  showIcon = false
}: ButtonProps) => {
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
        <div className="flex items-center">
          {showIcon && <NotionIcon className="w-4 h-4 mr-2" />}
          {normalText}
        </div>
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasIntegration, setHasIntegration] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [selectedPageTitle, setSelectedPageTitle] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noPagesFound, setNoPagesFound] = useState(false);

  // Add state for confirmation dialog
  const [showOverwriteConfirmation, setShowOverwriteConfirmation] = useState(false);
  const [pendingPageSelection, setPendingPageSelection] = useState<{ pageId: string; pageTitle: string } | null>(null);
  const [showUnlinkConfirmation, setShowUnlinkConfirmation] = useState(false);

  const checkIntegration = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/?user_id=${user.id}`);
      if (response.ok) {
        const integrations = await response.json();
        const notionIntegration = integrations.find((integration: { integration_type: string; access_token: string; id: number }) => integration.integration_type === 'notion');
        if (notionIntegration) {
          setHasIntegration(true);
          setAccessToken(notionIntegration.access_token);
          setNoPagesFound(false);
          setError(null);
        }
      }
    } catch (err) {
      console.error('Error checking integration:', err);
    } finally {
      setIsLoading(false);
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

  const handleAddMorePages = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    handleConnectNotion(e);
  };

  const handleReconnectNotion = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    handleConnectNotion(e);
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

  const handleUnlinkPage = async () => {
    setShowUnlinkConfirmation(true);
  };

  const handleConfirmUnlink = async () => {
    setIsUnlinking(true);
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
      console.error('Error unlinking page:', error);
    } finally {
      setIsUnlinking(false);
      setShowUnlinkConfirmation(false);
    }
  };

  const handleCancelUnlink = () => {
    setShowUnlinkConfirmation(false);
  };

  // Don't show anything if not in edit mode
  if (!isEditMode) {
    return null;
  }

  // Show loading state while checking integration
  if (isLoading) {
    return (
      <div
        className={`flex items-center gap-3 ml-4 ${className}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
          <span className="text-sm text-white">Checking Notion integration...</span>
        </div>
      </div>
    );
  }

  // Show connect button if not connected
  if (!hasIntegration) {
    return (
      <div
        className={`flex items-center gap-3 ml-4 ${className}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Button
          onClick={handleConnectNotion}
          isLoading={isConnecting}
          loadingText="Connecting..."
          normalText="Connect Notion"
          bgColor="bg-white"
          textColor="text-black"
          showIcon={true}
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
        {/* Show message when no pages are found */}
        {noPagesFound && !selectedPageId && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-yellow-400 font-light">
              No pages found
            </span>
          </div>
        )}
        {/* Show reconnect button if no pages found */}
        {noPagesFound && !selectedPageId && (
          <Button
            onClick={handleReconnectNotion}
            isLoading={isConnecting}
            loadingText="Connecting..."
            normalText="Reconnect Notion"
            bgColor="bg-white"
            textColor="text-black"
            showIcon={true}
          />
        )}

        {/* Show dropdown and add more pages button when pages are loaded and no page is selected */}
        {showDropdown && !selectedPageId && pages.length > 0 && (
          <>
            <div className="relative">
              <select
                onChange={handlePageSelect}
                value=""
                className="px-3 pr-10 py-2 bg-white text-black rounded-md font-light text-sm focus:outline-none cursor-pointer border border-gray-300 hover:bg-gray-50 transition-colors appearance-none"
              >
                <option value="" disabled>Select Notion page</option>
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
              <div className="pointer-events-none absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 8L10 12L14 8" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            <Button
              onClick={handleAddMorePages}
              isLoading={isConnecting}
              loadingText="Connecting..."
              normalText="Add more pages"
              bgColor="bg-white"
              textColor="text-black"
              showIcon={true}
            />
          </>
        )}

        {selectedPageId && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm text-white font-light">
                Connected to {selectedPageTitle} Notion page
              </div>
              <Button
                onClick={handleUnlinkPage}
                isLoading={isUnlinking}
                loadingText="Unlinking..."
                normalText="Unlink page"
                bgColor="bg-red-600"
                showIcon={false}
              />
            </div>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-yellow-300 font-light">
                  This is a read-only Notion page. Make changes in the original Notion document for them to be reflected here.
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400">{error}</div>
        )}
      </div>

      {/* Overwrite confirmation dialog */}
      <ConfirmationDialog
        open={showOverwriteConfirmation}
        title="Connect to Notion page?"
        message="Connecting to a Notion page will replace all existing content in the editor."
        confirmButtonText="Overwrite"
        cancelButtonText="Cancel"
        onConfirm={handleConfirmOverwrite}
        onCancel={handleCancelOverwrite}
        type="delete"
      />

      {/* Unlink confirmation dialog */}
      <ConfirmationDialog
        open={showUnlinkConfirmation}
        title="Unlink Notion page?"
        message="Unlinking this Notion page will remove its content from the editor."
        confirmButtonText="Unlink"
        cancelButtonText="Cancel"
        onConfirm={handleConfirmUnlink}
        onCancel={handleCancelUnlink}
        type="delete"
      />
    </>
  );
}