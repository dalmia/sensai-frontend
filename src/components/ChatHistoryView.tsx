import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage, ScorecardItem } from '../types/quiz';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowDownToLine } from 'lucide-react';

// Code message display component
const CodeMessageDisplay = ({ code, language }: { code: string, language?: string }) => {
    // Check if the code contains language headers (e.g., "// JAVASCRIPT", "// HTML", etc.)
    const hasLanguageHeaders = code.includes('// ') && code.includes('\n');

    if (hasLanguageHeaders) {
        // Split the code by language sections
        const sections = code.split(/\/\/ ([A-Z]+)\n/).filter(Boolean);

        // Create an array of [language, code] pairs
        const languageSections = [];
        for (let i = 0; i < sections.length; i += 2) {
            if (i + 1 < sections.length) {
                languageSections.push([sections[i], sections[i + 1]]);
            }
        }

        return (
            <div className="w-full rounded bg-[#1D1D1D] overflow-hidden">
                {languageSections.map(([lang, codeSection], index) => (
                    <div key={index} className="mb-2 last:mb-0">
                        <div className="flex items-center justify-between bg-[#2D2D2D] px-3 py-1.5 text-xs text-gray-300">
                            <span>{lang}</span>
                        </div>
                        <pre className="p-3 overflow-x-auto text-xs text-gray-200">
                            <code>{codeSection}</code>
                        </pre>
                    </div>
                ))}
            </div>
        );
    }

    // If no language headers, display as a single code block
    return (
        <div className="w-full rounded bg-[#1D1D1D] overflow-hidden">
            <div className="flex items-center justify-between bg-[#2D2D2D] px-3 py-1.5 text-xs text-gray-300">
                <span>{language || 'code'}</span>
            </div>
            <pre className="p-3 overflow-x-auto text-xs text-gray-200">
                <code>{code}</code>
            </pre>
        </div>
    );
};

interface ChatHistoryViewProps {
    chatHistory: ChatMessage[];
    onViewScorecard: (scorecard: ScorecardItem[]) => void;
    isAiResponding: boolean;
    showPreparingReport: boolean;
    currentQuestionConfig?: any;
    onRetry?: () => void;
    taskType: string;
    showLearnerView?: boolean;
    onShowLearnerViewChange?: (show: boolean) => void;
    isAdminView?: boolean;
    onFileDownload?: (fileUuid: string, fileName: string) => void;
}

const ChatHistoryView: React.FC<ChatHistoryViewProps> = ({
    chatHistory,
    onViewScorecard,
    isAiResponding,
    showPreparingReport,
    currentQuestionConfig,
    taskType,
    onRetry,
    showLearnerView = false,
    onShowLearnerViewChange,
    isAdminView = false,
    onFileDownload,
}) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // State for current thinking message
    const [currentThinkingMessage, setCurrentThinkingMessage] = useState("");
    // State to track animation transition
    const [isTransitioning, setIsTransitioning] = useState(false);
    // Ref to store the interval ID for proper cleanup
    const messageIntervalRef = useRef<NodeJS.Timeout | null>(null);
    // Ref to store the timeout ID for proper cleanup
    const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Ref to store the current thinking message to avoid dependency issues
    const currentThinkingMessageRef = useRef("");
    // Ref to track if initial message has been set
    const initialMessageSetRef = useRef(false);

    // Preset list of thinking messages for the AI typing animation
    const thinkingMessages = taskType === 'learning_material'
        ? [
            "Thinking",
            "Preparing a response",
            "Gathering relevant details",
            "Crafting a clear explanation",
            "Finding the best way to help",
            "Putting together a helpful answer",
        ]
        : [
            "Analyzing your response",
            "Thinking",
            "Processing your answer",
            "Considering different angles",
            "Evaluating your submission",
            "Looking at your approach",
            "Checking against criteria",
            "Formulating feedback",
            "Preparing a thoughtful response",
            "Finding the best way to help",
            "Reflecting on your answer",
            "Connecting the dots",
            "Crafting personalized feedback",
            "Examining your reasoning",
            "Assessing key concepts"
        ];

    // Update the ref when the state changes
    useEffect(() => {
        currentThinkingMessageRef.current = currentThinkingMessage;
    }, [currentThinkingMessage]);

    // Effect to change the thinking message every 2 seconds
    useEffect(() => {
        // Only set up the interval if AI is responding
        if (!isAiResponding) {
            // Clear any existing intervals/timeouts when AI stops responding
            if (messageIntervalRef.current) {
                clearInterval(messageIntervalRef.current);
                messageIntervalRef.current = null;
            }
            if (transitionTimeoutRef.current) {
                clearTimeout(transitionTimeoutRef.current);
                transitionTimeoutRef.current = null;
            }
            // Reset the initial message flag when AI stops responding
            initialMessageSetRef.current = false;
            return;
        }

        // Set initial message only if it hasn't been set yet
        if (!initialMessageSetRef.current) {
            const randomMessage = thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
            setCurrentThinkingMessage(randomMessage);
            setIsTransitioning(false);
            initialMessageSetRef.current = true;
        }

        // Set interval to change message every 2 seconds
        messageIntervalRef.current = setInterval(() => {
            // First set transition state to true (starting the fade-out)
            setIsTransitioning(true);

            // After a short delay, change the message and reset transition state
            transitionTimeoutRef.current = setTimeout(() => {
                // Get current message from the ref to avoid dependency issues
                const currentMessage = currentThinkingMessageRef.current;

                // Filter out the current message to avoid repetition
                const availableMessages = thinkingMessages.filter(msg => msg !== currentMessage);

                // Select a random message from the filtered list
                const newRandomIndex = Math.floor(Math.random() * availableMessages.length);
                setCurrentThinkingMessage(availableMessages[newRandomIndex]);

                // Reset transition state (starting the fade-in)
                setIsTransitioning(false);
            }, 200); // Short delay for the transition effect
        }, 2000);

        // Clean up interval and timeout on unmount or when dependencies change
        return () => {
            if (messageIntervalRef.current) {
                clearInterval(messageIntervalRef.current);
                messageIntervalRef.current = null;
            }
            if (transitionTimeoutRef.current) {
                clearTimeout(transitionTimeoutRef.current);
                transitionTimeoutRef.current = null;
            }
        };
    }, [isAiResponding]);

    // Effect to scroll to the bottom of the chat when new messages are added
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Custom styles for the animations
    const customStyles = `
    @keyframes pulsate {
      0% {
        transform: scale(0.9);
        opacity: 0.8;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.6;
      }
      100% {
        transform: scale(0.9);
        opacity: 0.8;
      }
    }
    
    .pulsating-circle {
      animation: pulsate 1.5s ease-in-out infinite;
    }

    @keyframes highlightText {
      0% {
        background-position: -200% center;
      }
      100% {
        background-position: 300% center;
      }
    }

    .highlight-animation {
      background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.9) 50%, 
      rgba(255,255,255,0) 75%);
      background-size: 200% auto;
      color: rgba(255, 255, 255, 0.6);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: highlightText 2s linear infinite;
      transition: opacity 0.2s ease-in-out;
    }

    .message-transition-out {
      opacity: 0.5;
    }

    .message-transition-in {
      opacity: 1;
    }
    
    /* Add custom word break for long words */
    .break-anywhere {
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: break-word;
      hyphens: none;
    }
    `;

    // Helper to determine if "View Report" button should be shown
    const shouldShowViewReport = (message: ChatMessage) => {
        // Check if message is from AI and has scorecard data
        return (
            message.sender === 'ai' &&
            message.scorecard &&
            message.scorecard.length > 0 &&
            // Check if the current question is configured for report responses
            currentQuestionConfig?.questionType === 'subjective'
        );
    };

    // Helper to check if a message is an error message
    const isErrorMessage = (message: ChatMessage) => {
        return message.sender === 'ai' &&
            (message.isError);
    };

    // Find the last AI message index
    const lastAiMessageIndex = chatHistory.reduce((lastIndex, message, index) => {
        return message.sender === 'ai' ? index : lastIndex;
    }, -1);

    return (
        <>
            <style jsx>{customStyles}</style>
            <div
                ref={chatContainerRef}
                className="h-full overflow-y-auto w-full hide-scrollbar pb-8"
            >
                <div className="flex flex-col space-y-6 pr-2">
                    {chatHistory.map((message, index) => (
                        <div key={message.id}>
                            <div
                                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`rounded-2xl px-4 py-2 ${message.messageType === 'audio'
                                        ? 'w-full sm:w-[75%]'
                                        : message.messageType === 'code'
                                            ? 'bg-[#282828] text-white w-[90%]'
                                            : `${message.sender === 'user' ? 'bg-[#333333] text-white' : 'bg-[#1A1A1A] text-white'} max-w-[75%]`
                                        }`}
                                >
                                    {message.sender === 'ai' && index === lastAiMessageIndex &&
                                        currentQuestionConfig?.responseType === 'exam' &&
                                        onShowLearnerViewChange &&
                                        isAdminView && (
                                            <div className={`-mx-4 -mt-2 mb-4 px-4 pt-3 pb-2 rounded-t-2xl border-b border-[#35363a] ${message.is_correct !== undefined
                                                ? message.is_correct
                                                    ? 'bg-green-900/40'
                                                    : 'bg-red-900/40'
                                                : 'bg-[#232428]'
                                                }`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center">
                                                        {message.is_correct !== undefined && (
                                                            <div className={`mr-2 w-5 h-5 rounded-full flex items-center justify-center ${message.is_correct ? 'bg-green-600' : 'bg-red-600'
                                                                }`}>
                                                                {message.is_correct ? (
                                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                        )}
                                                        <span className="text-sm text-gray-300 font-light select-none">Show result</span>
                                                    </div>
                                                    <button
                                                        onClick={() => onShowLearnerViewChange(!showLearnerView)}
                                                        className={`relative cursor-pointer inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-200 focus:outline-none
                                                            ${!showLearnerView ? 'bg-white border-gray-400' : 'bg-[#444950] border-[#444950]'}
                                                        `}
                                                        aria-pressed={!showLearnerView}
                                                        aria-label="Show result toggle"
                                                    >
                                                        <span
                                                            className={`inline-block h-5 w-5 transform rounded-full bg-black shadow-md transition-transform duration-200
                                                                ${!showLearnerView ? 'translate-x-5' : 'translate-x-1'}
                                                            `}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    {message.messageType === 'audio' && message.audioData ? (
                                        <div className="flex flex-col space-y-2">
                                            <audio
                                                controls
                                                className="w-full"
                                                src={`data:audio/wav;base64,${message.audioData}`}
                                            />
                                        </div>
                                    ) : message.messageType === 'code' ? (
                                        <CodeMessageDisplay
                                            code={message.content}
                                            language={
                                                Array.isArray(currentQuestionConfig?.codingLanguages) &&
                                                    currentQuestionConfig?.codingLanguages.length > 0
                                                    ? currentQuestionConfig?.codingLanguages[0]
                                                    : undefined
                                            }
                                        />
                                    ) : (
                                        <div>
                                            {message.sender === 'ai' ? (
                                                <div className="text-sm font-sans break-words break-anywhere markdown-content">
                                                    <Markdown
                                                        remarkPlugins={[remarkGfm]}
                                                    >
                                                        {message.content}
                                                    </Markdown>
                                                        </div>
                                            ) : (
                                                            <pre className="text-sm break-words whitespace-pre-wrap break-anywhere font-sans">
                                                                {message.content}
                                                            </pre>
                                            )}
                                            {shouldShowViewReport(message) && (
                                                <div className="my-3">
                                                    <button
                                                        onClick={() => onViewScorecard(message.scorecard || [])}
                                                        className="bg-[#333333] text-white px-4 py-2 rounded-full text-xs hover:bg-[#444444] transition-colors cursor-pointer flex items-center"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                        </svg>
                                                        View Report
                                                    </button>
                                                </div>
                                            )}
                                            {isErrorMessage(message) && onRetry && (
                                                <div className="my-3">
                                                    <button
                                                        onClick={onRetry}
                                                        className="bg-[#333333] text-white px-4 py-2 mb-2 rounded-full text-xs hover:bg-[#444444] transition-colors cursor-pointer flex items-center"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                        Retry
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {message.messageType === 'file' && message.fileUuid && onFileDownload && (
                                <div
                                    className={`mt-1 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <button
                                        onClick={() => {
                                            const fileUuid = message.fileUuid!;
                                            const fileName = message.fileName!;
                                            onFileDownload(fileUuid, fileName);
                                        }}
                                        className="flex items-center gap-2 text-xs hover:text-gray-300 transition-colors cursor-pointer"
                                    >
                                        <ArrowDownToLine className="w-3 h-3" />
                                        <span>Download</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Show "Preparing report" as an AI message */}
                    {showPreparingReport && (
                        <div className="flex justify-start">
                            <div className="rounded-2xl px-4 py-3 bg-[#1A1A1A] text-white max-w-[75%]">
                                <div className="flex items-center">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-light">Preparing report</p>
                                        <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AI typing animation - with pulsating dot and changing text */}
                    {isAiResponding && (
                        <div className="flex justify-start items-center my-2 ml-2">
                            <div className="flex items-center justify-center min-w-[20px] min-h-[20px] mr-2">
                                <div
                                    className="w-2.5 h-2.5 bg-white rounded-full pulsating-circle"
                                ></div>
                            </div>
                            <div className={`${isTransitioning ? 'message-transition-out' : 'message-transition-in'}`}>
                                <span className="highlight-animation text-sm">
                                    {currentThinkingMessage}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add global styles for animation */}
            <style jsx global>{`
                @keyframes highlightText {
                    0% { background-position: -200% center; }
                    100% { background-position: 300% center; }
                }
                
                .highlight-animation {
                    background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 75%);
                    background-size: 200% auto;
                    color: rgba(255, 255, 255, 0.6);
                    background-clip: text;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: highlightText 2s linear infinite;
                    transition: opacity 0.2s ease-in-out;
                }

                /* Markdown content styling */
                .markdown-content {
                    /* General spacing */
                    line-height: 1.6;
                    
                    /* Headings */
                    & h1, & h2, & h3, & h4, & h5, & h6 {
                        margin-top: 1.5em;
                        margin-bottom: 0.75em;
                        line-height: 1.3;
                        font-weight: 400;
                    }
                    
                    & h1 {
                        font-size: 1.5rem;
                    }
                    
                    & h2 {
                        font-size: 1.3rem;
                    }
                    
                    & h3 {
                        font-size: 1.2rem;
                    }
                    
                    & h4, & h5, & h6 {
                        font-size: 1.1rem;
                    }
                    
                    /* Paragraphs */
                    & p {
                        margin-bottom: 1em;
                    }
                    
                    /* Lists */
                    & ul, & ol {
                        margin-top: 0.5em;
                        margin-bottom: 1em;
                        padding-left: 1.5em;
                    }
                    
                    & li {
                        margin-bottom: 0.3em;
                    }
                    
                    & li > ul, & li > ol {
                        margin-top: 0.3em;
                        margin-bottom: 0.5em;
                    }
                    
                    /* Blockquotes */
                    & blockquote {
                        border-left: 3px solid #444;
                        padding-left: 1em;
                        margin-left: 0;
                        margin-right: 0;
                        margin-top: 1em;
                        margin-bottom: 1em;
                        color: #bbb;
                    }
                    
                    /* Code blocks */
                    & pre {
                        margin-top: 0.8em;
                        margin-bottom: 1em;
                        padding: 0.8em;
                        background-color: #282828;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                    
                    & code {
                        background-color: rgba(40, 40, 40, 0.6);
                        border-radius: 3px;
                        padding: 0.2em 0.4em;
                        font-size: 0.9em;
                    }
                    
                    & pre > code {
                        background-color: transparent;
                        padding: 0;
                        border-radius: 0;
                    }
                    
                    /* Tables */
                    & table {
                        margin-top: 1em;
                        margin-bottom: 1em;
                        border-collapse: collapse;
                        width: 100%;
                    }
                    
                    & th, & td {
                        border: 1px solid #444;
                        padding: 0.5em 0.8em;
                        text-align: left;
                    }
                    
                    & th {
                        background-color: #2d2d2d;
                    }
                    
                    /* Horizontal rule */
                    & hr {
                        margin-top: 1.5em;
                        margin-bottom: 1.5em;
                        border: 0;
                        border-top: 1px solid #444;
                    }
                    
                    /* Images */
                    & img {
                        max-width: 100%;
                        margin-top: 0.8em;
                        margin-bottom: 0.8em;
                    }
                    
                    /* Links */
                    & a {
                        color: #5e9eff;
                        text-decoration: none;
                    }
                    
                    & a:hover {
                        text-decoration: underline;
                    }
                }
            `}</style>
        </>
    );
};

export default ChatHistoryView;