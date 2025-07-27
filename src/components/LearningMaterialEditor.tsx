"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";

// Add import for date picker
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Add custom styles for dark mode
import "./editor-styles.css";

// Import the BlockNoteEditor component
import BlockNoteEditor from "./BlockNoteEditor";
import ConfirmationDialog from "./ConfirmationDialog";
import { TaskData } from "@/types";
import { safeLocalStorage } from "@/lib/utils/localStorage";

// Add import for ChatView
import ChatView from "./ChatView";
import { ChatMessage } from "../types/quiz";

// Add import for PublishConfirmationDialog
import PublishConfirmationDialog from "./PublishConfirmationDialog";

// Add import for NotionIntegration
import NotionIntegration from "./NotionIntegration";

// Add imports for Notion rendering
import { BlockList } from "@udus/notion-renderer/components";
import "@udus/notion-renderer/styles/globals.css";
import "katex/dist/katex.min.css";

// Add import for useAuth
import { useAuth } from "@/lib/auth";

// Define the editor handle with methods that can be called by parent components
export interface LearningMaterialEditorHandle {
    save: () => Promise<void>;
    cancel: () => void;
    hasContent: () => boolean;
    hasChanges: () => boolean;
}

interface LearningMaterialEditorProps {
    onChange?: (content: any[]) => void;
    isDarkMode?: boolean;
    className?: string;
    readOnly?: boolean;
    viewOnly?: boolean;
    showPublishConfirmation?: boolean;
    onPublishConfirm?: () => void;
    onPublishCancel?: () => void;
    taskId?: string;
    onPublishSuccess?: (updatedData?: TaskData) => void;
    onSaveSuccess?: (updatedData?: TaskData) => void;
    scheduledPublishAt?: string | null;
}

// Use forwardRef to pass the ref from parent to this component
const LearningMaterialEditor = forwardRef<LearningMaterialEditorHandle, LearningMaterialEditorProps>(({
    onChange,
    isDarkMode = true, // Default to dark mode
    className = "",
    readOnly = false,
    viewOnly = false,
    showPublishConfirmation = false,
    onPublishConfirm,
    onPublishCancel,
    taskId,
    onPublishSuccess,
    onSaveSuccess,
    scheduledPublishAt = null,
}, ref) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [taskData, setTaskData] = useState<TaskData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [editorContent, setEditorContent] = useState<any[]>([]);
    const [notionBlocks, setNotionBlocks] = useState<any[]>([]);
    const [isLoadingNotion, setIsLoadingNotion] = useState(false);
    const [integrationError, setIntegrationError] = useState<string | null>(null);
    const { user } = useAuth();
    const userId = user?.id;
    // Reference to the editor instance
    const editorRef = useRef<any>(null);

    // Add a ref to store the original data for reverting on cancel
    const originalDataRef = useRef<TaskData | null>(null);

    // Function to set the editor reference
    const setEditorInstance = (editor: any) => {
        editorRef.current = editor;
    };

    // Handle editor changes
    const handleEditorChange = (content: any[]) => {
        // Avoid unnecessary state updates if content hasn't changed
        if (JSON.stringify(content) !== JSON.stringify(editorContent)) {
            setEditorContent(content);
            if (onChange && !isPublishing) {
                onChange(content);
            }
        }
    };

    const initialContent = editorContent && editorContent.length > 0
        ? editorContent.filter(
            (block) =>
                block &&
                typeof block === "object" &&
                typeof block.type === "string" &&
                block.type !== "integration"
        )
        : undefined;

    // Function to fetch and render Notion blocks
    const fetchAndRenderNotionBlocks = async (integrationBlock: any) => {
        try {
            setIsLoadingNotion(true);
            setIntegrationError(null); // Clear previous errors

            if (!userId) {
                setIntegrationError('User ID not found. Please contact your mentor.');
                return;
            }

            // Get the user's integrations to find the Notion access token
            const integrationRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/?user_id=${userId}`);
            if (!integrationRes.ok) {
                setIntegrationError('Notion integration not found. Please reconnect your Notion account.');
                return;
            }
            const integrations = await integrationRes.json();
            const notionIntegration = integrations.find((integration: any) => integration.integration_type === 'notion');
            const accessToken = notionIntegration?.access_token;

            if (!notionIntegration) {
                setIntegrationError('Notion integration not found. Please reconnect your Notion account.');
                return;
            }

            if (!accessToken) {
                setIntegrationError('Notion access token is missing. Please reconnect your Notion account.');
                return;
            }

            // Fetch the Notion page content using the access token
            const notionResponse = await fetch(`/api/notion/fetchPage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId: integrationBlock.props.resource_id,
                    token: accessToken
                }),
            });

            if (!notionResponse.ok) {
                setIntegrationError('Failed to fetch Notion page content');
                return;
            }

            const notionData = await notionResponse.json();

            // Check if the result is successful
            if (notionData.ok && notionData.data) {
                setNotionBlocks(notionData.data);
            } else {
                setIntegrationError('Failed to get Notion blocks from response');
            }
        } catch (error) {
            setIntegrationError('Error fetching Notion blocks');
        } finally {
            setIsLoadingNotion(false);
        }
    };

    // Check for integration blocks and fetch Notion content
    useEffect(() => {
        if (editorContent.length > 0) {
            const integrationBlock = editorContent.find(block => block.type === 'integration');
            if (integrationBlock && integrationBlock.props.integration_type === 'notion') {
                fetchAndRenderNotionBlocks(integrationBlock);
            } else {
                setNotionBlocks([]);
                setIntegrationError(null); // Clear errors when no integration blocks
            }
        } else {
            setNotionBlocks([]);
            setIntegrationError(null); // Clear errors when no content
        }
    }, [editorContent]);

    // Fetch task data when taskId changes
    useEffect(() => {
        if (taskId) {
            setIsLoading(true);

            // Use AbortController to cancel any in-flight requests
            const controller = new AbortController();

            fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}`, {
                signal: controller.signal
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch task: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // We only use the data fetched from our own API call
                    // Title updates only happen after publishing, not during editing
                    if (!data.blocks || data.blocks.length === 0) {
                        data.blocks = [];
                    }

                    setTaskData(data);

                    // Store the original data for reverting on cancel
                    originalDataRef.current = { ...data };

                    // Initialize editorContent with the blocks from taskData
                    if (data.blocks && data.blocks.length > 0) {
                        setEditorContent(data.blocks);
                    }

                    setIsLoading(false);
                })
                .catch(error => {
                    // Ignore AbortError as it's expected when navigating away
                    if (error.name !== 'AbortError') {
                        console.error("Error fetching task data:", error);
                    }
                    setIsLoading(false);
                });

            // Clean up function will abort the fetch if the component unmounts
            // or if the effect runs again (i.e., taskId changes)
            return () => {
                controller.abort();
            };
        } else {
            // If no taskId is provided, set loading to false immediately
            // so the component can render the editor
            setIsLoading(false);
        }
    }, [taskId]);

    // Handle cancel in edit mode - revert to original data
    const handleCancel = () => {
        if (!originalDataRef.current) return;

        // Restore the original data
        setTaskData(originalDataRef.current);

        // Return the original title to the dialog header
        const dialogTitleElement = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
        if (dialogTitleElement && originalDataRef.current.title) {
            dialogTitleElement.textContent = originalDataRef.current.title;
        }
    };

    const handleConfirmPublish = async (scheduledPublishAt: string | null) => {
        if (!taskId) {
            console.error("Cannot publish: taskId is not provided");
            setPublishError("Cannot publish: Task ID is missing");
            return;
        }

        setIsPublishing(true);
        setPublishError(null);

        try {
            // Get the current title from the dialog - it may have been edited
            const dialogTitleElement = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
            const currentTitle = dialogTitleElement?.textContent || taskData?.title || "";

            // Use the current editor content
            const currentContent = editorContent.length > 0 ? editorContent : (taskData?.blocks || []);

            // Add scheduled publishing data if selected
            const publishData: any = {
                title: currentTitle,
                blocks: currentContent,
                scheduled_publish_at: scheduledPublishAt
            };

            // Make POST request to publish the learning material content
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}/learning_material`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(publishData),
            });

            if (!response.ok) {
                throw new Error(`Failed to publish learning material: ${response.status}`);
            }

            // Get the updated task data from the response
            const updatedTaskData = await response.json();

            // Ensure the status is set correctly based on scheduled status
            const publishedTaskData = {
                ...updatedTaskData,
                status: 'published',
                title: currentTitle,   // Use the current title from the dialog
                scheduled_publish_at: scheduledPublishAt // Include scheduled date
            };

            // Update our local state with the data from the API
            setTaskData(publishedTaskData);

            // First set publishing to false to avoid state updates during callbacks
            setIsPublishing(false);

            // Call the original onPublishConfirm callback if provided
            if (onPublishConfirm) {
                onPublishConfirm();
            }

            // Call the onPublishSuccess callback if provided
            if (onPublishSuccess) {
                // Use setTimeout to break the current render cycle
                setTimeout(() => {
                    onPublishSuccess(publishedTaskData);
                }, 0);
            }
        } catch (error) {
            console.error("Error publishing learning material:", error);
            setPublishError(error instanceof Error ? error.message : "Failed to publish learning material");
            setIsPublishing(false);
        }
    };

    const handleCancelPublish = () => {
        setPublishError(null);
        if (onPublishCancel) {
            onPublishCancel();
        }
    };

    // Handle Notion page selection
    const handleNotionPageSelect = async (pageId: string, pageTitle: string) => {
        try {
            setIntegrationError(null); // Clear any previous errors

            if (!userId) {
                console.error('User ID not provided');
                return;
            }

            // Get the user's integrations to find the Notion access token
            const integrationsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/?user_id=${userId}`);
            if (!integrationsResponse.ok) {
                console.error('Failed to fetch integrations');
                return;
            }

            const integrations = await integrationsResponse.json();
            const notionIntegration = integrations.find((integration: any) => integration.integration_type === 'notion');

            if (!notionIntegration) {
                console.error('No Notion integration found');
                return;
            }

            // Fetch the Notion page content using the access token
            const notionResponse = await fetch(`/api/notion/fetchPage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId: pageId,
                    token: notionIntegration.access_token
                }),
            });

            if (!notionResponse.ok) {
                console.error('Failed to fetch Notion page content');
                return;
            }

            const notionData = await notionResponse.json();

            // Check if the Notion page has content
            if (!notionData.ok || !notionData.data || notionData.data.length === 0) {
                console.log('Notion page is empty, using default content');
                // If Notion page is empty, use default content instead
                const defaultContent = [
                    {
                        type: "paragraph",
                        content: [{ "text": `Content from Notion page: ${pageTitle}`, "type": "text", styles: {} }]
                    },
                    {
                        type: "paragraph",
                        content: [{ "text": "This page appears to be empty or doesn't have any content to display.", "type": "text", styles: {} }]
                    }
                ];

                setEditorContent(defaultContent);
                setNotionBlocks([]);

                // Update the editor instance if available
                if (editorRef.current && editorRef.current.replaceBlocks) {
                    try {
                        editorRef.current.replaceBlocks(editorRef.current.document, defaultContent);
                    } catch (error) {
                        console.error('Error replacing blocks:', error);
                        if (editorRef.current.setContent) {
                            editorRef.current.setContent(defaultContent);
                        }
                    }
                }

                if (onChange) {
                    onChange(defaultContent);
                }
                return;
            }

            // Create the integration block
            const integrationBlock = {
                type: "integration",
                props: {
                    integration_id: notionIntegration.id,
                    resource_id: pageId,
                    resource_type: "page",
                    integration_type: "notion",
                },
                id: `notion-integration-${Date.now()}`,
                position: 0
            };

            // Replace all existing content with just the integration block
            const newContent = [integrationBlock];

            // Update the editor content
            setEditorContent(newContent);

            console.log('newContent: ', newContent);

            // Update the editor instance if available
            if (editorRef.current && editorRef.current.replaceBlocks) {
                try {
                    editorRef.current.replaceBlocks(editorRef.current.document, newContent);
                } catch (error) {
                    console.error('Error replacing blocks:', error);
                    if (editorRef.current.setContent) {
                        editorRef.current.setContent(newContent);
                    }
                }
            }

            // Call onChange if provided
            if (onChange) {
                onChange(newContent);
            }

            console.log('Successfully replaced content with Notion integration block:', integrationBlock);

        } catch (error) {
            console.error('Error handling Notion page selection:', error);
            // Fallback to default content on error
            const fallbackContent = [
                {
                    type: "paragraph",
                    content: [{ "text": "Error loading Notion content. Please try again.", "type": "text", styles: {} }]
                }
            ];
            setEditorContent(fallbackContent);
            setNotionBlocks([]);

            if (onChange) {
                onChange(fallbackContent);
            }
        }
    };

    // Handle Notion page removal
    const handleNotionPageRemove = () => {
        setIntegrationError(null); // Clear any Notion errors

        // Set valid default content instead of empty content
        const defaultContent = [
            {
                type: "paragraph",
                content: [{ "text": "", "type": "text", styles: {} }]
            }
        ];

        setEditorContent(defaultContent);
        setNotionBlocks([]);

        // Update the editor instance if available
        if (editorRef.current && editorRef.current.replaceBlocks) {
            try {
                editorRef.current.replaceBlocks(editorRef.current.document, defaultContent);
            } catch (error) {
                console.error('Error replacing blocks:', error);
                // Fallback: try to set content directly
                if (editorRef.current.setContent) {
                    editorRef.current.setContent(defaultContent);
                }
            }
        }

        // Call onChange if provided
        if (onChange) {
            onChange(defaultContent);
        }
    };

    // Handle saving changes when in edit mode
    const handleSave = async () => {
        if (!taskId) {
            console.error("Cannot save: taskId is not provided");
            return;
        }

        try {
            // Get the current title from the dialog - it may have been edited
            const dialogTitleElement = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
            const currentTitle = dialogTitleElement?.textContent || taskData?.title || "";

            // Use the current editor content
            const currentContent = editorContent.length > 0 ? editorContent : (taskData?.blocks || []);

            // Use the scheduledPublishAt prop instead of taskData.scheduled_publish_at
            const currentScheduledPublishAt = scheduledPublishAt !== undefined ? scheduledPublishAt : (taskData?.scheduled_publish_at || null);

            // Make POST request to update the learning material content, keeping the same status
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}/learning_material`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: currentTitle,
                    blocks: currentContent,
                    scheduled_publish_at: currentScheduledPublishAt,
                    status: taskData?.status
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to save learning material: ${response.status}`);
            }

            // Get the updated task data from the response
            const updatedTaskData = await response.json();

            // Create updated data with the current title
            const updatedData = {
                ...updatedTaskData,
                title: currentTitle // Use the current title from the dialog
            };

            // Update our local state with the data from the API
            setTaskData(updatedData);

            // Call the onSaveSuccess callback if provided
            if (onSaveSuccess) {
                // Use setTimeout to break the current render cycle
                setTimeout(() => {
                    onSaveSuccess(updatedData);
                }, 0);
            }
        } catch (error) {
            console.error("Error saving learning material:", error);
        }
    };

    // Update the content when it changes
    useEffect(() => {
        if (onChange && taskData?.blocks) {
            onChange(taskData.blocks);
        }
    }, [taskData?.blocks, onChange]);

    // Expose methods via the forwarded ref
    useImperativeHandle(ref, () => ({
        save: handleSave,
        cancel: handleCancel,
        hasContent: () => {
            // First check the editorContent state
            const checkContent = (content: any[] | undefined) => {
                if (!content || content.length === 0) return false;

                // Check if there are any blocks beyond the first default paragraph
                if (content.length > 1) return true;

                // If there's only one block, check if it has actual content
                if (content.length === 1) {
                    const block = content[0];

                    if (block.type === 'integration') {
                        return true;
                    }

                    // Use stringify to check if it has actual content
                    const blockContent = JSON.stringify(block.content);
                    // Check if it's not just an empty paragraph
                    if (blockContent &&
                        blockContent !== '{}' &&
                        blockContent !== '[]' &&
                        blockContent !== 'null' &&
                        blockContent !== '{"text":[]}' &&
                        blockContent !== '{"text":""}') {
                        return true;
                    }
                }

                return false;
            };

            // First check editorContent (which might be updated if user made changes)
            if (checkContent(editorContent)) {
                return true;
            }

            // Check if we have Notion blocks (which means we have content)
            if (notionBlocks.length > 0) {
                return true;
            }

            // If editorContent is empty but we have taskData, check that as a fallback
            if (taskData?.blocks) {
                return checkContent(taskData.blocks);
            }

            return false;
        },
        hasChanges: () => {
            // If we don't have original data to compare with, assume no changes
            if (!originalDataRef.current) return false;

            // Check if title has changed
            const dialogTitleElement = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
            const currentTitle = dialogTitleElement?.textContent || "";
            const originalTitle = originalDataRef.current.title || "";

            if (currentTitle !== originalTitle) {
                return true;
            }

            if (notionBlocks.length > 0) {
                return true;
            }

            // Check if content has changed
            const originalContent = originalDataRef.current.blocks || [];

            // Convert both to JSON strings for deep comparison
            const currentContentStr = JSON.stringify(editorContent);
            const originalContentStr = JSON.stringify(originalContent);

            // Return true if there are changes
            return currentContentStr !== originalContentStr;
        }
    }));

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div
                    data-testid="editor-loading-spinner"
                    className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"
                    aria-label="Loading..."
                >
                </div>
            </div>
        );
    }

    return (
        <div className={`w-full h-full ${className}`}>
            <div className="w-full flex flex-col my-4">
                {/* Notion Integration */}
                {!readOnly && (
                    <div className="mb-4">
                        <NotionIntegration
                            onPageSelect={handleNotionPageSelect}
                            onPageRemove={handleNotionPageRemove}
                            isEditMode={!readOnly}
                            editorContent={editorContent}
                        />
                    </div>
                )}

                <div className={`editor-container h-full min-h-screen overflow-y-auto overflow-hidden relative z-0`}>
                    {isLoadingNotion ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                        </div>
                    ) : integrationError ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                            <div className="text-red-400 text-sm mb-4">
                                {integrationError}
                            </div>
                            <div className="text-gray-400 text-xs">
                                The Notion integration may have been disconnected. Please reconnect it.
                            </div>
                        </div>
                    ) : (
                        (notionBlocks.length > 0) ? (
                            <div className="bg-[#191919] text-white px-6 pb-6 rounded-lg">
                                <BlockList blocks={notionBlocks} />
                            </div>
                        ) : (
                            <BlockNoteEditor
                                initialContent={initialContent}
                                onChange={handleEditorChange}
                                isDarkMode={isDarkMode}
                                readOnly={readOnly}
                                className="dark-editor min-h-screen"
                                onEditorReady={setEditorInstance}
                            />
                        ))}
                </div>
            </div>

            {/* Replace the ConfirmationDialog with PublishConfirmationDialog */}
            <PublishConfirmationDialog
                show={showPublishConfirmation}
                title="Ready to publish?"
                message="Make sure your content is complete and reviewed for errors before publishing"
                onConfirm={handleConfirmPublish}
                onCancel={handleCancelPublish}
                isLoading={isPublishing}
                errorMessage={publishError}
            />
        </div>
    );
});

// Add display name for better debugging
LearningMaterialEditor.displayName = 'LearningMaterialEditor';

export default LearningMaterialEditor;