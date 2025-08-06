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

// Add import for Integration
import NotionIntegration from "./NotionIntegration";

// Add imports for Notion rendering
import { BlockList } from "@udus/notion-renderer/components";
import "@udus/notion-renderer/styles/globals.css";
import "katex/dist/katex.min.css";

// Add import for useAuth
import { useAuth } from "@/lib/auth";

// Add import for shared Integration utilities
import {
    handleIntegrationPageSelection,
    handleIntegrationPageRemoval,
} from "@/lib/utils/integrationUtils";

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
    const [integrationBlocks, setIntegrationBlocks] = useState<any[]>([]);
    const [isLoadingIntegration, setIsLoadingIntegration] = useState(false);
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

    const currentIntegrationType = 'notion';
    const integrationBlock = editorContent.find(block => block.type === currentIntegrationType);
    
    const initialContent = integrationBlock ? undefined : editorContent;

    // handle integration blocks and editor instance clearing
    useEffect(() => {
        if (editorContent.length > 0) {
            if (integrationBlock && integrationBlock.content && integrationBlock.content.length > 0) {
                setIntegrationBlocks(integrationBlock.content);
            } else {
                setIntegrationBlocks([]);
            }
        }

        // Ensure editor instance is updated when content is cleared
        if (editorRef.current && editorContent.length === 0) {
            try {
                if (editorRef.current.replaceBlocks) {
                    editorRef.current.replaceBlocks(editorRef.current.document, []);
                } else if (editorRef.current.setContent) {
                    editorRef.current.setContent([]);
                }
            } catch (error) {
                console.error('Error clearing editor content:', error);
            }
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

    // Handle Integration page selection
    const handleIntegrationPageSelect = async (pageId: string, pageTitle: string) => {
        if (!userId) {
            console.error('User ID not provided');
            return;
        }

        setIsLoadingIntegration(true);
        setIntegrationError(null);

        try {
            return await handleIntegrationPageSelection(
                pageId,
                pageTitle,
                userId,
                'notion',
                (content) => {
                    setEditorContent(content);
                    if (onChange) {
                        onChange(content);
                    }
                },
                setIntegrationBlocks,
                (error) => {
                    setIntegrationError(error);
                }
            );
        } catch (error) {
            console.error('Error handling Integration page selection:', error);
        } finally {
            setIsLoadingIntegration(false);
        }
    };

    // Handle Integration page removal
    const handleIntegrationPageRemove = () => {
        setIntegrationError(null);

        handleIntegrationPageRemoval(
            (content) => {
                setEditorContent(content);
                setIntegrationBlocks([]);

                // Update the editor instance if available
                if (editorRef.current && editorRef.current.replaceBlocks) {
                    try {
                        editorRef.current.replaceBlocks(editorRef.current.document, content);
                    } catch (error) {
                        console.error('Error replacing blocks:', error);
                        // Fallback: try to set content directly
                        if (editorRef.current.setContent) {
                            editorRef.current.setContent(content);
                        }
                    }
                }

                // Call onChange if provided
                if (onChange) {
                    onChange(content);
                }
            },
            setIntegrationBlocks
        );
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

                if (integrationBlock && integrationBlocks.length === 0) {
                    return false;
                }

                // Check each block for actual content
                for (const block of content) {
                    if (block.type === currentIntegrationType) {
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

            // Check if we have integration blocks
            if (integrationBlocks.length > 0) {
                return true;
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

            if (integrationBlocks.length > 0) {
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
                {/* Integration */}
                {!readOnly && (
                    <div className="mb-4">
                        <NotionIntegration
                            onPageSelect={handleIntegrationPageSelect}
                            onPageRemove={handleIntegrationPageRemove}
                            isEditMode={!readOnly}
                            editorContent={editorContent}
                            loading={isLoadingIntegration}
                            onSaveDraft={handleSave}
                            status={taskData?.status}
                            storedBlocks={integrationBlocks}
                            onContentUpdate={(updatedContent) => {
                                setEditorContent(updatedContent);
                                setIntegrationBlocks(updatedContent.find(block => block.type === 'notion')?.content || []);
                                if (onChange) {
                                    onChange(updatedContent);
                                }
                            }}
                            onLoadingChange={setIsLoadingIntegration}
                        />
                    </div>
                )}

                <div className={`editor-container h-full min-h-screen overflow-y-auto overflow-hidden relative z-0`}>
                    {isLoadingIntegration ? (
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
                    ) : integrationBlocks.length > 0 ? (
                                <div className="bg-[#191919] text-white px-6 pb-6 rounded-lg">
                            <h1 className="text-white text-4xl font-bold mb-4 pl-0.5">{integrationBlock?.props?.resource_name}</h1>
                            <BlockList blocks={integrationBlocks} />
                        </div>
                    ) : integrationBlock ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="text-white text-lg mb-2">Notion page is empty</div>
                            <div className="text-white text-sm">Please add content to your Notion page and refresh to see changes</div>
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
                    )}
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