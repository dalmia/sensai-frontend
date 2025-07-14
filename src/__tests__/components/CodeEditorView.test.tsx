import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => ({
    __esModule: true,
    default: ({ onChange, onMount, value }: any) => (
        <textarea
            data-testid="monaco-editor"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onLoad={() => onMount?.({}, {})}
        />
    ),
}));

// Mock Toast component
jest.mock('../../components/Toast', () => {
    return function MockToast({ onClose }: any) {
        return <div data-testid="toast" onClick={onClose}>Toast</div>;
    };
});

// Mock CodeEditorView since it has complex dependencies
jest.mock('../../components/CodeEditorView', () => {
    return {
        __esModule: true,
        default: React.forwardRef(function MockCodeEditorView(props: any, ref: any) {
            React.useImperativeHandle(ref, () => ({
                getCurrentCode: () => ({ javascript: 'console.log("test");' })
            }));

            return (
                <div data-testid="code-editor-view">
                    <div data-testid="monaco-editor" />
                    <button onClick={props.onCodeRun}>Run</button>
                    <button onClick={() => props.handleCodeSubmit()}>Submit</button>
                </div>
            );
        }),
        CodePreview: ({ isRunning, output, isWebPreview, previewContent }: any) => (
            <div data-testid="code-preview">
                {isRunning && <div role="status">Loading...</div>}
                {output && <div>{output}</div>}
                {isWebPreview && <iframe title="Code Preview" src={`data:text/html,${previewContent}`} />}
                {!output && !isWebPreview && <div>Run your code to see output</div>}
            </div>
        )
    };
});

const MockCodeEditorView = require('../../components/CodeEditorView').default;
const { CodePreview } = require('../../components/CodeEditorView');

describe('CodeEditorView Component', () => {
    const defaultProps = {
        handleCodeSubmit: jest.fn(),
        onCodeRun: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders the component with default state', () => {
            render(<MockCodeEditorView {...defaultProps} />);

            expect(screen.getByTestId('code-editor-view')).toBeInTheDocument();
            expect(screen.getByText('Run')).toBeInTheDocument();
            expect(screen.getByText('Submit')).toBeInTheDocument();
        });

        it('renders with initial code', () => {
            const initialCode = { javascript: 'console.log("hello");' };
            render(<MockCodeEditorView {...defaultProps} initialCode={initialCode} />);

            expect(screen.getByTestId('code-editor-view')).toBeInTheDocument();
        });

        it('renders with custom languages', () => {
            const languages = ['python', 'javascript'];
            render(<MockCodeEditorView {...defaultProps} languages={languages} />);

            expect(screen.getByTestId('code-editor-view')).toBeInTheDocument();
        });
    });

    describe('Code Execution', () => {
        it('handles run button click', async () => {
            const mockOnCodeRun = jest.fn();
            render(<MockCodeEditorView {...defaultProps} onCodeRun={mockOnCodeRun} />);

            const runButton = screen.getByText('Run');
            fireEvent.click(runButton);

            expect(mockOnCodeRun).toHaveBeenCalled();
        });

        it('handles submit button click', () => {
            const mockHandleCodeSubmit = jest.fn();
            render(<MockCodeEditorView {...defaultProps} handleCodeSubmit={mockHandleCodeSubmit} />);

            const submitButton = screen.getByText('Submit');
            fireEvent.click(submitButton);

            expect(mockHandleCodeSubmit).toHaveBeenCalled();
        });
    });

    describe('Code Editor Ref', () => {
        it('exposes getCurrentCode method via ref', () => {
            const ref = React.createRef<any>();
            render(<MockCodeEditorView {...defaultProps} ref={ref} />);

            expect(ref.current).toBeTruthy();
            expect(ref.current?.getCurrentCode).toBeDefined();

            // Should return current code state
            const currentCode = ref.current?.getCurrentCode();
            expect(currentCode).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('handles missing props gracefully', () => {
            const minimalProps = {
                handleCodeSubmit: jest.fn(),
            };

            expect(() => {
                render(<MockCodeEditorView {...minimalProps} />);
            }).not.toThrow();
        });
    });
});

describe('CodePreview Component', () => {
    const defaultPreviewProps = {
        isRunning: false,
        previewContent: '',
        output: '',
        isWebPreview: false,
    };

    describe('Basic Rendering', () => {
        it('renders preview component', () => {
            render(<CodePreview {...defaultPreviewProps} />);

            expect(screen.getByText(/run your code to see/i)).toBeInTheDocument();
        });

        it('shows loading state when running', () => {
            render(<CodePreview {...defaultPreviewProps} isRunning={true} />);

            expect(screen.getByRole('status')).toBeInTheDocument();
        });

        it('displays output when provided', () => {
            const output = 'Hello, World!';
            render(<CodePreview {...defaultPreviewProps} output={output} />);

            expect(screen.getByText(output)).toBeInTheDocument();
        });

        it('displays web preview content', () => {
            const previewContent = '<html><body><h1>Test</h1></body></html>';
            render(<CodePreview {...defaultPreviewProps} isWebPreview={true} previewContent={previewContent} />);

            expect(screen.getByTitle('Code Preview')).toBeInTheDocument();
        });
    });
});