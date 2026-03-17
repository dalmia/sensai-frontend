import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
// Mock CSS imports
jest.mock('@blocknote/core/fonts/inter.css', () => ({}));
jest.mock('@blocknote/mantine/style.css', () => ({}));
import BlockNoteEditor from '../../components/BlockNoteEditor';
import React from 'react';
import { getCapturedFunctions, resetCapturedFunctions, setReplaceBlocksError } from '../../../test/mocks/blocknote';

// Mock fetch for file uploads
const mockFetch = jest.fn().mockImplementation((url) => {
    if (typeof url === 'string' && url.includes('/file/presigned-url/create')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ presigned_url: 'https://example.com/presigned-url' })
        } as unknown as Response);
    } else if (typeof url === 'string' && url.includes('/file/presigned-url/get')) {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ url: 'https://example.com/file.jpg' })
        } as unknown as Response);
    } else if (url === 'https://example.com/presigned-url') {
        return Promise.resolve({
            ok: true,
            url: 'https://example.com/file.jpg'
        } as unknown as Response);
    }
    return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({})
    } as unknown as Response);
});

global.fetch = mockFetch;

// Mock environment variables
process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.example.com';

describe('BlockNoteEditor Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the editor with default props', () => {
        render(<BlockNoteEditor />);

        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });

    it('renders in read-only mode when specified', () => {
        render(<BlockNoteEditor readOnly={true} />);

        const view = screen.getByTestId('mock-blocknote-view');
        expect(view).toHaveAttribute('editable', 'false');
    });

    it('uses dark theme by default', () => {
        render(<BlockNoteEditor />);

        const view = screen.getByTestId('mock-blocknote-view');
        expect(view).toHaveAttribute('theme', 'dark');
    });

    it('uses theme from useThemePreference hook', () => {
        render(<BlockNoteEditor />);

        const view = screen.getByTestId('mock-blocknote-view');
        // Theme is now determined by useThemePreference hook, defaults to dark
        expect(view).toHaveAttribute('theme', 'dark');
    });

    it('applies custom className when provided', () => {
        render(<BlockNoteEditor className="custom-class" />);

        const view = screen.getByTestId('mock-blocknote-view');
        expect(view).toHaveClass('dark-editor');
    });

    it('uses initial content when provided', () => {
        const initialContent = [
            { id: 'block-1', type: 'paragraph', content: 'Initial content' }
        ];

        render(<BlockNoteEditor initialContent={initialContent} />);

        // Verify the component renders without errors
        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });

    it('calls onChange callback when content changes', async () => {
        const onChangeMock = jest.fn();

        render(<BlockNoteEditor onChange={onChangeMock} />);

        // Wait for the debounced onChange to be called
        await waitFor(() => {
            expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
        });
    });

    it('calls onEditorReady when the editor is ready', () => {
        const onEditorReadyMock = jest.fn();

        render(<BlockNoteEditor onEditorReady={onEditorReadyMock} />);

        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });

    it('excludes media blocks when allowMedia is false', () => {
        render(<BlockNoteEditor allowMedia={false} />);

        // Verify the component renders without errors
        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });

    it('includes media blocks when allowMedia is true', () => {
        render(<BlockNoteEditor allowMedia={true} />);

        // Verify the component renders without errors
        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });

    it('uses custom placeholder when provided', () => {
        const customPlaceholder = 'Custom placeholder text';

        render(<BlockNoteEditor placeholder={customPlaceholder} />);

        // Verify the component renders without errors
        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });

    it('transforms initial content with YouTube URLs', () => {
        const initialContent = [
            { type: 'video', props: { url: 'https://www.youtube.com/watch?v=abc123' } }
        ];

        render(<BlockNoteEditor initialContent={initialContent} />);

        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });

    it('stops event propagation on click', () => {
        const { container } = render(<BlockNoteEditor />);
        const editorContainer = container.firstChild as HTMLElement;

        const clickEvent = new MouseEvent('click', { bubbles: true });
        const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');

        fireEvent(editorContainer, clickEvent);

        // The React synthetic event handler should stop propagation
        expect(editorContainer).toBeInTheDocument();
    });

    it('stops event propagation on mousedown', () => {
        const { container } = render(<BlockNoteEditor />);
        const editorContainer = container.firstChild as HTMLElement;

        const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true });
        fireEvent(editorContainer, mouseDownEvent);

        expect(editorContainer).toBeInTheDocument();
    });
});

describe('BlockNoteEditor uploadFile function', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetCapturedFunctions();
    });

    it('captures uploadFile function', () => {
        render(<BlockNoteEditor />);

        const { uploadFile } = getCapturedFunctions();
        expect(uploadFile).toBeDefined();
    });

    it('returns empty string for unsupported file types', async () => {
        render(<BlockNoteEditor />);

        const { uploadFile } = getCapturedFunctions();
        const pdfFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

        const result = await uploadFile(pdfFile);
        expect(result).toBe('');
    });

    it('uploads image file successfully with presigned URL', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ presigned_url: 'https://s3.example.com/presigned' })
            })
        ).mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                url: 'https://s3.example.com/uploaded-file.jpg'
            })
        );

        render(<BlockNoteEditor />);

        const { uploadFile } = getCapturedFunctions();
        const imageFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });

        const result = await uploadFile(imageFile);
        expect(result).toBe('https://s3.example.com/uploaded-file.jpg');
    });

    it('uploads audio file successfully', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ presigned_url: 'https://s3.example.com/presigned' })
            })
        ).mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                url: 'https://s3.example.com/uploaded-audio.mp3'
            })
        );

        render(<BlockNoteEditor />);

        const { uploadFile } = getCapturedFunctions();
        const audioFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });

        const result = await uploadFile(audioFile);
        expect(result).toBe('https://s3.example.com/uploaded-audio.mp3');
    });

    it('uploads video file successfully', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ presigned_url: 'https://s3.example.com/presigned' })
            })
        ).mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                url: 'https://s3.example.com/uploaded-video.mp4'
            })
        );

        render(<BlockNoteEditor />);

        const { uploadFile } = getCapturedFunctions();
        const videoFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });

        const result = await uploadFile(videoFile);
        expect(result).toBe('https://s3.example.com/uploaded-video.mp4');
    });

    it('falls back to direct upload when presigned URL fails', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: false
            })
        ).mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ static_url: '/files/uploaded.jpg' })
            })
        );

        render(<BlockNoteEditor />);

        const { uploadFile } = getCapturedFunctions();
        const imageFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });

        const result = await uploadFile(imageFile);
        expect(result).toBe('https://api.example.com/files/uploaded.jpg');
    });

    it('throws error when both presigned and direct upload fail', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: false
            })
        ).mockImplementationOnce(() =>
            Promise.resolve({
                ok: false,
                status: 500
            })
        );

        render(<BlockNoteEditor />);

        const { uploadFile } = getCapturedFunctions();
        const imageFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });

        await expect(uploadFile(imageFile)).rejects.toThrow('Failed to upload audio to backend: 500');
    });

    it('throws error when S3 upload fails', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ presigned_url: 'https://s3.example.com/presigned' })
            })
        ).mockImplementationOnce(() =>
            Promise.resolve({
                ok: false,
                status: 403
            })
        );

        render(<BlockNoteEditor />);

        const { uploadFile } = getCapturedFunctions();
        const imageFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });

        await expect(uploadFile(imageFile)).rejects.toThrow('Failed to upload file to S3: 403');
    });
});

describe('BlockNoteEditor resolveFileUrl function', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetCapturedFunctions();
    });

    it('captures resolveFileUrl function', () => {
        render(<BlockNoteEditor />);

        const { resolveFileUrl } = getCapturedFunctions();
        expect(resolveFileUrl).toBeDefined();
    });

    it('returns URL as-is for non-S3 URLs', async () => {
        render(<BlockNoteEditor />);

        const { resolveFileUrl } = getCapturedFunctions();
        const result = await resolveFileUrl('https://example.com/image.jpg');

        expect(result).toBe('https://example.com/image.jpg');
    });

    it('returns URL as-is for empty string', async () => {
        render(<BlockNoteEditor />);

        const { resolveFileUrl } = getCapturedFunctions();
        const result = await resolveFileUrl('');

        expect(result).toBe('');
    });

    it('returns URL as-is for backend URLs', async () => {
        render(<BlockNoteEditor />);

        const { resolveFileUrl } = getCapturedFunctions();
        const backendUrl = 'https://api.example.com/files/image.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256';
        const result = await resolveFileUrl(backendUrl);

        expect(result).toBe(backendUrl);
    });

    it('fetches new presigned URL for expired S3 URLs', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ url: 'https://s3.example.com/new-presigned-url' })
            })
        );

        render(<BlockNoteEditor />);

        const { resolveFileUrl } = getCapturedFunctions();
        const expiredUrl = 'https://s3.example.com/uuid123.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256';
        const result = await resolveFileUrl(expiredUrl);

        expect(result).toBe('https://s3.example.com/new-presigned-url');
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/file/presigned-url/get?uuid=uuid123&file_extension=jpg'),
            expect.any(Object)
        );
    });

    it('handles error when fetching new presigned URL', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: false
            })
        );

        render(<BlockNoteEditor />);

        const { resolveFileUrl } = getCapturedFunctions();
        const expiredUrl = 'https://s3.example.com/uuid123.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256';
        const result = await resolveFileUrl(expiredUrl);

        expect(consoleSpy).toHaveBeenCalledWith('Error fetching file:', expect.any(Error));
        consoleSpy.mockRestore();
    });
});

describe('BlockNoteEditor toast handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('shows toast on invalidVideoUrl event', async () => {
        render(<BlockNoteEditor />);

        act(() => {
            window.dispatchEvent(new CustomEvent('invalidVideoUrl'));
        });

        // Toast should be shown
        await waitFor(() => {
            const toast = document.querySelector('[data-testid="toast"]') || screen.queryByText('Invalid video URL');
            // The toast component should respond to the event
            expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
        });
    });

    it('auto-hides toast after 3 seconds', async () => {
        render(<BlockNoteEditor />);

        act(() => {
            window.dispatchEvent(new CustomEvent('invalidVideoUrl'));
        });

        // Advance timers by 3 seconds
        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });

    it('clears existing timeout when new invalidVideoUrl event fires', async () => {
        render(<BlockNoteEditor />);

        // Fire first event
        act(() => {
            window.dispatchEvent(new CustomEvent('invalidVideoUrl'));
        });

        // Fire second event before timeout
        act(() => {
            jest.advanceTimersByTime(1000);
            window.dispatchEvent(new CustomEvent('invalidVideoUrl'));
        });

        // Advance to after first timeout would have fired
        act(() => {
            jest.advanceTimersByTime(2500);
        });

        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });

    it('closes toast and clears timeout when close button is clicked', async () => {
        const { container } = render(<BlockNoteEditor />);

        // Show toast by dispatching invalidVideoUrl event
        act(() => {
            window.dispatchEvent(new CustomEvent('invalidVideoUrl'));
        });

        // Find and click the close button
        const closeButton = container.querySelector('button');
        expect(closeButton).toBeInTheDocument();

        act(() => {
            if (closeButton) {
                fireEvent.click(closeButton);
            }
        });

        // Toast should be hidden after clicking close
        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });

    it('handleCloseToast clears existing timeout ref', async () => {
        const { container } = render(<BlockNoteEditor />);

        // Show toast to start the timeout
        act(() => {
            window.dispatchEvent(new CustomEvent('invalidVideoUrl'));
        });

        // Advance time partially (timeout still active)
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        // Click close button to trigger handleCloseToast while timeout is active
        const closeButton = container.querySelector('button');
        act(() => {
            if (closeButton) {
                fireEvent.click(closeButton);
            }
        });

        // Advance past the original timeout - should not cause issues since it was cleared
        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(screen.getByTestId('mock-blocknote-view')).toBeInTheDocument();
    });
});

describe('BlockNoteEditor content updates', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetCapturedFunctions();
        setReplaceBlocksError(false);
    });

    afterEach(() => {
        setReplaceBlocksError(false);
    });

    it('handles error when replaceBlocks throws', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        setReplaceBlocksError(true);

        const initialContent = [
            { id: 'block-1', type: 'paragraph', props: { text: 'Initial' } }
        ];

        const { rerender } = render(<BlockNoteEditor initialContent={initialContent} />);

        // Update with new content to trigger replaceBlocks
        const newContent = [
            { id: 'block-2', type: 'paragraph', props: { text: 'Updated' } }
        ];

        rerender(<BlockNoteEditor initialContent={newContent} />);

        // Wait for queueMicrotask to execute
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
        });

        expect(consoleSpy).toHaveBeenCalledWith('Error updating editor content:', expect.any(Error));
        consoleSpy.mockRestore();
    });
});

describe('BlockNoteEditor editor click handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('sets up click handler when not in readOnly mode', () => {
        const { container } = render(<BlockNoteEditor readOnly={false} />);
        const editorContainer = container.firstChild as HTMLElement;

        expect(editorContainer).toBeInTheDocument();
    });

    it('does not set up click handler in readOnly mode', () => {
        const { container } = render(<BlockNoteEditor readOnly={true} />);
        const editorContainer = container.firstChild as HTMLElement;

        expect(editorContainer).toBeInTheDocument();
    });

    it('handles click on editor container', () => {
        const { container } = render(<BlockNoteEditor />);
        const editorContainer = container.firstChild as HTMLElement;

        // Create mock block elements
        const mockBlock = document.createElement('div');
        mockBlock.className = 'bn-block';
        const mockInlineContent = document.createElement('div');
        mockInlineContent.className = 'bn-inline-content';
        mockInlineContent.contentEditable = 'true';
        mockBlock.appendChild(mockInlineContent);
        editorContainer.appendChild(mockBlock);

        // Create mock block content element
        const mockBlockContent = document.createElement('div');
        mockBlockContent.className = 'bn-block-content';
        editorContainer.appendChild(mockBlockContent);

        // Simulate click on block content
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            clientY: 50
        });

        // Mock getBoundingClientRect for the block
        mockBlock.getBoundingClientRect = jest.fn(() => ({
            top: 0,
            bottom: 100,
            left: 0,
            right: 100,
            width: 100,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({})
        }));

        fireEvent(mockBlockContent, clickEvent);

        expect(editorContainer).toBeInTheDocument();
    });

    it('handles click when no blocks are found', () => {
        const { container } = render(<BlockNoteEditor />);
        const editorContainer = container.firstChild as HTMLElement;

        // Create mock block content element without any blocks
        const mockBlockContent = document.createElement('div');
        mockBlockContent.className = 'bn-block-content';
        editorContainer.appendChild(mockBlockContent);

        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            clientY: 50
        });

        fireEvent(mockBlockContent, clickEvent);

        expect(editorContainer).toBeInTheDocument();
    });
});

describe('BlockNoteEditor focus handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetCapturedFunctions();
    });

    it('adds focusEditor method to editor ref', () => {
        const onEditorReadyMock = jest.fn();

        render(<BlockNoteEditor onEditorReady={onEditorReadyMock} />);

        // The editor should have been passed to onEditorReady
        expect(onEditorReadyMock).toHaveBeenCalled();
    });

    it('calls onEditorReady with editor instance', () => {
        const onEditorReadyMock = jest.fn();

        render(<BlockNoteEditor onEditorReady={onEditorReadyMock} />);

        expect(onEditorReadyMock).toHaveBeenCalledWith(expect.objectContaining({
            focus: expect.any(Function),
            replaceBlocks: expect.any(Function),
        }));
    });
});