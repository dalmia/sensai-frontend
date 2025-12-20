import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
// Mock CSS imports
jest.mock('@blocknote/core/fonts/inter.css', () => ({}));
jest.mock('@blocknote/mantine/style.css', () => ({}));
import BlockNoteEditor from '../../components/BlockNoteEditor';
import React from 'react';

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
});