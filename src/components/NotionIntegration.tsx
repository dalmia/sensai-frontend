"use client";

import { useState, useEffect } from "react";
import { useIntegration } from "@/context/IntegrationContext";
import ConfirmationDialog from "./ConfirmationDialog";
import ConnectNotionButton from "./ConnectNotionButton";
import { RefreshCcw, Unlink } from "lucide-react";
import { compareNotionBlocks, fetchIntegrationBlocks } from "@/lib/utils/integrationUtils";
import Toast from "./Toast";

// Notion icon component
const NotionIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632" />
  </svg>
);

interface IntegrationProps {
  onPageSelect?: (pageId: string, pageTitle: string) => Promise<{ hasNestedPages?: boolean } | void>;
  onPageRemove?: () => void | Promise<void>;
  className?: string;
  isEditMode?: boolean;
  loading?: boolean;
  editorContent?: Array<{
    type: string;
    props: {
      integration_type?: string;
      resource_id?: string;
      resource_name?: string;
    };
    content?: Array<{
      text?: string;
    }>;
  }>;
  status?: string;
  storedBlocks?: any[];
  onContentUpdate?: (updatedContent: any[]) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export default function NotionIntegration({
  onPageSelect,
  onPageRemove,
  className = "",
  isEditMode = false,
  editorContent = [],
  loading = false,
  status = "draft",
  storedBlocks = [],
  onContentUpdate,
  onLoadingChange
}: IntegrationProps) {
  const {
    hasIntegration,
    isLoading: isCheckingIntegration,
    isIntegrationCheckComplete,
    error: contextError,
    pages,
    isLoadingPages,
    noPagesFound,
    showDropdown,
    isConnecting,
    isOAuthCallbackComplete,
    connectIntegration,
    setShowDropdown
  } = useIntegration();

  // Local state for component-specific functionality
  const [showSyncNotice, setShowSyncNotice] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasCheckedForNotionUpdates, setHasCheckedForNotionUpdates] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>();
  const [selectedPageTitle, setSelectedPageTitle] = useState<string | undefined>();
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add state for confirmation dialog
  const [showOverwriteConfirmation, setShowOverwriteConfirmation] = useState(false);
  const [pendingPageSelection, setPendingPageSelection] = useState<{ pageId: string; pageTitle: string } | null>(null);
  const [showUnlinkConfirmation, setShowUnlinkConfirmation] = useState(false);

  // Add state for Toast
  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastEmoji, setToastEmoji] = useState("⚠️");


  // Check for existing integration block in editor content
  useEffect(() => {
    const integrationBlock = editorContent?.find?.(block => block.type === 'notion');
    if (integrationBlock) {
      setSelectedPageId(integrationBlock.props.resource_id);
      setSelectedPageTitle(integrationBlock.props.resource_name);
    }
  }, [editorContent]);

  // Add this after the useEffect that sets selectedPageId/selectedPageTitle from editorContent
  useEffect(() => {
    // If editorContent is empty, clear the selected page
    if (Array.isArray(editorContent) && editorContent.length === 0) {
      setSelectedPageId(undefined);
      setSelectedPageTitle(undefined);
    }
  }, [editorContent]);

  // Add useEffect to automatically hide toast after 5 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 5000);

      // Cleanup the timer when component unmounts or showToast changes
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Show no pages toast when OAuth callback is complete and no pages are found
  useEffect(() => {
    if (isOAuthCallbackComplete && noPagesFound && !isLoadingPages) {
      showNoPagesToast();
    }
  }, [isOAuthCallbackComplete, noPagesFound, isLoadingPages]);

  const handleConnectNotion = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    await connectIntegration();
  };

  const handleAddMorePages = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    await connectIntegration();
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

  const handlePageSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const pageId = e.target.value;
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    if (pageId) {
      const selectedPage = pages.find(page => page.id === pageId);
      const pageTitle = selectedPage?.properties?.title?.title?.[0]?.plain_text || "New page";

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
          const result = await onPageSelect(pageId, pageTitle);
          if (result && result.hasNestedPages) {
            if (onLoadingChange) {
              onLoadingChange(false);
            }
              showNestedPagesToast();
              setSelectedPageId(undefined);
              setSelectedPageTitle(undefined);
            return;
          }
        }
      }
    } else {
      setSelectedPageId("");
      setSelectedPageTitle("");
    }
    if (onLoadingChange) {
      onLoadingChange(false);
    }
  };

  // Function to show toast for nested pages error
  const showNestedPagesToast = () => {
    setToastTitle("Nested page not supported");
    setToastMessage('This page contains nested pages or databases which are not supported. Please select a different page.');
    setToastEmoji("⚠️");
    setShowToast(true);
  };

  // Function to show toast for no pages found
  const showNoPagesToast = () => {
    setToastTitle("No pages found");
    setToastMessage("No pages were found. Please select some pages while connecting Notion.");
    setToastEmoji("📄");
    setShowToast(true);
  };

  // Handle confirmation to overwrite existing content
  const handleConfirmOverwrite = async () => {
    if (pendingPageSelection) {
      setSelectedPageId(pendingPageSelection.pageId);
      setSelectedPageTitle(pendingPageSelection.pageTitle);

      // Automatically insert the page when confirmed
      if (onPageSelect) {
        const result = await onPageSelect(pendingPageSelection.pageId, pendingPageSelection.pageTitle);
        if (result && result.hasNestedPages) {
          showNestedPagesToast();
          setSelectedPageId(undefined);
          setSelectedPageTitle(undefined);
          setPendingPageSelection(null);
          setShowOverwriteConfirmation(false);
          return;
        }
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
      setError(null);
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

  // Handle sync button click
  const handleSyncNotionBlocks = async () => {
    if (!selectedPageId || !editorContent || !onContentUpdate) return;

    setIsSyncing(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }

    try {
      const integrationBlock = editorContent.find(block => block.type === 'notion');
      if (!integrationBlock) return;

      const result = await fetchIntegrationBlocks(integrationBlock as Parameters<typeof fetchIntegrationBlocks>[0]);

      if (result.error) {
        setError(result.error);
        return;
      }

      // Check if the updated blocks contain nested pages or databases
      if (result.hasNestedPages) {
        setError('This page now contains sub-pages or databases which are not supported for syncing');
        return;
      }

      if (result.blocks && result.blocks.length > 0) {
        const updatedIntegrationBlock = {
          ...integrationBlock,
          content: result.blocks,
          props: {
            ...integrationBlock.props,
            resource_name: result.updatedTitle || integrationBlock.props.resource_name
          }
        };

        const updatedContent = editorContent.map(block =>
          block.type === 'notion' ? updatedIntegrationBlock : block
        );

        if (result.updatedTitle && result.updatedTitle !== selectedPageTitle) {
          setSelectedPageTitle(result.updatedTitle);
        }

        onContentUpdate(updatedContent);
        setShowSyncNotice(false);
        setError(null);
      }
    } catch (error) {
      setError('Failed to sync content. Please try again.');
    } finally {
      setIsSyncing(false);
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    }
  };

  // Check if we should show sync notice in edit mode
  useEffect(() => {
    if (isEditMode && selectedPageId && storedBlocks.length > 0 && !hasCheckedForNotionUpdates) {

      const checkForUpdates = async () => {
        try {
          if (onLoadingChange) {
            onLoadingChange(true);
          }

          // Find the integration block to get the integration details
          const integrationBlock = editorContent.find(block => block.type === 'notion');
          if (!integrationBlock) {
            setHasCheckedForNotionUpdates(true);
            return;
          }

          // Fetch the latest blocks from Notion API
          const result = await fetchIntegrationBlocks(integrationBlock);

          if (result.error) {
            setHasCheckedForNotionUpdates(true);
            return;
          }

          // Check if the updated blocks contain nested pages or databases
          if (result.hasNestedPages) {
            if (status === 'draft') {
              showNestedPagesToast();
              if (onContentUpdate) {
                onContentUpdate([]);
              }
            } else {
              setError('This page now contains sub-pages or databases which are not supported for syncing');
            }
            setHasCheckedForNotionUpdates(true);
            return;
          }

          if (result.blocks && result.blocks.length > 0) {
            if (status === 'draft') {
              // For draft status, automatically sync and update content
              const updatedIntegrationBlock = {
                ...integrationBlock,
                content: result.blocks,
                props: {
                  ...integrationBlock.props,
                  resource_name: result.updatedTitle || integrationBlock.props.resource_name
                }
              };

              const updatedContent = editorContent.map(block =>
                block.type === 'notion' ? updatedIntegrationBlock : block
              );

              if (result.updatedTitle && result.updatedTitle !== selectedPageTitle) {
                setSelectedPageTitle(result.updatedTitle);
              }

              if (onContentUpdate) {
                onContentUpdate(updatedContent);
              }
            } else {
              // For published status, compare with stored blocks to show sync notice
              if (storedBlocks.length > 0) {
                const hasChanges = compareNotionBlocks(storedBlocks, result.blocks);
                const titleChanged = result.updatedTitle &&
                  result.updatedTitle !== integrationBlock.props.resource_name;

                if (hasChanges || titleChanged) {
                  setShowSyncNotice(true);
                }
              }
            }
          }

          // Mark that we've checked for updates
          setHasCheckedForNotionUpdates(true);
        } catch (error) {
          setHasCheckedForNotionUpdates(true);
        } finally {
          if (onLoadingChange) {
            onLoadingChange(false);
          }
        }
      };
      checkForUpdates();
    }
  }, [isEditMode, selectedPageId, storedBlocks, hasCheckedForNotionUpdates, status]);

  // Don't show anything if not in edit mode
  if (!isEditMode) {
    return null;
  }

  // Don't show anything until integration check is complete
  if (!isIntegrationCheckComplete) {
    return null;
  }

  // Show loading state when fetching pages
  if ((isCheckingIntegration || isLoadingPages) && hasIntegration) {
    return (
      <div
        className={`flex items-center gap-3 ml-16 ${className}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
          <span className="text-sm text-white">{selectedPageId ? 'Fetching notion page...' : 'Fetching notion pages...'}</span>
        </div>
      </div>
    );
  }

  // Show connect button if integration check is complete and not connected
  if (!hasIntegration || noPagesFound) {
    return (
      <>
        <div
           className={`flex items-center gap-3 ml-16 ${className}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <ConnectNotionButton
              onClick={handleConnectNotion}
              disabled={loading}
              isLoading={isConnecting}
              loadingText="Connecting..."
              normalText="Connect Notion"
              bgColor="bg-white"
              textColor="text-black"
              icon={<NotionIcon className="w-4 h-4" />}
              tooltip={true}
            />
          </div>
        </div>

        {/* Toast component - ensure it's always rendered when needed */}
        <Toast
          show={showToast}
          title={toastTitle}
          description={toastMessage}
          emoji={toastEmoji}
          onClose={() => setShowToast(false)}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 ml-16 mb-4 ${className}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Show dropdown and add more pages button when pages are loaded and no page is selected */}
        {showDropdown && !selectedPageId && pages.length > 0 && (
          <>
            <div className="relative">
              <select
                onChange={handlePageSelect}
                value=""
                disabled={loading}
                className={`px-3 pr-10 py-2 bg-white text-black rounded-md font-light text-sm focus:outline-none border border-gray-300 transition-colors appearance-none ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
              >
                <option value="" disabled>Select Notion page</option>
                {pages.map((page) => {
                  const title = page.properties?.title?.title?.[0]?.plain_text || "New page";
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

            <div className="flex items-center gap-2">
              <ConnectNotionButton
                onClick={handleAddMorePages}
                disabled={loading}
                isLoading={isConnecting}
                loadingText="Connecting..."
                normalText="Add more pages"
                bgColor="bg-white"
                textColor="text-black"
                icon={<NotionIcon className="w-4 h-4" />}
                tooltip={true}
              />
            </div>
          </>
        )}

        {selectedPageId && (
          <div className="bg-gray-900/30 rounded-lg px-4 py-3 border border-gray-700/50">
            {/* Connection status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <NotionIcon className="w-4 h-4 text-gray-400" />
                  <div className={`flex items-center gap-2 ${status === 'published' ? 'mr-3' : ''}`}>
                    <span className="text-sm text-gray-400 font-light">Connected to</span>
                    <span className="text-sm text-white font-medium bg-gray-800 px-2 py-1 rounded-md">
                      {selectedPageTitle}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ConnectNotionButton
                  onClick={handleUnlinkPage}
                  disabled={loading}
                  isLoading={isUnlinking}
                  loadingText="Unlinking..."
                  normalText="Unlink"
                  bgColor="bg-gray-700 hover:bg-red-700"
                  icon={<Unlink className="w-3 h-3" />}
                  className="text-xs px-2 py-1"
                />
                {showSyncNotice && isEditMode && (
                  <ConnectNotionButton
                    onClick={handleSyncNotionBlocks}
                    disabled={isSyncing}
                    isLoading={isSyncing}
                    loadingText="Syncing..."
                    normalText="Sync"
                    bgColor="bg-yellow-800 hover:bg-yellow-900"
                    icon={<RefreshCcw className="w-3 h-3" />}
                    className="text-xs px-3 py-1"
                  />
                )}
              </div>
            </div>

            {/* Conditional notice message based on status */}
            {status === "draft" && (
              <div className="flex items-start gap-2 mt-3">
                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm text-gray-300 font-light leading-relaxed">
                    Changes must be made in the original Notion document for them to be reflected here
                  </div>
                </div>
              </div>
            )}

            {/* Sync notice for edit mode - only show in published status */}
            {(contextError || error) && (
              <div className="text-sm text-red-400 mt-3">{contextError || error}</div>
            )}

            {/* Sync notice for edit mode - only show in published status */}
            {showSyncNotice && isEditMode && status === 'published' && (
              <div className="flex items-start gap-2 mt-3">
                <svg className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm text-yellow-400 font-light leading-relaxed">
                    The Notion page has been updated. Click the sync button to fetch the latest changes.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overwrite confirmation dialog */}
      <ConfirmationDialog
        open={showOverwriteConfirmation}
        title="Connect to Notion page?"
        message="Connecting to a Notion page will replace all existing content in the editor"
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
        message="Unlinking this Notion page will remove its content from the editor"
        confirmButtonText="Unlink"
        cancelButtonText="Cancel"
        onConfirm={handleConfirmUnlink}
        onCancel={handleCancelUnlink}
        type="delete"
      />

      {/* Toast component */}
      <Toast
        show={showToast}
        title={toastTitle}
        description={toastMessage}
        emoji={toastEmoji}
        onClose={() => setShowToast(false)}
      />
    </>
  );
}