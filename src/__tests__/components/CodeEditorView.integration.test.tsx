import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock clipboard API for tests
Object.defineProperty(navigator, 'clipboard', {
    value: {
        readText: jest.fn().mockResolvedValue('mocked clipboard content'),
        writeText: jest.fn().mockResolvedValue(undefined),
    },
    writable: true,
});

// Lightweight mock for Monaco Editor that exposes onKeyDown/focus and triggers onMount
let lastKeydownHandler: ((e: any) => void) | null = null;
let mockEditorInstance: any = null;

jest.mock('@monaco-editor/react', () => ({
    __esModule: true,
    default: ({ onChange, onMount, value }: any) => {
        const fakeEditor = {
            onKeyDown: (cb: any) => {
                lastKeydownHandler = cb;
                return { dispose: jest.fn() };
            },
            focus: jest.fn(),
            getSelection: jest.fn().mockReturnValue({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 20 }),
            getModel: jest.fn().mockReturnValue({
                getValueInRange: jest.fn().mockReturnValue('console.log(1);')
            }),
            executeEdits: jest.fn()
        };
        mockEditorInstance = fakeEditor;
        // Trigger onMount immediately with our fake editor
        onMount?.(fakeEditor, {});
        return (
            <div>
                <textarea
                    data-testid="monaco-editor"
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                />
                {/* Test helper to trigger undefined change */}
                <button data-testid="trigger-undefined-change" onClick={() => onChange?.(undefined)}>U</button>
            </div>
        );
    },
}));

// Mock Toast to make assertions easy
jest.mock('../../components/Toast', () => ({
    __esModule: true,
    default: ({ show, title, description }: any) =>
        show ? (
            <div data-testid="toast">
                <div>{title}</div>
                <div>{description}</div>
            </div>
        ) : null,
}));

import CodeEditorView from '../../components/CodeEditorView';

describe('CodeEditorView (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the mock editor instance
        mockEditorInstance = null;
        lastKeydownHandler = null;
        // Default fetch mock that can be customized per test
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).fetch = jest.fn((url: string) => {
            // Fallback to a safe default if a test forgets to override
            if (url.includes('/api/code/submit')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'token-123' }) });
            }
            if (url.includes('/api/code/status')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ status_id: 3, stdout: 'OK' }) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
    });

    it('calls onCodeChange with merged code when handleCodeChange receives value', async () => {
        const onCodeChange = jest.fn();
        render(
            <CodeEditorView
                languages={['javascript']}
                initialCode={{ javascript: 'console.log(1);' }}
                handleCodeSubmit={jest.fn()}
                onCodeRun={jest.fn()}
                onCodeChange={onCodeChange}
            />
        );

        // Simulate typing in editor textarea which triggers onChange with a string
        const editor = screen.getByTestId('monaco-editor');
        fireEvent.change(editor, { target: { value: 'console.log(2);' } });

        await waitFor(() => {
            expect(onCodeChange).toHaveBeenCalledWith({ javascript: 'console.log(2);' });
        });
    });

    it('does not call onCodeChange when handleCodeChange receives undefined', async () => {
        const onCodeChange = jest.fn();
        render(
            <CodeEditorView
                languages={['javascript']}
                initialCode={{ javascript: 'console.log(1);' }}
                handleCodeSubmit={jest.fn()}
                onCodeRun={jest.fn()}
                onCodeChange={onCodeChange}
            />
        );

        // Click helper button to emit undefined to onChange
        fireEvent.click(screen.getByTestId('trigger-undefined-change'));

        // Give event loop a tick
        await waitFor(() => {
            expect(onCodeChange).not.toHaveBeenCalled();
        });
    });

    it('runs React preview and provides HTML to onCodeRun', async () => {
        const onCodeRun = jest.fn();
        render(
            <CodeEditorView
                languages={['react']}
                initialCode={{ react: 'function App(){return <div>Hi</div>}\nconst root=ReactDOM.createRoot(document.getElementById("root"));\nroot.render(<App/>)' }}
                handleCodeSubmit={jest.fn()}
                onCodeRun={onCodeRun}
            />
        );

        fireEvent.click(screen.getByText('Run'));

        await waitFor(() => {
            expect(onCodeRun).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'), 'React preview updated', undefined, expect.any(Boolean));
        });

        // Ensure React CDN scripts are present in preview HTML
        expect(onCodeRun.mock.calls.map((c) => c[0]).join('\n')).toContain('react@18.2.0');
    });

    it('combines HTML/CSS/JS for web preview', async () => {
        const onCodeRun = jest.fn();
        render(
            <CodeEditorView
                languages={['html', 'css', 'javascript']}
                initialCode={{
                    html: '<html><head></head><body><h1 id="h">T</h1></body></html>',
                    css: 'h1 { color: red; }',
                    javascript: 'document.getElementById("h").textContent = "TT";',
                }}
                handleCodeSubmit={jest.fn()}
                onCodeRun={onCodeRun}
            />
        );

        fireEvent.click(screen.getByText('Run'));

        await waitFor(() => {
            expect(onCodeRun).toHaveBeenCalledWith(expect.stringContaining('<html>'), 'Preview updated', undefined, expect.any(Boolean));
        });

        const allPreviews = onCodeRun.mock.calls.map((c) => c[0]).join('\n');
        expect(allPreviews).toContain('<style>');
        expect(allPreviews).toContain('<script>');
    });

    it('shows input required for Python when input() used, then executes after providing stdin', async () => {
        const onCodeRun = jest.fn();

        // Custom fetch: first submit => token, status => final stdout
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).fetch = jest.fn((url: string) => {
            if (url.includes('/api/code/submit')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'py-1' }) });
            }
            if (url.includes('/api/code/status')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ status_id: 3, stdout: 'John' }) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        render(
            <CodeEditorView
                languages={['python']}
                initialCode={{ python: 'name = input("Name: ")\nprint(name)' }}
                handleCodeSubmit={jest.fn()}
                onCodeRun={onCodeRun}
            />
        );

        fireEvent.click(screen.getByText('Run'));

        // Should show input panel (textarea) and toast
        expect(await screen.findByTestId('toast')).toBeInTheDocument();
        expect(await screen.findByPlaceholderText('Add every input to your program in a new line')).toBeInTheDocument();

        // Provide stdin and run again
        const inputArea = screen.getByPlaceholderText('Add every input to your program in a new line');
        fireEvent.change(inputArea, { target: { value: 'John' } });

        fireEvent.click(screen.getByText('Run'));

        await waitFor(() => {
            expect(onCodeRun).toHaveBeenCalledWith('', 'Executing code...', undefined, true);
        });

        await waitFor(() => {
            // Final call should include the computed stdout
            const last = onCodeRun.mock.calls[onCodeRun.mock.calls.length - 1];
            expect(last[1]).toContain('John');
            expect(last[3]).toBe(false);
        }, { timeout: 5000 });
    });

    it('generates SQL table preview HTML when stdout contains table-like rows', async () => {
        const onCodeRun = jest.fn();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).fetch = jest.fn((url: string) => {
            if (url.includes('/api/code/submit')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'sql-1' }) });
            }
            if (url.includes('/api/code/status')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ status_id: 3, stdout: 'id | name\n1 | Alice\n2 | Bob' }),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        render(
            <CodeEditorView
                languages={['sql']}
                initialCode={{ sql: 'SELECT 1 as id, "Alice" as name;' }}
                handleCodeSubmit={jest.fn()}
                onCodeRun={onCodeRun}
            />
        );

        fireEvent.click(screen.getByText('Run'));

        await waitFor(() => {
            // Expect a call where preview content contains a table
            const htmlCalls = onCodeRun.mock.calls.filter((c) => typeof c[0] === 'string');
            expect(htmlCalls.some((c) => c[0].includes('<table>'))).toBe(true);
        }, { timeout: 5000 });
    });

    it('shows mobile overlay preview and can close it', async () => {
        const onCodeRun = jest.fn();

        // Force mobile viewport
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });

        render(
            <CodeEditorView
                languages={['html']}
                initialCode={{ html: '<html><head></head><body>Hi</body></html>' }}
                handleCodeSubmit={jest.fn()}
                onCodeRun={onCodeRun}
            />
        );

        fireEvent.click(screen.getByText('Run'));

        // Overlay appears (CodePreview iframe title)
        await waitFor(() => {
            expect(screen.getByTitle('Code Preview')).toBeInTheDocument();
        });

        // Close via the X button
        const closeBtn = screen.getByLabelText('Close preview');
        fireEvent.click(closeBtn);

        await waitFor(() => {
            expect(screen.queryByTitle('Code Preview')).not.toBeInTheDocument();
        });
    });

    it('prevents paste and shows toast when disableCopyPaste is true', async () => {
        render(
            <CodeEditorView
                languages={['javascript']}
                initialCode={{ javascript: 'console.log(1);' }}
                handleCodeSubmit={jest.fn()}
                onCodeRun={jest.fn()}
                disableCopyPaste={true}
            />
        );

        // Simulate Cmd/Ctrl+V on the Monaco editor instance via stored handler
        expect(lastKeydownHandler).toBeTruthy();
        const preventDefault = jest.fn();
        const stopPropagation = jest.fn();
        lastKeydownHandler?.({ ctrlKey: true, metaKey: true, browserEvent: { key: 'v' }, preventDefault, stopPropagation });

        await waitFor(() => {
            expect(screen.getByTestId('toast')).toBeInTheDocument();
        });

        expect(preventDefault).toHaveBeenCalled();
        expect(stopPropagation).toHaveBeenCalled();
    });

    it('shows toast when clipboard access fails', async () => {
        // Mock clipboard to reject
        (navigator.clipboard.readText as jest.Mock).mockRejectedValue(new Error('Permission denied'));

        render(
            <CodeEditorView
                languages={['javascript']}
                initialCode={{ javascript: 'console.log(1);' }}
                handleCodeSubmit={jest.fn()}
                onCodeRun={jest.fn()}
                disableCopyPaste={true}
            />
        );

        // Simulate Cmd/Ctrl+V which will trigger clipboard access
        expect(lastKeydownHandler).toBeTruthy();
        const preventDefault = jest.fn();
        const stopPropagation = jest.fn();
        lastKeydownHandler?.({
            ctrlKey: true,
            metaKey: false,
            browserEvent: { key: 'v' },
            preventDefault,
            stopPropagation
        });

        await waitFor(() => {
            expect(screen.getByTestId('toast')).toBeInTheDocument();
            expect(screen.getByText('Not allowed')).toBeInTheDocument();
            expect(screen.getByText('Pasting the answer is disabled for this question')).toBeInTheDocument();
        });
    });

    it('shows toast for external paste attempts when clipboard content does not match', async () => {
        // Mock clipboard to return different content than what was copied
        (navigator.clipboard.readText as jest.Mock).mockResolvedValue('external content');

        render(
            <CodeEditorView
                languages={['javascript']}
                initialCode={{ javascript: 'console.log(1);' }}
                handleCodeSubmit={jest.fn()}
                onCodeRun={jest.fn()}
                disableCopyPaste={true}
            />
        );

        // First simulate a copy to set lastCopiedContent
        lastKeydownHandler?.({
            ctrlKey: true,
            metaKey: false,
            browserEvent: { key: 'c' },
            preventDefault: jest.fn(),
            stopPropagation: jest.fn()
        });

        // Then simulate paste with different clipboard content
        lastKeydownHandler?.({
            ctrlKey: true,
            metaKey: false,
            browserEvent: { key: 'v' },
            preventDefault: jest.fn(),
            stopPropagation: jest.fn()
        });

        await waitFor(() => {
            expect(screen.getByTestId('toast')).toBeInTheDocument();
            expect(screen.getByText('Not allowed')).toBeInTheDocument();
            expect(screen.getByText('Pasting the answer is disabled for this question')).toBeInTheDocument();
        });

        // Verify that executeEdits was not called
        expect(mockEditorInstance.executeEdits).not.toHaveBeenCalled();
    });
});


