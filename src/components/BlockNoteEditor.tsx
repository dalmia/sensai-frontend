"use client";

import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useEffect, useRef, useState } from "react";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import Toast from "./Toast";

// Add custom styles for dark mode
import "./editor-styles.css";

interface BlockNoteEditorProps {
    initialContent?: any[];
    onChange?: (content: any[]) => void;
    isDarkMode?: boolean;
    className?: string;
    readOnly?: boolean;
    placeholder?: string;
    onEditorReady?: (editor: any) => void;
    allowMedia?: boolean;
}

// Uploads a file and returns the URL to the uploaded file
async function uploadFile(file: File) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
        return ''
    }

    let presigned_url = '';

    try {
        // First, get a presigned URL for the file
        const presignedUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/create`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content_type: file.type
            })
        });

        if (!presignedUrlResponse.ok) {
            throw new Error('Failed to get presigned URL');
        }

        const presignedData = await presignedUrlResponse.json();

        presigned_url = presignedData.presigned_url;
    } catch (error) {
        console.error("Error getting presigned URL for file:", error);
    }

    if (!presigned_url) {
        // If we couldn't get a presigned URL, try direct upload to the backend
        try {
            console.log("Attempting direct upload to backend");

            // Create FormData for the file upload
            const formData = new FormData();
            formData.append('file', file, file.name);
            formData.append('content_type', file.type);

            // Upload directly to the backend
            const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/upload-local`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload audio to backend: ${uploadResponse.status}`);
            }

            const uploadData = await uploadResponse.json();
            const file_static_path = uploadData.static_url;

            const static_url = `${process.env.NEXT_PUBLIC_BACKEND_URL}${file_static_path}`;

            console.log('File uploaded successfully to backend');

            return static_url;
        } catch (error) {
            console.error('Error with direct upload to backend:', error);
            throw error;
        }
    } else {
        // Upload the file to S3 using the presigned URL
        try {
            let fileBlob = new Blob([file], { type: file.type });

            // Upload to S3 using the presigned URL with WAV content type
            const uploadResponse = await fetch(presigned_url, {
                method: 'PUT',
                body: fileBlob,
                headers: {
                    'Content-Type': file.type
                }
            });

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload file to S3: ${uploadResponse.status}`);
            }

            console.log('File uploaded successfully to S3');
            // Update the request body with the file information
            return uploadResponse.url
        } catch (error) {
            console.error('Error uploading file to S3:', error);
            throw error;
        }
    }
}

async function resolveFileUrl(url: string) {
    if (!url || !url.includes("?X-Amz-Algorithm=AWS4-HMAC-SHA256")) {
        return url;
    }

    if (url.includes(`${process.env.NEXT_PUBLIC_BACKEND_URL}/`)) {
        return url;
    }

    let uuid = url.split('/').pop()?.split('.')[0] || '';
    let fileType = url.split('.').pop()?.split('?')[0] || '';

    try {
        // Get presigned URL
        const presignedResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/get?uuid=${uuid}&file_extension=${fileType}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!presignedResponse.ok) {
            throw new Error('Failed to get presigned URL for file');
        }

        const { url } = await presignedResponse.json();
        return url;
    } catch (error) {
        console.error('Error fetching file:', error);
    }
}

// Function to check if a URL is a YouTube link
function isYouTubeLink(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
}

export default function BlockNoteEditor({
    initialContent = [],
    onChange,
    isDarkMode = true, // Default to dark mode
    className = "",
    readOnly = false,
    placeholder = "Enter text or type '/' for commands",
    onEditorReady,
    allowMedia = true,
}: BlockNoteEditorProps) {
    const locale = en;
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const isUpdatingContent = useRef(false);
    const lastContent = useRef<any[]>([]);
    const editorRef = useRef<any>(null);

    // Replace the boolean showToast with a toast object
    const [toast, setToast] = useState({
        show: false,
        title: '',
        description: '',
        emoji: ''
    });

    // Add a timeout ref to store the timeout ID
    const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Extract blocks we don't want based on configuration
    let enabledBlocks;
    if (allowMedia) {
        // If media is allowed, exclude only these blocks
        const { table, file, ...allowedBlockSpecs } = defaultBlockSpecs;
        enabledBlocks = allowedBlockSpecs;
    } else {
        // If media is not allowed, also exclude all media blocks
        const { table, video, audio, file, image, ...allowedBlockSpecs } = defaultBlockSpecs;
        enabledBlocks = allowedBlockSpecs;
    }

    // Create a schema with only the allowed blocks
    const schema = BlockNoteSchema.create({
        blockSpecs: enabledBlocks,
    });

    // Creates a new editor instance with the custom schema
    const editor = useCreateBlockNote({
        initialContent: initialContent.length > 0 ? initialContent : undefined,
        uploadFile,
        resolveFileUrl,
        schema, // Use our custom schema with limited blocks
        dictionary: {
            ...locale,
            placeholders: {
                emptyDocument: placeholder,
            },
        },
    });

    // Store the editor instance in a ref for later use
    useEffect(() => {
        if (editor) {
            editorRef.current = editor;
        }
    }, [editor]);

    // Update the function to handle closing the toast
    const handleCloseToast = () => {
        setToast(prev => ({ ...prev, show: false }));

        // Clear any existing timeout
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
            toastTimeoutRef.current = null;
        }
    };

    // Update the effect that checks for YouTube links
    useEffect(() => {
        if (editor && allowMedia) {
            const handleVideoBlockChange = () => {
                // Skip checking during programmatic updates
                if (isUpdatingContent.current) return;

                // Get all video blocks
                const blocks = editor.document;

                blocks.forEach(block => {
                    // Check if this is a video block
                    // @ts-ignore - TypeScript doesn't recognize custom block types
                    if (block.type === "video") {
                        // Check if the URL is a YouTube link
                        // @ts-ignore - TypeScript doesn't recognize props on custom block types
                        const videoUrl = block.props?.url || "";
                        if (videoUrl && isYouTubeLink(videoUrl)) {
                            // Show toast with customized properties
                            setToast({
                                show: true,
                                title: "Cannot embed YouTube videos yet",
                                description: "Please use video file URLs (e.g. link to a mp4 file) instead",
                                emoji: "🚫"
                            });

                            // Clear any existing timeout
                            if (toastTimeoutRef.current) {
                                clearTimeout(toastTimeoutRef.current);
                            }

                            // Set a new timeout to auto-hide the toast after 5 seconds
                            toastTimeoutRef.current = setTimeout(() => {
                                setToast(prev => ({ ...prev, show: false }));
                            }, 5000);
                        }
                    }
                });
            };

            // Listen for content changes to detect YouTube links
            editor.onEditorContentChange(handleVideoBlockChange);

            // Cleanup function to clear timeout when component unmounts
            return () => {
                if (toastTimeoutRef.current) {
                    clearTimeout(toastTimeoutRef.current);
                }
            };
        }
    }, [editor, allowMedia]);

    // Provide the editor instance to the parent component if onEditorReady is provided
    useEffect(() => {
        if (onEditorReady && editor) {
            onEditorReady(editor);
        }
    }, [editor, onEditorReady]);

    // Update editor content when initialContent changes
    useEffect(() => {
        if (editor && initialContent && initialContent.length > 0) {
            // Set flag to prevent triggering onChange during programmatic update
            isUpdatingContent.current = true;

            try {
                // Only replace blocks if the content has actually changed
                const currentContentStr = JSON.stringify(editor.document);
                const newContentStr = JSON.stringify(initialContent);

                if (currentContentStr !== newContentStr) {
                    editor.replaceBlocks(editor.document, initialContent);
                    lastContent.current = initialContent;
                }
            } catch (error) {
                console.error("Error updating editor content:", error);
            } finally {
                // Reset flag after update
                isUpdatingContent.current = false;
            }
        }
    }, [editor, initialContent]);

    // Handle content changes with debouncing to avoid rapid state updates
    useEffect(() => {
        if (onChange && editor) {
            const handleChange = () => {
                // Prevent handling changes if we're currently updating content
                if (isUpdatingContent.current) return;

                const currentContent = editor.document;
                onChange(currentContent);
            };

            // Add change listener
            editor.onEditorContentChange(handleChange);
        }
    }, [editor, onChange]);

    // Add a method to focus the editor
    useEffect(() => {
        if (editor && editorRef.current) {
            // Add a focus method to the editor ref
            // Use a different name for the method to avoid potential name conflicts
            editorRef.current.focusEditor = () => {
                try {
                    // Check if we're already focused to prevent recursion
                    const activeElement = document.activeElement;
                    const editorElement = editorContainerRef.current?.querySelector('[contenteditable="true"]');

                    // Only focus if we're not already focused
                    if (editorElement && activeElement !== editorElement) {
                        editor.focus();
                    }
                } catch (err) {
                    console.error("Error focusing editor:", err);
                }
            };
        }
    }, [editor]);

    // Add effect to handle clicks in the empty space of editor blocks
    useEffect(() => {
        if (editor && editorContainerRef.current && !readOnly) {
            const handleEditorClick = (e: MouseEvent) => {
                // Don't interfere with normal clicks on content
                const target = e.target as HTMLElement;

                // Check if we're clicking on the editor container but not on an actual block content
                const isEditorContainer = target.classList.contains('bn-block-content')

                if (isEditorContainer) {
                    // Find the closest block element to the click
                    const blockElements = editorContainerRef.current?.querySelectorAll('.bn-block');
                    if (!blockElements || blockElements.length === 0) return;

                    // Find the block at the click position
                    let closestBlock: Element | null = null;
                    let minDistance = Infinity;

                    blockElements.forEach(block => {
                        const rect = block.getBoundingClientRect();
                        // Check if the click is on the same line as this block (y-axis)
                        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                            const distance = Math.abs(e.clientY - (rect.top + rect.height / 2));
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestBlock = block;
                            }
                        }
                    });

                    if (closestBlock) {
                        // Explicitly reassert the type right where we need it
                        const block = closestBlock as HTMLElement;
                        // Get the editable element within the block
                        const editableContent = block.querySelector('.bn-inline-content') as HTMLElement;

                        if (editableContent) {
                            // Focus and place cursor at the end
                            editableContent.focus();

                            // Set selection to the end of the content
                            const range = document.createRange();
                            const sel = window.getSelection();

                            range.selectNodeContents(editableContent);
                            range.collapse(false); // false means collapse to end

                            if (sel) {
                                sel.removeAllRanges();
                                sel.addRange(range);
                            }

                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }
                }
            };

            const editorContainer = editorContainerRef.current;
            editorContainer.addEventListener('click', handleEditorClick);

            return () => {
                editorContainer.removeEventListener('click', handleEditorClick);
            };
        }
    }, [editor, readOnly]);

    return (
        <div
            ref={editorContainerRef}
            className={`h-full ${className}`}
            // Add click handler to prevent event propagation
            onClick={(e) => {
                e.stopPropagation();
            }}
            // Prevent mousedown from bubbling up which can cause focus issues
            onMouseDown={(e) => {
                e.stopPropagation();
            }}
        >
            <BlockNoteView
                editor={editor}
                theme={isDarkMode ? "dark" : "light"}
                className={isDarkMode ? "dark-editor" : ""}
                editable={!readOnly}
            />

            {/* Update Toast component to use the toast object */}
            <Toast
                show={toast.show}
                title={toast.title}
                description={toast.description}
                emoji={toast.emoji}
                onClose={handleCloseToast}
            />
        </div>
    );
} 