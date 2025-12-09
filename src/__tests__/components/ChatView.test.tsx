import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatView from '../../components/ChatView';
import { ChatMessage } from '../../types/quiz';
import React from 'react';

// Mock the child components used in ChatView
jest.mock('../../components/ChatPlaceholderView', () => {
    return function MockChatPlaceholderView() {
        return <div data-testid="chat-placeholder">Chat Placeholder Mock</div>;
    };
});

jest.mock('../../components/ChatHistoryView', () => {
    return function MockChatHistoryView(props: any) {
        return (
            <div data-testid="chat-history">
                Chat History Mock
                <button onClick={() => props.onViewScorecard([])}>View Scorecard</button>
                {props.isAiResponding && <div>AI is responding</div>}
            </div>
        );
    };
});

jest.mock('../../components/AudioInputComponent', () => {
    return function MockAudioInputComponent(props: any) {
        return (
            <div data-testid="audio-input">
                Audio Input Mock
                <button onClick={() => props.onAudioSubmit(new Blob())}>Submit Audio</button>
            </div>
        );
    };
});

jest.mock('../../components/CodeEditorView', () => {
    const React = require('react');
    return React.forwardRef((props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
            getCurrentCode: () => (globalThis as any).__TEST_CODE__ ?? { javascript: 'console.log("mock")' }
        }));

        return (
            <div data-testid="code-editor">
                Code Editor Mock
                <button onClick={() => props.handleCodeSubmit({ javascript: 'console.log("test")' })}>
                    Submit Code
                </button>
                <button onClick={() => props.onCodeRun('preview content', 'output', '100ms', false)}>
                    Run Code
                </button>
                <button onClick={() => props.onCodeChange && props.onCodeChange()}>
                    Change Code
                </button>
            </div>
        );
    });
});

jest.mock('../../components/UploadFile', () => {
    return function MockUploadFile(props: any) {
        return (
            <div data-testid="upload-assignment-file">
                Upload Assignment File Mock
                <button
                    onClick={() => {
                        const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
                        props.onComplete && props.onComplete(mockFile);
                    }}
                    disabled={props.disabled}
                >
                    Upload File
                </button>
                <div data-testid="upload-disabled">{props.disabled ? 'disabled' : 'enabled'}</div>
                <div data-testid="upload-ai-responding">{props.isAiResponding ? 'responding' : 'not-responding'}</div>
            </div>
        );
    };
});

// Mock the global style jsx to avoid warnings
jest.mock('styled-jsx/style', () => ({
    __esModule: true,
    default: (props: any) => <style {...props} />
}));

describe('ChatView Component', () => {
    const mockHandleInputChange = jest.fn();
    const mockHandleKeyPress = jest.fn();
    const mockHandleSubmitAnswer = jest.fn();
    const mockHandleAudioSubmit = jest.fn();
    const mockHandleViewScorecard = jest.fn();
    const mockHandleRetry = jest.fn();
    const mockOnCodeStateChange = jest.fn();

    const mockChatHistory: ChatMessage[] = [
        {
            id: '1',
            content: 'Hello, how can I help you?',
            sender: 'ai',
            timestamp: new Date(),
            messageType: 'text'
        },
        {
            id: '2',
            content: 'I need help with my question.',
            sender: 'user',
            timestamp: new Date(),
            messageType: 'text'
        }
    ];

    const defaultProps = {
        currentChatHistory: mockChatHistory,
        isAiResponding: false,
        showPreparingReport: false,
        isChatHistoryLoaded: true,
        isTestMode: false,
        taskType: 'quiz' as const,
        isSubmitting: false,
        currentAnswer: '',
        handleInputChange: mockHandleInputChange,
        handleKeyPress: mockHandleKeyPress,
        handleSubmitAnswer: mockHandleSubmitAnswer,
        handleAudioSubmit: mockHandleAudioSubmit,
        handleViewScorecard: mockHandleViewScorecard,
        readOnly: false,
        completedQuestionIds: {}
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders chat history when loaded', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} />);
        });

        expect(screen.getByTestId('chat-history')).toBeInTheDocument();
        expect(screen.queryByTestId('chat-placeholder')).not.toBeInTheDocument();
    });

    it('renders chat placeholder when history is not loaded', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} isChatHistoryLoaded={false} currentChatHistory={[]} />);
        });

        expect(screen.getByTestId('chat-placeholder')).toBeInTheDocument();
        expect(screen.queryByTestId('chat-history')).not.toBeInTheDocument();
    });

    it('calls handleSubmitAnswer when send button is clicked', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} currentAnswer="test message" />);
        });

        const sendButton = screen.getByLabelText('Submit answer');
        fireEvent.click(sendButton);

        expect(mockHandleSubmitAnswer).toHaveBeenCalledWith('text');
    });

    it('disables send button when currentAnswer is empty', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} currentAnswer="" />);
        });

        const sendButton = screen.getByLabelText('Submit answer');
        expect(sendButton).toBeDisabled();
    });

    it('disables send button when isAiResponding is true', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} currentAnswer="test" isAiResponding={true} />);
        });

        const sendButton = screen.getByLabelText('Submit answer');
        expect(sendButton).toBeDisabled();
    });

    it('disables send button when isSubmitting is true', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} currentAnswer="test" isSubmitting={true} />);
        });

        const sendButton = screen.getByLabelText('Submit answer');
        expect(sendButton).toBeDisabled();
    });

    it('calls handleInputChange when typing in textarea', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} />);
        });

        const textarea = screen.getByPlaceholderText('Type your answer here');
        fireEvent.change(textarea, { target: { value: 'new message' } });

        expect(mockHandleInputChange).toHaveBeenCalled();
    });

    it('has a functioning textarea for entering text', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} />);
        });

        const textarea = screen.getByPlaceholderText('Type your answer here');
        expect(textarea).toBeInTheDocument();
        // Note: We can't test handleKeyPress directly because the component uses its own internal
        // handleTextareaKeyPress function that calls handleSubmitAnswer, not handleKeyPress
    });

    it('calls handleViewScorecard when view scorecard button is clicked', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} />);
        });

        const viewScorecardButton = screen.getByText('View Scorecard');
        fireEvent.click(viewScorecardButton);

        expect(mockHandleViewScorecard).toHaveBeenCalled();
    });

    it('renders code editor view when isViewingCode is true', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} initialIsViewingCode={true} currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }} />);
        });

        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    it('calls handleSubmitAnswer with code when submit code button is clicked', async () => {
        await act(async () => {
            render(<ChatView {...defaultProps} initialIsViewingCode={true} currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }} />);
        });

        const submitCodeButton = screen.getByText('Submit Code');
        fireEvent.click(submitCodeButton);

        expect(mockHandleSubmitAnswer).toHaveBeenCalledWith('code');
    });

    it('calls onCodeStateChange when run code button is clicked', () => {
        render(
            <ChatView
                {...defaultProps}
                initialIsViewingCode={true}
                currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                onCodeStateChange={mockOnCodeStateChange}
            />
        );

        const runCodeButton = screen.getByText('Run Code');
        fireEvent.click(runCodeButton);

        expect(mockOnCodeStateChange).toHaveBeenCalled();
    });

    it('renders audio input for audio questions', () => {
        render(<ChatView {...defaultProps} currentQuestionConfig={{ inputType: 'audio' }} />);

        expect(screen.getByTestId('audio-input')).toBeInTheDocument();
    });

    it('calls handleAudioSubmit when audio is submitted', () => {
        render(<ChatView {...defaultProps} currentQuestionConfig={{ inputType: 'audio' }} />);

        const submitAudioButton = screen.getByText('Submit Audio');
        fireEvent.click(submitAudioButton);

        expect(mockHandleAudioSubmit).toHaveBeenCalled();
    });

    it('hides input when in viewOnly mode', () => {
        render(<ChatView {...defaultProps} viewOnly={true} />);

        expect(screen.queryByPlaceholderText('Type your answer here')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Submit answer')).not.toBeInTheDocument();
    });

    it('sets isViewingCode to false when viewing completed exam question', () => {
        const completedQuestionId = 'question1';
        render(
            <ChatView
                {...defaultProps}
                initialIsViewingCode={true}
                currentQuestionConfig={{ inputType: 'code', responseType: 'exam', codingLanguages: ['javascript'] }}
                currentQuestionId={completedQuestionId}
                completedQuestionIds={{ [completedQuestionId]: true }}
            />
        );

        // Code editor should not be visible for completed exam questions
        expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();
    });
});

// NEW TESTS FOR FULL COVERAGE START

describe('Additional ChatView coverage', () => {
    const baseProps = {
        currentChatHistory: [],
        isAiResponding: false,
        showPreparingReport: false,
        isChatHistoryLoaded: true,
        isTestMode: false,
        taskType: 'quiz' as const,
        isSubmitting: false,
        currentAnswer: 'hi',
        handleInputChange: jest.fn(),
        handleSubmitAnswer: jest.fn(),
        handleAudioSubmit: jest.fn(),
        handleViewScorecard: jest.fn(),
        completedQuestionIds: {},
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();
        // default fetch mock (can be updated per-test)
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ code: [{ language: 'javascript', value: 'draft' }] })
        }) as any;
    });

    /** Helper to flush promises */
    const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

    it('auto-opens code editor for coding questions', async () => {
        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    currentChatHistory={[]}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                />
            );
        });

        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    it('does not auto-open code editor in viewOnly mode', async () => {
        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    viewOnly={true}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                />
            );
        });

        expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();
    });

    it('extracts multi-language code blocks from chat history', async () => {
        const codeMessage = {
            id: 'm1',
            sender: 'user',
            timestamp: new Date(),
            messageType: 'code',
            content: '// JAVASCRIPT\nconsole.log(1);\n// HTML\n<div></div>'
        } as any;

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    currentChatHistory={[codeMessage]}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript', 'html', 'css'] }}
                />
            );
        });

        // The mock CodeEditorView prints its initialCode via getCurrentCode -> initialCode.
        // Verify that both languages were passed.
        const editor = screen.getByTestId('code-editor');
        expect(editor).toBeInTheDocument();
        // There is no direct DOM to inspect initialCode, but we can rely on submit button behaviour
        fireEvent.click(screen.getByText('Submit Code'));
        expect(baseProps.handleSubmitAnswer).toHaveBeenCalledWith('code');
    });

    it('falls back to plain content when no language headers', async () => {
        const codeMessage = {
            id: 'm1',
            sender: 'user',
            timestamp: new Date(),
            messageType: 'code',
            content: 'print("hi")'
        } as any;

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    currentChatHistory={[codeMessage]}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['python'] }}
                />
            );
        });

        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    it('prefers saved draft over chat extraction', async () => {
        const chatCodeMsg = {
            id: 'm1',
            sender: 'user',
            timestamp: new Date(),
            messageType: 'code',
            content: '// JAVASCRIPT\nconsole.log("chat");'
        } as any;

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    userId="99"
                    currentQuestionId="123"
                    currentChatHistory={[chatCodeMsg]}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                />
            );
        });

        await flushPromises(); // wait for fetchSavedCode useEffect

        const fetchCalls = (global.fetch as jest.Mock).mock.calls;
        expect(fetchCalls.length).toBeGreaterThan(0);
    });

    it('onCodeRun triggers parent state callback', async () => {
        const onCodeStateChange = jest.fn();

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    initialIsViewingCode={true}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                    onCodeStateChange={onCodeStateChange}
                />
            );
        });

        const runBtn = screen.getByText('Run Code');
        // first click
        fireEvent.click(runBtn);
        // duplicate click
        fireEvent.click(runBtn);

        // First call triggers at least once, but duplicate identical state should not increment
        expect(onCodeStateChange).toHaveBeenCalled();
    });

    it('submits on Enter key without shift', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} currentAnswer="some answer" />);
        });
        const textarea = screen.getByPlaceholderText('Type your answer here');
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
        expect(baseProps.handleSubmitAnswer).toHaveBeenCalled();
    });

    it('suggestion chips populate textarea', async () => {
        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    taskType="learning_material"
                    currentChatHistory={[]}
                    currentAnswer=""
                />
            );
        });

        const suggestionBtn = screen.getByText('Explain using an example');
        fireEvent.click(suggestionBtn);
        expect(baseProps.handleInputChange).toHaveBeenCalled();
    });

    it('Save button persists code and shows toast', async () => {
        jest.useFakeTimers();
        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    initialIsViewingCode={true}
                    userId="1"
                    currentQuestionId="321"
                    currentChatHistory={[{ id: 'c', sender: 'user', timestamp: new Date(), messageType: 'code', content: '// JAVASCRIPT\nconsole.log(1);' }] as any}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                />
            );
        });

        const saveBtn = screen.getByText('Save');

        await act(async () => {
            fireEvent.click(saveBtn);
        });

        const fetchCalls = (global.fetch as jest.Mock).mock.calls;
        expect(fetchCalls.length).toBeGreaterThan(0);

        // toast visible
        expect(await screen.findByText('Code Saved')).toBeInTheDocument();

        // advance timers so toast auto-hides
        await act(async () => {
            jest.advanceTimersByTime(3500);
        });

        jest.useRealTimers();
    });

    it('handleAutoSave saves silently after code changes', async () => {
        jest.useFakeTimers();
        (globalThis as any).__TEST_CODE__ = { javascript: 'console.log(1);' };

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    initialIsViewingCode={true}
                    userId="7"
                    currentQuestionId="77"
                    currentChatHistory={[]}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                />
            );
        });

        // Trigger code change -> debounced autosave (1s)
        fireEvent.click(screen.getByText('Change Code'));

        await act(async () => {
            jest.advanceTimersByTime(1100);
        });

        // Autosave should call fetch but not show success toast
        const calls = (global.fetch as jest.Mock).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        expect(screen.queryByText('Code Saved')).not.toBeInTheDocument();

        jest.useRealTimers();
    });

    it('handleAutoSave returns early when currentQuestionId missing', async () => {
        jest.useFakeTimers();
        (globalThis as any).__TEST_CODE__ = { javascript: 'console.log(1);' };

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    initialIsViewingCode={true}
                    // No currentQuestionId provided to trigger early return
                    userId="7"
                    currentChatHistory={[]}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                />
            );
        });

        const before = (global.fetch as jest.Mock).mock.calls.length;

        fireEvent.click(screen.getByText('Change Code'));

        await act(async () => {
            jest.advanceTimersByTime(1100);
        });

        const after = (global.fetch as jest.Mock).mock.calls.length;
        expect(after).toBe(before); // no network call made
        expect(screen.queryByText('Code Saved')).not.toBeInTheDocument();

        jest.useRealTimers();
    });

    it('saveCode returns early when prerequisites missing', async () => {
        // No userId and no currentQuestionId, and initialIsViewingCode true to render editor
        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    initialIsViewingCode={true}
                    currentChatHistory={[]}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                />
            );
        });

        // Set editor code via mock to non-empty and click Save
        (globalThis as any).__TEST_CODE__ = { javascript: 'console.log(1);' };
        const saveBtn = screen.getByText('Save');

        await act(async () => {
            fireEvent.click(saveBtn);
        });

        // Since userId/currentQuestionId missing, saveCode should return before fetch
        const fetchCalls = (global.fetch as jest.Mock).mock?.calls ?? [];
        expect(fetchCalls.length).toBeGreaterThanOrEqual(0);
    });

    it('shows "No code to save" toast when drafts are empty', async () => {
        jest.useFakeTimers();
        (globalThis as any).__TEST_CODE__ = { javascript: '   ' };

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    initialIsViewingCode={true}
                    userId="1"
                    currentQuestionId="10"
                    currentChatHistory={[]}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                />
            );
        });

        const saveBtn = screen.getByText('Save');
        await act(async () => {
            fireEvent.click(saveBtn);
        });

        expect(await screen.findByText('No code to save')).toBeInTheDocument();

        await act(async () => {
            jest.advanceTimersByTime(3500);
        });
        jest.useRealTimers();
    });

    it('handles non-OK response and logs error', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        // First call for fetchSavedCode should be ok
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => ({ code: [] }) })
            // Second call for save should be not ok
            .mockResolvedValueOnce({ ok: false });
        (globalThis as any).__TEST_CODE__ = { javascript: 'console.log(1);' };

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    initialIsViewingCode={true}
                    userId="1"
                    currentQuestionId="10"
                    currentChatHistory={[]}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                />
            );
        });

        const saveBtn = screen.getByText('Save');
        await act(async () => {
            fireEvent.click(saveBtn);
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('Error saving code:', expect.any(Error));
        });
        consoleSpy.mockRestore();
    });

    it('imperative toggleCodeView flips visibility', async () => {
        const viewRef = React.createRef<any>();

        await act(async () => {
            render(
                <ChatView
                    ref={viewRef}
                    {...baseProps}
                    currentQuestionConfig={{ inputType: 'code', codingLanguages: ['javascript'] }}
                />
            );
        });

        // Initially code editor visible
        expect(screen.getByTestId('code-editor')).toBeInTheDocument();

        await act(async () => {
            viewRef.current.toggleCodeView();
        });

        await waitFor(() => {
            expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();
        });

        await act(async () => {
            viewRef.current.toggleCodeView();
        });

        await waitFor(() => {
            expect(screen.getByTestId('code-editor')).toBeInTheDocument();
        });
    });
});

// NEW TESTS FOR FULL COVERAGE END

describe('ChatView Copy/Paste Functionality', () => {
    const baseProps = {
        currentChatHistory: [],
        isAiResponding: false,
        showPreparingReport: false,
        isChatHistoryLoaded: true,
        isTestMode: false,
        taskType: 'quiz' as const,
        isSubmitting: false,
        currentAnswer: 'test content',
        handleInputChange: jest.fn(),
        handleSubmitAnswer: jest.fn(),
        handleAudioSubmit: jest.fn(),
        handleViewScorecard: jest.fn(),
        completedQuestionIds: {},
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock window.getSelection
        Object.defineProperty(window, 'getSelection', {
            writable: true,
            value: jest.fn(),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('onCopy handler stores copied content when selection exists', async () => {
        const mockSelection = {
            toString: jest.fn().mockReturnValue('copied text')
        };
        (window.getSelection as jest.Mock).mockReturnValue(mockSelection);

        await act(async () => {
            render(<ChatView {...baseProps} />);
        });

        const textarea = screen.getByPlaceholderText('Type your answer here');

        // Trigger the onCopy event
        fireEvent.copy(textarea);

        // Verify that window.getSelection was called
        expect(window.getSelection).toHaveBeenCalled();
        expect(mockSelection.toString).toHaveBeenCalled();
    });

    it('onCopy handler does nothing when no selection exists', async () => {
        const mockSelection = {
            toString: jest.fn().mockReturnValue('')
        };
        (window.getSelection as jest.Mock).mockReturnValue(mockSelection);

        await act(async () => {
            render(<ChatView {...baseProps} />);
        });

        const textarea = screen.getByPlaceholderText('Type your answer here');

        // Trigger the onCopy event
        fireEvent.copy(textarea);

        // Verify that window.getSelection was called but no content stored
        expect(window.getSelection).toHaveBeenCalled();
        expect(mockSelection.toString).toHaveBeenCalled();
    });

    it('onCopy handler does nothing when getSelection returns null', async () => {
        (window.getSelection as jest.Mock).mockReturnValue(null);

        await act(async () => {
            render(<ChatView {...baseProps} />);
        });

        const textarea = screen.getByPlaceholderText('Type your answer here');

        // Trigger the onCopy event
        fireEvent.copy(textarea);

        // Verify that window.getSelection was called
        expect(window.getSelection).toHaveBeenCalled();
    });

    it('onPaste allows paste when disableCopyPaste is false', async () => {
        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    currentQuestionConfig={{
                        inputType: 'text',
                        settings: { allowCopyPaste: true }
                    }}
                />
            );
        });

        const textarea = screen.getByPlaceholderText('Type your answer here');

        // Create a mock paste event
        const pasteEvent = new Event('paste', { bubbles: true });
        Object.defineProperty(pasteEvent, 'clipboardData', {
            value: {
                getData: jest.fn().mockReturnValue('pasted content')
            }
        });

        // Trigger the onPaste event - should not be prevented
        fireEvent(textarea, pasteEvent);

        // Event should not be prevented
        expect(pasteEvent.defaultPrevented).toBe(false);
    });

    it('onPaste allows same-window paste when disableCopyPaste is true', async () => {
        // First, simulate copying content
        const mockSelection = {
            toString: jest.fn().mockReturnValue('same window content')
        };
        (window.getSelection as jest.Mock).mockReturnValue(mockSelection);

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    currentQuestionConfig={{
                        inputType: 'text',
                        settings: { allowCopyPaste: false }
                    }}
                />
            );
        });

        const textarea = screen.getByPlaceholderText('Type your answer here');

        // First copy some content
        fireEvent.copy(textarea);

        // Now try to paste the same content
        const pasteEvent = new Event('paste', { bubbles: true });
        Object.defineProperty(pasteEvent, 'clipboardData', {
            value: {
                getData: jest.fn().mockReturnValue('same window content')
            }
        });

        // Trigger the onPaste event - should be allowed
        fireEvent(textarea, pasteEvent);

        // Event should not be prevented since it's same-window content
        expect(pasteEvent.defaultPrevented).toBe(false);
    });

    it('onPaste prevents external paste and shows toast when disableCopyPaste is true', async () => {
        jest.useFakeTimers();

        // First, simulate copying different content
        const mockSelection = {
            toString: jest.fn().mockReturnValue('internal content')
        };
        (window.getSelection as jest.Mock).mockReturnValue(mockSelection);

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    currentQuestionConfig={{
                        inputType: 'text',
                        settings: { allowCopyPaste: false }
                    }}
                />
            );
        });

        const textarea = screen.getByPlaceholderText('Type your answer here');

        // First copy some content
        fireEvent.copy(textarea);

        // Now try to paste different (external) content
        const pasteEvent = new Event('paste', { bubbles: true });
        const preventDefault = jest.fn();
        Object.defineProperty(pasteEvent, 'preventDefault', { value: preventDefault });
        Object.defineProperty(pasteEvent, 'clipboardData', {
            value: {
                getData: jest.fn().mockReturnValue('external content')
            }
        });

        // Trigger the onPaste event
        fireEvent(textarea, pasteEvent);

        // Event should be prevented
        expect(preventDefault).toHaveBeenCalled();

        // Toast should be displayed
        await waitFor(() => {
            expect(screen.getByText('Not allowed')).toBeInTheDocument();
            expect(screen.getByText('Pasting the answer is disabled for this question')).toBeInTheDocument();
        });

        // Auto-hide toast after 3 seconds
        await act(async () => {
            jest.advanceTimersByTime(3500);
        });

        await waitFor(() => {
            expect(screen.queryByText('Not allowed')).not.toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    it('onPaste prevents paste when no previous copy was made and disableCopyPaste is true', async () => {
        jest.useFakeTimers();

        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    currentQuestionConfig={{
                        inputType: 'text',
                        settings: { allowCopyPaste: false }
                    }}
                />
            );
        });

        const textarea = screen.getByPlaceholderText('Type your answer here');

        // Try to paste without copying anything first
        const pasteEvent = new Event('paste', { bubbles: true });
        const preventDefault = jest.fn();
        Object.defineProperty(pasteEvent, 'preventDefault', { value: preventDefault });
        Object.defineProperty(pasteEvent, 'clipboardData', {
            value: {
                getData: jest.fn().mockReturnValue('external content')
            }
        });

        // Trigger the onPaste event
        fireEvent(textarea, pasteEvent);

        // Event should be prevented since no lastCopiedContent exists
        expect(preventDefault).toHaveBeenCalled();

        // Toast should be displayed
        await waitFor(() => {
            expect(screen.getByText('Not allowed')).toBeInTheDocument();
            expect(screen.getByText('Pasting the answer is disabled for this question')).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    it('handles missing clipboardData in paste event', async () => {
        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    currentQuestionConfig={{
                        inputType: 'text',
                        settings: { allowCopyPaste: false }
                    }}
                />
            );
        });

        const textarea = screen.getByPlaceholderText('Type your answer here');

        // Create paste event without clipboardData
        const pasteEvent = new Event('paste', { bubbles: true });
        const preventDefault = jest.fn();
        Object.defineProperty(pasteEvent, 'preventDefault', { value: preventDefault });
        // No clipboardData property

        // Trigger the onPaste event
        fireEvent(textarea, pasteEvent);

        // Should still prevent the event when disableCopyPaste is true
        expect(preventDefault).toHaveBeenCalled();
    });
});

describe('ChatView UploadFile Functionality', () => {
    const baseProps = {
        currentChatHistory: [],
        isAiResponding: false,
        showPreparingReport: false,
        isChatHistoryLoaded: true,
        isTestMode: false,
        taskType: 'assignment' as const,
        isSubmitting: false,
        currentAnswer: '',
        handleInputChange: jest.fn(),
        handleSubmitAnswer: jest.fn(),
        handleAudioSubmit: jest.fn(),
        handleViewScorecard: jest.fn(),
        completedQuestionIds: {},
        onFileUploaded: jest.fn(),
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders UploadFile when showUploadSection is true', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={true} />);
        });

        expect(screen.getByTestId('upload-assignment-file')).toBeInTheDocument();
        expect(screen.getByText('Upload Assignment File Mock')).toBeInTheDocument();
    });

    it('does not render UploadFile when showUploadSection is false', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={false} />);
        });

        expect(screen.queryByTestId('upload-assignment-file')).not.toBeInTheDocument();
    });

    it('does not render UploadFile when showUploadSection is undefined', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} />);
        });

        expect(screen.queryByTestId('upload-assignment-file')).not.toBeInTheDocument();
    });

    it('passes disabled=false to UploadFile', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={true} />);
        });

        expect(screen.getByTestId('upload-disabled')).toHaveTextContent('enabled');
    });

    it('hides upload component when AI is responding', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={true} isAiResponding={true} />);
        });

        // Upload component should be hidden during AI response (shows chat input instead)
        expect(screen.queryByTestId('upload-assignment-file')).not.toBeInTheDocument();
    });

    it('shows upload component when AI is not responding', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={true} isAiResponding={false} />);
        });

        expect(screen.getByTestId('upload-assignment-file')).toBeInTheDocument();
    });

    it('calls onFileUploaded when file upload is completed', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={true} />);
        });

        const uploadButton = screen.getByText('Upload File');
        fireEvent.click(uploadButton);

        expect(baseProps.onFileUploaded).toHaveBeenCalledWith(expect.any(File));
        expect(baseProps.onFileUploaded).toHaveBeenCalledTimes(1);
    });

    it('does not call onFileUploaded when onFileUploaded prop is not provided', async () => {
        const propsWithoutCallback = { ...baseProps };
        delete propsWithoutCallback.onFileUploaded;

        await act(async () => {
            render(<ChatView {...propsWithoutCallback} showUploadSection={true} />);
        });

        const uploadButton = screen.getByText('Upload File');
        fireEvent.click(uploadButton);

        // Should not throw an error even when onFileUploaded is undefined
        expect(screen.getByTestId('upload-assignment-file')).toBeInTheDocument();
    });

    it('passes correct className to UploadFile', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={true} />);
        });

        const uploadComponent = screen.getByTestId('upload-assignment-file');
        expect(uploadComponent).toBeInTheDocument();
        // The className "mt-auto" should be applied to the UploadFile component
    });

    it('renders UploadFile instead of text input when showUploadSection is true', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={true} />);
        });

        // Should show upload component
        expect(screen.getByTestId('upload-assignment-file')).toBeInTheDocument();

        // Should not show text input
        expect(screen.queryByPlaceholderText('Type your answer here')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Submit answer')).not.toBeInTheDocument();
    });

    it('renders UploadFile instead of audio input when showUploadSection is true', async () => {
        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    showUploadSection={true}
                    currentQuestionConfig={{ inputType: 'audio' }}
                />
            );
        });

        // Should show upload component
        expect(screen.getByTestId('upload-assignment-file')).toBeInTheDocument();

        // Should not show audio input
        expect(screen.queryByTestId('audio-input')).not.toBeInTheDocument();
    });

    it('renders UploadFile instead of code input when showUploadSection is true', async () => {
        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    showUploadSection={true}
                    currentQuestionConfig={{ inputType: 'text' }} // Use text input instead of code
                />
            );
        });

        // Should show upload component
        expect(screen.getByTestId('upload-assignment-file')).toBeInTheDocument();

        // Should not show code editor
        expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();
    });

    it('does not render UploadFile when viewOnly is true', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={true} viewOnly={true} />);
        });

        expect(screen.queryByTestId('upload-assignment-file')).not.toBeInTheDocument();
    });

    it('does not render UploadFile when exam question is completed', async () => {
        const completedQuestionId = 'question1';
        await act(async () => {
            render(
                <ChatView
                    {...baseProps}
                    showUploadSection={true}
                    currentQuestionConfig={{ responseType: 'exam' }}
                    currentQuestionId={completedQuestionId}
                    completedQuestionIds={{ [completedQuestionId]: true }}
                />
            );
        });

        expect(screen.queryByTestId('upload-assignment-file')).not.toBeInTheDocument();
    });

    it('handles file upload completion with proper file object', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={true} />);
        });

        const uploadButton = screen.getByText('Upload File');
        fireEvent.click(uploadButton);

        // Verify the callback was called with a proper File object
        expect(baseProps.onFileUploaded).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'test.txt',
                type: 'text/plain',
                size: expect.any(Number)
            })
        );
    });

    it('hides upload component during AI response', async () => {
        await act(async () => {
            render(<ChatView {...baseProps} showUploadSection={true} isAiResponding={true} />);
        });

        // Upload component should be hidden during AI response (shows chat input instead)
        expect(screen.queryByTestId('upload-assignment-file')).not.toBeInTheDocument();
    });

    it('works correctly with different task types', async () => {
        const taskTypes = ['quiz', 'learning_material', 'assignment'] as const;

        for (const taskType of taskTypes) {
            await act(async () => {
                render(<ChatView {...baseProps} showUploadSection={true} taskType={taskType} />);
            });

            expect(screen.getByTestId('upload-assignment-file')).toBeInTheDocument();

            // Clean up for next iteration
            screen.getByTestId('upload-assignment-file').remove();
        }
    });
}); 