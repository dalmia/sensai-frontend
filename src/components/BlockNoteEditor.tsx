'use client';

import '@blocknote/core/fonts/inter.css';
import { createReactBlockSpec, useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useEffect, useRef, useState } from 'react';
import { BlockNoteSchema, defaultBlockSpecs, locales } from '@blocknote/core';
import Toast from './Toast';

// Add custom styles for dark mode
import './editor-styles.css';

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
        return '';
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
                content_type: file.type,
            }),
        });

        if (!presignedUrlResponse.ok) {
            throw new Error('Failed to get presigned URL');
        }

        const presignedData = await presignedUrlResponse.json();

        presigned_url = presignedData.presigned_url;
    } catch (error) {
        console.error('Error getting presigned URL for file:', error);
    }

    if (!presigned_url) {
        // If we couldn't get a presigned URL, try direct upload to the backend
        try {
            console.log('Attempting direct upload to backend');

            // Create FormData for the file upload
            const formData = new FormData();
            formData.append('file', file, file.name);
            formData.append('content_type', file.type);

            // Upload directly to the backend
            const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/upload-local`, {
                method: 'POST',
                body: formData,
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
                    'Content-Type': file.type,
                },
            });

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload file to S3: ${uploadResponse.status}`);
            }

            console.log('File uploaded successfully to S3');
            // Update the request body with the file information
            return uploadResponse.url;
        } catch (error) {
            console.error('Error uploading file to S3:', error);
            throw error;
        }
    }
}

async function resolveFileUrl(url: string) {
    if (!url || !url.includes('?X-Amz-Algorithm=AWS4-HMAC-SHA256')) {
        return url;
    }

    if (url.includes(`${process.env.NEXT_PUBLIC_BACKEND_URL}/`)) {
        return url;
    }

    let uuid = url.split('/').pop()?.split('.')[0] || '';
    let fileType = url.split('.').pop()?.split('?')[0] || '';

    try {
        // Get presigned URL
        const presignedResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/get?uuid=${uuid}&file_extension=${fileType}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

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

// Function to get embedded youtube url
function getYouTubeEmbedUrl(url: string): string {
    let videoId = '';
    const youtubeMatch = url.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([\w-]{11})/
    );
    if (youtubeMatch && youtubeMatch[1]) {
        videoId = youtubeMatch[1];
    }
    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
}

export default function BlockNoteEditor({
    initialContent = [],
    onChange,
    isDarkMode = true, // Default to dark mode
    className = '',
    readOnly = false,
    placeholder = "Enter text or type '/' for commands",
    onEditorReady,
    allowMedia = true,
}: BlockNoteEditorProps) {
    const locale = locales['en'];
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const isUpdatingContent = useRef(false);
    const lastContent = useRef<any[]>([]);
    const editorRef = useRef<any>(null);

    // Replace the boolean showToast with a toast object
    const [toast, setToast] = useState({
        show: false,
        title: '',
        description: '',
        emoji: '',
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

    const CustomVideoBlock = createReactBlockSpec(defaultBlockSpecs.video.config, {
        render: (props) => {
            const url = props.block.props?.url || '';
            const caption = props.block.props?.caption || '';
            const previewWidth = props.block.props?.previewWidth || 512;

            if (!url) {
                return null;
            }

            if (isYouTubeLink(url)) {
                const embedUrl = getYouTubeEmbedUrl(url);
                return (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <iframe
                            width='560'
                            height='315'
                            src={embedUrl}
                            title='YouTube video player'
                            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                            allowFullScreen
                            style={{ maxWidth: '100%', borderRadius: 8 }}
                        />
                    </div>
                );
            }

            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <video controls src={url} style={{ maxWidth: previewWidth, borderRadius: 8 }} />
                    {caption && <div style={{ marginTop: 8, color: '#aaa', fontSize: 14 }}>{caption}</div>}
                </div>
            );
        },
    });

    // Create a schema with only the allowed blocks
    const schema = BlockNoteSchema.create({
        blockSpecs: { ...enabledBlocks, video: CustomVideoBlock },
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
                ...locale.placeholders,
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
        setToast((prev) => ({ ...prev, show: false }));

        // Clear any existing timeout
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
            toastTimeoutRef.current = null;
        }
    };

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

            // Prevent "flushSync" error by deferring replaceBlocks until after React render
            queueMicrotask(() => {
                try {
                    // Only replace blocks if the content has actually changed
                    const currentContentStr = JSON.stringify(editor.document);
                    const newContentStr = JSON.stringify(initialContent);

                    if (currentContentStr !== newContentStr) {
                        editor.replaceBlocks(editor.document, initialContent);
                        lastContent.current = initialContent;
                    }
                } catch (error) {
                    console.error('Error updating editor content:', error);
                } finally {
                    // Reset flag after update
                    isUpdatingContent.current = false;
                }
            });
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
                    console.error('Error focusing editor:', err);
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
                const isEditorContainer = target.classList.contains('bn-block-content');

                if (isEditorContainer) {
                    // Find the closest block element to the click
                    const blockElements = editorContainerRef.current?.querySelectorAll('.bn-block');
                    if (!blockElements || blockElements.length === 0) return;

                    // Find the block at the click position
                    let closestBlock: Element | null = null;
                    let minDistance = Infinity;

                    blockElements.forEach((block) => {
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
            className={`h-full dark-editor-container ${className}`}
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
                theme={isDarkMode ? 'dark' : 'light'}
                className={isDarkMode ? 'dark-editor' : ''}
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
