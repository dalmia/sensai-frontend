"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";

// Helper function to extract YouTube video ID from various URL formats
export function extractYouTubeVideoId(url: string): string | null {
    if (!url) return null;

    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\s?]+)/,
        /youtube\.com\/watch\?.*v=([^&\s]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

// Helper function to check if a URL is a YouTube link
export function isYouTubeUrl(url: string): boolean {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be');
}

// Create a YouTube embed block (separate from the default video block)
export const YouTubeBlock = createReactBlockSpec(
    {
        type: "youtube",
        propSchema: {
            textAlignment: defaultProps.textAlignment,
            backgroundColor: defaultProps.backgroundColor,
            url: {
                default: "",
            },
            caption: {
                default: "",
            },
            previewWidth: {
                default: 512,
            },
        },
        content: "none",
    },
    {
        render: (props) => {
            const { url, caption, previewWidth } = props.block.props;
            const videoId = extractYouTubeVideoId(url);

            if (!videoId) {
                return (
                    <div
                        className="bn-file-block-content-wrapper"
                        style={{
                            padding: "16px",
                            border: "1px dashed #ccc",
                            borderRadius: "8px",
                            textAlign: "center",
                            color: "#666"
                        }}
                    >
                        <span>Enter a valid YouTube URL</span>
                    </div>
                );
            }

            const embedUrl = `https://www.youtube.com/embed/${videoId}`;

            return (
                <div
                    className="bn-file-block-content-wrapper bn-youtube-embed"
                    contentEditable={false}
                    style={{ position: "relative", width: "fit-content" }}
                >
                    <div
                        className="bn-visual-media-wrapper"
                        style={{
                            position: "relative",
                            paddingBottom: "56.25%", // 16:9 aspect ratio
                            height: 0,
                            width: previewWidth || 512,
                            maxWidth: "100%",
                        }}
                    >
                        <iframe
                            src={embedUrl}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                borderRadius: "8px",
                                border: "none",
                            }}
                        />
                    </div>
                    {caption && (
                        <div
                            className="bn-file-caption"
                            style={{
                                marginTop: "8px",
                                fontSize: "14px",
                                color: "#666",
                                textAlign: "center",
                            }}
                        >
                            {caption}
                        </div>
                    )}
                </div>
            );
        },
    }
);

// Helper function to transform content - converts video blocks with YouTube URLs to youtube blocks
export function transformContentForYouTube(content: any[]): any[] {
    if (!content || !Array.isArray(content)) return content;

    return content.map(block => {
        // If this is a video block with a YouTube URL, convert it to a youtube block
        if (block.type === "video" && block.props?.url && isYouTubeUrl(block.props.url)) {
            return {
                ...block,
                type: "youtube",
                props: {
                    textAlignment: block.props.textAlignment || "left",
                    backgroundColor: block.props.backgroundColor || "default",
                    url: block.props.url,
                    caption: block.props.caption || "",
                    previewWidth: block.props.previewWidth || 512,
                },
            };
        }

        // Recursively transform children if present
        if (block.children && Array.isArray(block.children)) {
            return {
                ...block,
                children: transformContentForYouTube(block.children),
            };
        }

        return block;
    });
}
