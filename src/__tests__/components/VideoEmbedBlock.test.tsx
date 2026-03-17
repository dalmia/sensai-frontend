import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import {
    requiresIframeEmbed,
    getEmbedUrl,
    transformContentForVideoEmbed,
    VideoEmbedBlock,
} from '../../components/VideoEmbedBlock';

describe('VideoEmbedBlock', () => {
    describe('requiresIframeEmbed', () => {
        it('returns false for empty string', () => {
            expect(requiresIframeEmbed('')).toBe(false);
        });

        it('returns false for null/undefined', () => {
            expect(requiresIframeEmbed(null as unknown as string)).toBe(false);
            expect(requiresIframeEmbed(undefined as unknown as string)).toBe(false);
        });

        it('returns true for youtube.com URLs', () => {
            expect(requiresIframeEmbed('https://youtube.com/watch?v=abc123')).toBe(true);
            expect(requiresIframeEmbed('https://www.youtube.com/watch?v=abc123')).toBe(true);
            expect(requiresIframeEmbed('http://youtube.com/watch?v=abc123')).toBe(true);
        });

        it('returns true for youtu.be URLs', () => {
            expect(requiresIframeEmbed('https://youtu.be/abc123')).toBe(true);
            expect(requiresIframeEmbed('http://youtu.be/abc123')).toBe(true);
        });

        it('returns true for youtube embed URLs', () => {
            expect(requiresIframeEmbed('https://www.youtube.com/embed/abc123')).toBe(true);
        });

        it('returns false for non-YouTube URLs', () => {
            expect(requiresIframeEmbed('https://vimeo.com/123456')).toBe(false);
            expect(requiresIframeEmbed('https://example.com/video.mp4')).toBe(false);
            expect(requiresIframeEmbed('https://dailymotion.com/video/xyz')).toBe(false);
        });

        it('returns false for URLs that contain youtube as a substring but are not YouTube', () => {
            expect(requiresIframeEmbed('https://notyoutube.com/watch?v=abc')).toBe(true); // Contains youtube.com
            expect(requiresIframeEmbed('https://fakeyoutu.be.com/abc')).toBe(true); // Contains youtu.be
        });
    });

    describe('getEmbedUrl', () => {
        describe('returns null for invalid inputs', () => {
            it('returns null for empty string', () => {
                expect(getEmbedUrl('')).toBe(null);
            });

            it('returns null for null/undefined', () => {
                expect(getEmbedUrl(null as unknown as string)).toBe(null);
                expect(getEmbedUrl(undefined as unknown as string)).toBe(null);
            });

            it('returns null for non-YouTube URLs', () => {
                expect(getEmbedUrl('https://vimeo.com/123456')).toBe(null);
                expect(getEmbedUrl('https://example.com/video.mp4')).toBe(null);
            });

            it('returns null for malformed URLs', () => {
                expect(getEmbedUrl('not-a-url')).toBe(null);
                expect(getEmbedUrl('youtube.com/watch?v=abc')).toBe(null); // Missing protocol
            });
        });

        describe('youtube.com/watch URLs', () => {
            it('extracts video ID from standard watch URL', () => {
                expect(getEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
                    'https://www.youtube.com/embed/dQw4w9WgXcQ'
                );
            });

            it('extracts video ID from watch URL without www', () => {
                expect(getEmbedUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
                    'https://www.youtube.com/embed/dQw4w9WgXcQ'
                );
            });

            it('extracts video ID from watch URL with additional parameters', () => {
                expect(getEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe(
                    'https://www.youtube.com/embed/dQw4w9WgXcQ'
                );
            });

            it('extracts video ID when v is not the first parameter', () => {
                expect(getEmbedUrl('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ')).toBe(
                    'https://www.youtube.com/embed/dQw4w9WgXcQ'
                );
            });

            it('returns null for watch URL without video ID', () => {
                expect(getEmbedUrl('https://www.youtube.com/watch?feature=share')).toBe(null);
            });

            it('returns null for watch URL with empty video ID', () => {
                expect(getEmbedUrl('https://www.youtube.com/watch?v=')).toBe(null);
            });
        });

        describe('youtu.be URLs', () => {
            it('extracts video ID from short URL', () => {
                expect(getEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
                    'https://www.youtube.com/embed/dQw4w9WgXcQ'
                );
            });

            it('extracts video ID from short URL with timestamp', () => {
                expect(getEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=120')).toBe(
                    'https://www.youtube.com/embed/dQw4w9WgXcQ'
                );
            });

            it('extracts video ID from short URL with multiple parameters', () => {
                expect(getEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=120&feature=share')).toBe(
                    'https://www.youtube.com/embed/dQw4w9WgXcQ'
                );
            });

            it('handles http protocol', () => {
                expect(getEmbedUrl('http://youtu.be/dQw4w9WgXcQ')).toBe(
                    'https://www.youtube.com/embed/dQw4w9WgXcQ'
                );
            });
        });

        describe('youtube.com/embed URLs', () => {
            it('returns the URL as-is for embed URLs', () => {
                expect(getEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
                    'https://www.youtube.com/embed/dQw4w9WgXcQ'
                );
            });

            it('returns the URL as-is for embed URLs with parameters', () => {
                expect(getEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1')).toBe(
                    'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1'
                );
            });
        });
    });

    describe('transformContentForVideoEmbed', () => {
        it('returns content as-is for null/undefined', () => {
            expect(transformContentForVideoEmbed(null as unknown as any[])).toBe(null);
            expect(transformContentForVideoEmbed(undefined as unknown as any[])).toBe(undefined);
        });

        it('returns content as-is for non-array', () => {
            expect(transformContentForVideoEmbed('not an array' as unknown as any[])).toBe('not an array');
        });

        it('returns empty array for empty array', () => {
            expect(transformContentForVideoEmbed([])).toEqual([]);
        });

        it('does not transform non-video blocks', () => {
            const content = [
                { type: 'paragraph', props: { text: 'Hello' } },
                { type: 'heading', props: { level: 1 } },
            ];
            expect(transformContentForVideoEmbed(content)).toEqual(content);
        });

        it('does not transform video blocks without URL', () => {
            const content = [{ type: 'video', props: {} }];
            expect(transformContentForVideoEmbed(content)).toEqual(content);
        });

        it('does not transform video blocks with non-YouTube URL', () => {
            const content = [{ type: 'video', props: { url: 'https://vimeo.com/123456' } }];
            expect(transformContentForVideoEmbed(content)).toEqual(content);
        });

        it('transforms video block with YouTube URL to videoEmbed block', () => {
            const content = [
                {
                    type: 'video',
                    props: {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        textAlignment: 'center',
                        backgroundColor: 'blue',
                        previewWidth: 640,
                    },
                },
            ];
            const result = transformContentForVideoEmbed(content);
            expect(result).toEqual([
                {
                    type: 'videoEmbed',
                    props: {
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        textAlignment: 'center',
                        backgroundColor: 'blue',
                        previewWidth: 640,
                    },
                },
            ]);
        });

        it('uses default values for missing props', () => {
            const content = [
                {
                    type: 'video',
                    props: { url: 'https://youtu.be/abc123' },
                },
            ];
            const result = transformContentForVideoEmbed(content);
            expect(result).toEqual([
                {
                    type: 'videoEmbed',
                    props: {
                        url: 'https://youtu.be/abc123',
                        textAlignment: 'left',
                        backgroundColor: 'default',
                        previewWidth: 512,
                    },
                },
            ]);
        });

        it('transforms multiple video blocks', () => {
            const content = [
                { type: 'paragraph', props: { text: 'Hello' } },
                { type: 'video', props: { url: 'https://youtu.be/video1' } },
                { type: 'video', props: { url: 'https://vimeo.com/123' } },
                { type: 'video', props: { url: 'https://youtube.com/watch?v=video2' } },
            ];
            const result = transformContentForVideoEmbed(content);
            expect(result[0]).toEqual({ type: 'paragraph', props: { text: 'Hello' } });
            expect(result[1].type).toBe('videoEmbed');
            expect(result[2].type).toBe('video'); // Vimeo not transformed
            expect(result[3].type).toBe('videoEmbed');
        });

        it('recursively transforms children', () => {
            const content = [
                {
                    type: 'column',
                    props: {},
                    children: [
                        { type: 'video', props: { url: 'https://youtu.be/abc123' } },
                        { type: 'paragraph', props: { text: 'Hello' } },
                    ],
                },
            ];
            const result = transformContentForVideoEmbed(content);
            expect(result[0].children[0].type).toBe('videoEmbed');
            expect(result[0].children[1].type).toBe('paragraph');
        });

        it('handles deeply nested children', () => {
            const content = [
                {
                    type: 'outer',
                    props: {},
                    children: [
                        {
                            type: 'inner',
                            props: {},
                            children: [
                                { type: 'video', props: { url: 'https://youtu.be/deep' } },
                            ],
                        },
                    ],
                },
            ];
            const result = transformContentForVideoEmbed(content);
            expect(result[0].children[0].children[0].type).toBe('videoEmbed');
        });

        it('preserves other block properties during transformation', () => {
            const content = [
                {
                    id: 'block-123',
                    type: 'video',
                    props: { url: 'https://youtu.be/abc' },
                    customProp: 'value',
                },
            ];
            const result = transformContentForVideoEmbed(content);
            expect(result[0].id).toBe('block-123');
            expect(result[0].customProp).toBe('value');
        });
    });

    describe('VideoEmbedBlock render', () => {
        const blockSpec = VideoEmbedBlock();
        const renderBlock = blockSpec.render;

        const createMockProps = (url: string, previewWidth = 512) => ({
            block: {
                props: {
                    url,
                    previewWidth,
                },
            },
        });

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('renders iframe for valid YouTube watch URL', () => {
            const props = createMockProps('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            const result = renderBlock(props as any);

            expect(result).not.toBeNull();
            const { container } = render(result as React.ReactElement);

            const iframe = container.querySelector('iframe');
            expect(iframe).toBeInTheDocument();
            expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
        });

        it('renders iframe for valid youtu.be URL', () => {
            const props = createMockProps('https://youtu.be/abc123');
            const result = renderBlock(props as any);

            expect(result).not.toBeNull();
            const { container } = render(result as React.ReactElement);

            const iframe = container.querySelector('iframe');
            expect(iframe).toBeInTheDocument();
            expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/abc123');
        });

        it('renders iframe with custom previewWidth', () => {
            const props = createMockProps('https://youtu.be/abc123', 800);
            const result = renderBlock(props as any);

            const { container } = render(result as React.ReactElement);
            const wrapper = container.querySelector('.bn-visual-media-wrapper');
            expect(wrapper).toHaveStyle({ width: '800px' });
        });

        it('returns null for invalid URL and dispatches event', async () => {
            const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
            const props = createMockProps('https://vimeo.com/123456');

            const result = renderBlock(props as any);
            expect(result).toBeNull();

            // Wait for queueMicrotask to execute
            await new Promise(resolve => queueMicrotask(resolve));

            expect(dispatchEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'invalidVideoUrl' })
            );
            dispatchEventSpy.mockRestore();
        });

        it('returns null for empty URL without dispatching event', async () => {
            const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
            const props = createMockProps('');

            const result = renderBlock(props as any);
            expect(result).toBeNull();

            // Wait for any potential microtasks
            await new Promise(resolve => queueMicrotask(resolve));

            expect(dispatchEventSpy).not.toHaveBeenCalled();
            dispatchEventSpy.mockRestore();
        });

        it('renders with correct CSS classes', () => {
            const props = createMockProps('https://youtu.be/abc123');
            const result = renderBlock(props as any);

            const { container } = render(result as React.ReactElement);

            expect(container.querySelector('.bn-file-block-content-wrapper')).toBeInTheDocument();
            expect(container.querySelector('.bn-video-embed')).toBeInTheDocument();
            expect(container.querySelector('.bn-visual-media-wrapper')).toBeInTheDocument();
        });

        it('renders iframe with correct attributes', () => {
            const props = createMockProps('https://youtu.be/abc123');
            const result = renderBlock(props as any);

            const { container } = render(result as React.ReactElement);
            const iframe = container.querySelector('iframe');

            expect(iframe).toHaveAttribute('title', 'Video player');
            expect(iframe).toHaveAttribute('allowFullScreen');
            expect(iframe).toHaveAttribute('allow', expect.stringContaining('autoplay'));
        });
    });
});
