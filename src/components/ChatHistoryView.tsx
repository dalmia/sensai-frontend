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
            <div
                className="w-full rounded overflow-hidden border bg-gray-50 border-gray-200 dark:bg-[#1D1D1D] dark:border-[#35363a]"
            >
                {languageSections.map(([lang, codeSection], index) => (
                    <div key={index} className="mb-2 last:mb-0">
                        <div className="flex items-center justify-between px-3 py-1.5 text-xs bg-gray-100 text-gray-600 dark:bg-[#2D2D2D] dark:text-gray-300">
                            <span>{lang}</span>
                        </div>
                        <pre className="p-3 overflow-x-auto text-xs text-gray-800 dark:text-gray-200">
                            <code>{codeSection}</code>
                        </pre>
                    </div>
                ))}
            </div>
        );
    }

    // If no language headers, display as a single code block
    return (
        <div
            className="w-full rounded overflow-hidden border bg-gray-50 border-gray-200 dark:bg-[#1D1D1D] dark:border-[#35363a]"
        >
            <div className="flex items-center justify-between px-3 py-1.5 text-xs bg-gray-100 text-gray-600 dark:bg-[#2D2D2D] dark:text-gray-300">
                <span>{language || 'code'}</span>
            </div>
            <pre className="p-3 overflow-x-auto text-xs text-gray-800 dark:text-gray-200">
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

    const toSafeDate = (ts: unknown): Date | null => {
        if (!ts) return null;
        const date = ts instanceof Date ? ts : new Date(ts as any);
        if (Number.isNaN(date.getTime())) return null;
        return date;
    };

    const getLocalDateKey = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formatMessageDayLabel = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayKey = getLocalDateKey(today);

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayKey = getLocalDateKey(yesterday);

        const key = getLocalDateKey(date);
        if (key === todayKey) return 'Today';
        if (key === yesterdayKey) return 'Yesterday';

        return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
    };

    const formatMessageTime = (ts: unknown) => {
        if (!ts) return '';
        const date = ts instanceof Date ? ts : new Date(ts as any);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
    };

    return (
        <>
            <style jsx>{customStyles}</style>
                <div
                    ref={chatContainerRef}
                    className="h-full overflow-y-auto w-full hide-scrollbar pb-8 bg-white/60 dark:bg-transparent"
                >
                <div className="flex flex-col space-y-6 px-2">
                    {chatHistory.map((message, index) => (
                        <div key={message.id}>
                            {(() => {
                                const currentDate = toSafeDate((message as any).timestamp);
                                if (!currentDate) return null;

                                const prevDate = index > 0 ? toSafeDate((chatHistory[index - 1] as any)?.timestamp) : null;
                                const currentKey = getLocalDateKey(currentDate);
                                const prevKey = prevDate ? getLocalDateKey(prevDate) : null;
                                const shouldShow = index === 0 || currentKey !== prevKey;

                                if (!shouldShow) return null;

                                return (
                                    <div className="flex justify-center mb-2">
                                        <div className="px-3 py-1 rounded-full text-xs font-light select-none bg-gray-100 text-gray-700 border border-gray-200 dark:bg-[#232428] dark:text-gray-200 dark:border-transparent">
                                            {formatMessageDayLabel(currentDate)}
                                        </div>
                                    </div>
                                );
                            })()}
                            <div
                                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {(() => {
                                    const isFileMessage = message.messageType === 'file' && !!message.fileUuid && !!onFileDownload;

                                    // Timestamp (user messages only, shown below the bubble)
                                    const shouldShowUserTimestamp = message.sender === 'user';
                                    const messageTime = shouldShowUserTimestamp ? formatMessageTime((message as any).timestamp) : '';
                                    const timestampEl = messageTime ? (
                                        <span className="mt-1 text-[10px] leading-none font-light select-none text-gray-500 dark:text-gray-400">
                                            {messageTime}
                                        </span>
                                    ) : null;

                                    const bubbleVariant = (() => {
                                    if (message.messageType === 'audio') {
                                        const audioBase = message.sender === 'user'
                                            ? 'bg-[#f3f4f6] text-slate-900 border border-gray-200 dark:bg-transparent dark:text-white dark:border-transparent'
                                            : 'bg-white text-slate-900 border border-gray-200 dark:bg-[#1A1A1A] dark:text-white dark:border-transparent';
                                        return `${audioBase} w-full sm:w-[75%]`;
                                    }

                                    if (message.messageType === 'code') {
                                        // Code blocks already have their own container styling (CodeMessageDisplay).
                                        // Keep the chat "bubble" transparent to avoid double backgrounds/padding.
                                        return 'bg-transparent text-slate-900 dark:bg-transparent dark:text-white border-0 w-[90%]';
                                    }

                                    const textBase = message.sender === 'user'
                                        ? 'bg-[#f3f4f6] text-slate-900 border border-gray-200 dark:bg-[#333333] dark:text-white dark:border-transparent'
                                        : 'bg-white text-slate-900 border border-gray-200 dark:bg-[#1A1A1A] dark:text-white dark:border-transparent';
                                    return `${textBase} max-w-[75%]`;
                                    })();

                                    // Audio + code shouldn't have the extra bubble padding (prevents "double container" look)
                                    const bubbleClassName = `rounded-2xl ${(message.messageType === 'audio' || message.messageType === 'code') ? 'py-2' : 'px-4 py-2'} ${bubbleVariant}`;

                                    const bubble = (
                                        <div className={bubbleClassName}>
                                            {message.sender === 'ai' && index === lastAiMessageIndex &&
                                                currentQuestionConfig?.responseType === 'exam' &&
                                                onShowLearnerViewChange &&
                                                isAdminView && (
                                                    <div className={`-mx-4 -mt-2 mb-4 px-4 pt-3 pb-2 rounded-t-2xl border-b border-gray-200 dark:border-[#35363a] ${message.is_correct !== undefined
                                                        ? message.is_correct
                                                            ? 'bg-emerald-100 dark:bg-green-900/40'
                                                            : 'bg-rose-100 dark:bg-red-900/40'
                                                        : 'bg-gray-100 dark:bg-[#232428]'
                                                        }`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center">
                                                                {message.is_correct !== undefined && (
                                                                    <div className={`mr-2 w-5 h-5 rounded-full flex items-center justify-center ${message.is_correct ? 'bg-green-600' : 'bg-red-600'}`}>
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
                                                                <span className="text-sm font-light select-none text-gray-700 dark:text-gray-300">Show result</span>
                                                            </div>
                                                            <button
                                                                onClick={() => onShowLearnerViewChange(!showLearnerView)}
                                                                className={`relative cursor-pointer inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-200 focus:outline-none
                                                                    ${!showLearnerView
                                                                        ? 'bg-white border-gray-300 dark:border-gray-400'
                                                                        : 'bg-gray-300 border-gray-300 dark:bg-[#444950] dark:border-[#444950]'}
                                                                `}
                                                                aria-pressed={!showLearnerView}
                                                                aria-label="Show result toggle"
                                                                type="button"
                                                            >
                                                                <span
                                                                    className={`inline-block h-5 w-5 transform rounded-full shadow-md transition-transform duration-200
                                                                        ${!showLearnerView ? 'translate-x-5 bg-black' : 'translate-x-1 bg-white dark:bg-black'}
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
                                                                className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-[#333333] dark:hover:bg-[#444444] px-4 py-2 rounded-full text-xs transition-colors cursor-pointer flex items-center"
                                                                type="button"
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
                                                                className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-[#333333] dark:hover:bg-[#444444] px-4 py-2 mb-2 rounded-full text-xs transition-colors cursor-pointer flex items-center"
                                                                type="button"
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
                                    );

                                    const bubbleWithTimestamp = (message.sender === 'user' && timestampEl)
                                        ? (
                                            <div className="w-full flex flex-col items-end">
                                                {bubble}
                                                {timestampEl}
                                            </div>
                                        )
                                        : bubble;

                                    if (!isFileMessage) return bubbleWithTimestamp;

                                    return (
                                        <div className="w-full flex items-start justify-end gap-2">
                                            <div className="flex-1 min-w-0">
                                                {bubbleWithTimestamp}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const fileUuid = message.fileUuid!;
                                                    const fileName = message.fileName!;
                                                    onFileDownload(fileUuid, fileName);
                                                }}
                                                className="shrink-0 mt-1 w-8 h-8 rounded-full transition-colors cursor-pointer flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white dark:bg-[#232428] dark:hover:bg-[#2D2D2D] dark:text-gray-200"
                                                aria-label="Download file"
                                                title="Download"
                                                type="button"
                                            >
                                                <ArrowDownToLine className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    ))}

                    {/* Show "Preparing report" as an AI message */}
                    {showPreparingReport && (
                        <div className="flex justify-start">
                            <div className="rounded-2xl px-4 py-3 max-w-[75%] bg-indigo-50 text-indigo-900 border border-indigo-200 dark:bg-[#1A1A1A] dark:text-white dark:border-transparent">
                                <div className="flex items-center">
                                    <div className="w-4 h-4 border-2 rounded-full animate-spin mr-3 border-indigo-500 border-t-transparent dark:border-white dark:border-t-transparent"></div>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-light text-indigo-900 dark:text-white">Preparing report</p>
                                        <p className="text-xs mt-1 text-indigo-600 dark:text-gray-400">This may take a moment</p>
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
                                    className="w-2.5 h-2.5 rounded-full pulsating-circle bg-slate-400 dark:bg-white"
                                ></div>
                            </div>
                            <div className={`${isTransitioning ? 'message-transition-out' : 'message-transition-in'}`}>
                                <span className="text-sm thinking-text-animation">
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
                
                /* CSS variables for theme-aware gradients - these update instantly on theme change */
                :root {
                    --thinking-gradient-start: rgba(15, 23, 42, 0);
                    --thinking-gradient-mid: rgba(15, 23, 42, 0.65);
                    --thinking-text-color: rgba(51, 65, 85, 0.7);
                }
                
                :root.dark, .dark {
                    --thinking-gradient-start: rgba(255, 255, 255, 0);
                    --thinking-gradient-mid: rgba(255, 255, 255, 0.9);
                    --thinking-text-color: rgba(255, 255, 255, 0.8);
                }
                
                /* Single class using CSS variables - responds to theme changes without reload */
                .thinking-text-animation {
                    background: linear-gradient(
                        to right,
                        var(--thinking-gradient-start) 0%,
                        var(--thinking-gradient-mid) 25%,
                        var(--thinking-gradient-mid) 50%,
                        var(--thinking-gradient-start) 75%
                    );
                    background-size: 200% auto;
                    color: var(--thinking-text-color);
                    background-clip: text;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: highlightText 2s linear infinite;
                    transition: opacity 0.2s ease-in-out;
                }

                /* Markdown content styling - Light mode (default) */
                .markdown-content {
                    /* General spacing */
                    line-height: 1.6;
                    color: #1f2937;
                    
                    /* Headings */
                    & h1, & h2, & h3, & h4, & h5, & h6 {
                        margin-top: 1.5em;
                        margin-bottom: 0.75em;
                        line-height: 1.3;
                        font-weight: 300;
                        color: #0f172a;
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
                        border-left: 3px solid #cbd5f5;
                        padding-left: 1em;
                        margin-left: 0;
                        margin-right: 0;
                        margin-top: 1em;
                        margin-bottom: 1em;
                        color: #475569;
                        background-color: #eef2ff;
                    }
                    
                    /* Code blocks */
                    & pre {
                        margin-top: 0.8em;
                        margin-bottom: 1em;
                        padding: 0.8em;
                        background-color: #0f172a;
                        color: #e2e8f0;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                    
                    & code {
                        background-color: rgba(14, 116, 144, 0.12);
                        color: #0f172a;
                        border-radius: 3px;
                        padding: 0.2em 0.4em;
                        font-size: 0.9em;
                    }
                    
                    & pre > code {
                        background-color: transparent;
                        color: inherit;
                        padding: 0;
                        border-radius: 0;
                    }
                    
                    /* Tables */
                    & table {
                        margin-top: 1em;
                        margin-bottom: 1em;
                        border-collapse: collapse;
                        width: 100%;
                        border-color: #cbd5f5;
                    }
                    
                    & th, & td {
                        border: 1px solid #cbd5f5;
                        padding: 0.5em 0.8em;
                        text-align: left;
                    }
                    
                    & th {
                        background-color: #e2e8f0;
                        color: #0f172a;
                    }
                    
                    /* Horizontal rule */
                    & hr {
                        margin-top: 1.5em;
                        margin-bottom: 1.5em;
                        border: 0;
                        border-top: 1px solid #cbd5f5;
                    }
                    
                    /* Images */
                    & img {
                        max-width: 100%;
                        margin-top: 0.8em;
                        margin-bottom: 0.8em;
                    }
                    
                    /* Links */
                    & a {
                        color: #2563eb;
                        text-decoration: none;
                    }
                    
                    & a:hover {
                        text-decoration: underline;
                    }
                }

                /* Markdown content styling - Dark mode */
                .dark .markdown-content {
                    color: #e2e8f0;
                    
                    & h1, & h2, & h3, & h4, & h5, & h6 {
                        color: #f1f5f9;
                        font-weight: 400;
                    }
                    
                    & blockquote {
                        border-left-color: #444;
                        color: #bbb;
                        background-color: transparent;
                    }
                    
                    & pre {
                        background-color: #282828;
                        color: #e2e8f0;
                    }
                    
                    & code {
                        background-color: rgba(40, 40, 40, 0.6);
                        color: #e2e8f0;
                    }
                    
                    & pre > code {
                        background-color: transparent;
                        color: inherit;
                    }
                    
                    & table {
                        border-color: #444;
                    }
                    
                    & th, & td {
                        border-color: #444;
                    }
                    
                    & th {
                        background-color: #2d2d2d;
                        color: #e2e8f0;
                    }
                    
                    & hr {
                        border-top-color: #444;
                    }
                    
                    & a {
                        color: #5e9eff;
                    }
                }
            `}</style>
        </>
    );
};

export default ChatHistoryView;