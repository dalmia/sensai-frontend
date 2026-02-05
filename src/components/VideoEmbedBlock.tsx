"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";

// Supported platforms that require iframe embedding
// NOTE: When adding a new platform here, also add corresponding embed URL logic in getEmbedUrl()
const IFRAME_PLATFORMS = [
    'youtube.com',
    'youtu.be'
] as const;

// Check if URL requires iframe embedding
export function requiresIframeEmbed(url: string): boolean {
    if (!url) return false;
    return IFRAME_PLATFORMS.some(platform => url.includes(platform));
}

// Convert video URL to embed URL format
export function getEmbedUrl(url: string): string | null {
    if (!url) return null;

    try {
        // YouTube: youtube.com/watch?v=VIDEO_ID
        if (url.includes('youtube.com/watch')) {
            const videoId = new URL(url).searchParams.get('v');
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }

        // YouTube: youtu.be/VIDEO_ID
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split(/[?&]/)[0];
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }

        // YouTube: already an embed URL
        if (url.includes('youtube.com/embed/')) {
            return url;
        }
    } catch {
        // Invalid URL format
        return null;
    }

    return null;
}

export const VideoEmbedBlock = createReactBlockSpec(
    {
        type: "videoEmbed",
        propSchema: {
            textAlignment: defaultProps.textAlignment,
            backgroundColor: defaultProps.backgroundColor,
            url: {
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
            const { url, previewWidth } = props.block.props;
            const embedUrl = getEmbedUrl(url);

            if (!embedUrl) {
                if (url) {
                    queueMicrotask(() => {
                        window.dispatchEvent(new CustomEvent('invalidVideoUrl'));
                    });
                }
                return null;
            }

            return (
                <div
                    className="bn-file-block-content-wrapper bn-video-embed"
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
                            title="Video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
                </div>
            );
        },
    }
);

// Helper function to transform content - converts video blocks with embed URLs to videoEmbed blocks
export function transformContentForVideoEmbed(content: any[]): any[] {
    if (!content || !Array.isArray(content)) return content;

    return content.map(block => {
        // If this is a video block with a URL that requires iframe embedding, convert it
        if (block.type === "video" && block.props?.url && requiresIframeEmbed(block.props.url)) {
            return {
                ...block,
                type: "videoEmbed",
                props: {
                    textAlignment: block.props.textAlignment || "left",
                    backgroundColor: block.props.backgroundColor || "default",
                    url: block.props.url,
                    previewWidth: block.props.previewWidth || 512,
                },
            };
        }

        // Recursively transform children if present
        if (block.children && Array.isArray(block.children)) {
            return {
                ...block,
                children: transformContentForVideoEmbed(block.children),
            };
        }

        return block;
    });
}
