import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock react-markdown and remark-gfm to avoid ES module issues
jest.mock('react-markdown', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="markdown-content">{children}</div>,
}));
jest.mock('remark-gfm', () => ({
    __esModule: true,
    default: () => ({}),
}));

import ChatHistoryView from '../../components/ChatHistoryView';
import { ChatMessage, ScorecardItem } from '../../types/quiz';

// Mock setTimeout and setInterval for testing animations
jest.useFakeTimers();

describe('ChatHistoryView Component', () => {
    const mockOnViewScorecard = jest.fn();
    const mockOnRetry = jest.fn();

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
            content: 'I need help with my code.',
            sender: 'user',
            timestamp: new Date(),
            messageType: 'text'
        },
        {
            id: '3',
            content: 'Here is my code:\n```\nfunction add(a, b) {\n  return a + b;\n}\n```',
            sender: 'user',
            timestamp: new Date(),
            messageType: 'code'
        },
        {
            id: '4',
            content: 'I see your code. Let me help you with that.',
            sender: 'ai',
            timestamp: new Date(),
            messageType: 'text'
        }
    ];

    // Creating mock scorecard items with correct structure
    const mockScorecardItems: ScorecardItem[] = [
        {
            category: 'Logic',
            feedback: {
                correct: 'Good logical approach',
                wrong: 'Logical approach needs improvement'
            },
            score: 8,
            max_score: 10
        },
        {
            category: 'Implementation',
            feedback: {
                correct: 'Good implementation',
                wrong: 'Implementation could be improved'
            },
            score: 7,
            max_score: 10
        }
    ];

    const mockScorecardMessage: ChatMessage = {
        id: '5',
        content: 'Here is your assessment.',
        sender: 'ai',
        timestamp: new Date(),
        messageType: 'text',
        scorecard: mockScorecardItems
    };

    const mockCodeMessage: ChatMessage = {
        id: '6',
        content: '// JAVASCRIPT\nfunction multiply(a, b) {\n  return a * b;\n}\n\n// PYTHON\ndef multiply(a, b):\n    return a * b',
        sender: 'ai',
        timestamp: new Date(),
        messageType: 'code'
    };

    const mockErrorMessage: ChatMessage = {
        id: '7',
        content: 'An error occurred',
        sender: 'ai',
        timestamp: new Date(),
        messageType: 'text',
        isError: true
    };

    const defaultProps = {
        chatHistory: mockChatHistory,
        onViewScorecard: mockOnViewScorecard,
        isAiResponding: false,
        showPreparingReport: false,
        taskType: 'quiz',
        onRetry: mockOnRetry
    };

    beforeEach(() => {
        // Clear mocks before each test
        mockOnViewScorecard.mockClear();
        mockOnRetry.mockClear();
    });

    afterEach(() => {
        // Clear any jest timers
        jest.clearAllTimers();
    });

    it('renders chat messages correctly', () => {
        render(<ChatHistoryView {...defaultProps} />);

        // Date divider should render for the first message of the day
        expect(screen.getByText('Today')).toBeInTheDocument();

        // Check if all messages are rendered
        expect(screen.getByText('Hello, how can I help you?')).toBeInTheDocument();
        expect(screen.getByText('I need help with my code.')).toBeInTheDocument();
        expect(screen.getByText('I see your code. Let me help you with that.')).toBeInTheDocument();

        // Check if code is rendered
        expect(screen.getByText(/function add\(a, b\) {/)).toBeInTheDocument();
    });

    it('renders code messages with language headers correctly', () => {
        const propsWithCodeMessage = {
            ...defaultProps,
            chatHistory: [...mockChatHistory, mockCodeMessage]
        };

        render(<ChatHistoryView {...propsWithCodeMessage} />);

        // Check if language headers are shown
        expect(screen.getByText('JAVASCRIPT')).toBeInTheDocument();
        expect(screen.getByText('PYTHON')).toBeInTheDocument();

        // Check if code content is shown
        expect(screen.getByText(/function multiply\(a, b\) {/)).toBeInTheDocument();
        expect(screen.getByText(/def multiply\(a, b\):/)).toBeInTheDocument();
    });

    it('shows scorecard button when a message contains scorecard data', () => {
        const propsWithScorecard = {
            ...defaultProps,
            chatHistory: [...mockChatHistory, mockScorecardMessage],
            currentQuestionConfig: { questionType: 'subjective' }
        };

        render(<ChatHistoryView {...propsWithScorecard} />);

        // Find the "View Report" button
        const viewReportButton = screen.getByRole('button', { name: /View Report/i });
        expect(viewReportButton).toBeInTheDocument();

        // Click the button
        fireEvent.click(viewReportButton);

        // Verify the callback was called with the correct data
        expect(mockOnViewScorecard).toHaveBeenCalledWith(mockScorecardMessage.scorecard);
    });

    it('displays "AI is thinking" animation when AI is responding', () => {
        render(
            <ChatHistoryView
                {...defaultProps}
                isAiResponding={true}
            />
        );

        // Check for some thinking message (specific text might vary)
        const thinkingElement = screen.getByText(/.+/i, { selector: '.highlight-animation' });
        expect(thinkingElement).toBeInTheDocument();

        // Advance timers to see message change
        act(() => {
            jest.advanceTimersByTime(2200); // 2000ms for interval + 200ms for transition
        });

        // Should still have a thinking message element
        expect(screen.getByText(/.+/i, { selector: '.highlight-animation' })).toBeInTheDocument();
    });

    it('displays error messages correctly', () => {
        const propsWithError = {
            ...defaultProps,
            chatHistory: [...mockChatHistory, mockErrorMessage]
        };

        render(<ChatHistoryView {...propsWithError} />);

        // Check if error message is shown
        expect(screen.getByText('An error occurred')).toBeInTheDocument();

        // Check if retry button is shown and works
        const retryButton = screen.getByRole('button', { name: /Retry/i });
        expect(retryButton).toBeInTheDocument();

        fireEvent.click(retryButton);
        expect(mockOnRetry).toHaveBeenCalled();
    });

    it('shows "Preparing your report" message when showPreparingReport is true', () => {
        render(
            <ChatHistoryView
                {...defaultProps}
                showPreparingReport={true}
            />
        );

        expect(screen.getByText('Preparing report')).toBeInTheDocument();
        expect(screen.getByText('This may take a moment')).toBeInTheDocument();
    });

    it('renders different thinking messages for learning_material task type', () => {
        render(
            <ChatHistoryView
                {...defaultProps}
                isAiResponding={true}
                taskType="learning_material"
            />
        );

        // Look for any thinking message in the highlight-animation element
        const thinkingMsg = screen.getByText(/.+/i, { selector: '.highlight-animation' });
        expect(thinkingMsg).toBeInTheDocument();
    });

    it('handles empty chat history', () => {
        render(
            <ChatHistoryView
                {...defaultProps}
                chatHistory={[]}
            />
        );

        // Should not crash and should render the container
        const chatContainer = document.querySelector('.overflow-y-auto');
        expect(chatContainer).toBeInTheDocument();
    });

    it('applies styling to user and AI messages differently', () => {
        render(<ChatHistoryView {...defaultProps} />);

        // Check for message containers with the expected background colors
        const userMessages = document.querySelectorAll('.bg-\\[\\#333333\\]');
        const aiMessages = document.querySelectorAll('.bg-\\[\\#1A1A1A\\]');

        // Verify there are user message containers
        expect(userMessages.length).toBeGreaterThan(0);

        // Verify there are AI message containers
        expect(aiMessages.length).toBeGreaterThan(0);
    });
}); 