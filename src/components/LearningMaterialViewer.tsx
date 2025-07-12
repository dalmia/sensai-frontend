"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, CheckCircle, HelpCircle, MoreVertical, Menu, MoreHorizontal, Settings, PlusCircle, ListChecks } from "lucide-react";

// Add custom styles for dark mode
import "./editor-styles.css";

// Import the BlockNoteEditor component
import BlockNoteEditor from "./BlockNoteEditor";
import { TaskData } from "@/types";
import { safeLocalStorage } from "@/lib/utils/localStorage";

// Add import for ChatView
import ChatView from "./ChatView";
import { ChatMessage } from "../types/quiz";
import { useAuth } from "@/lib/auth";

interface LearningMaterialViewerProps {
    taskId?: string;
    userId?: string;
    isDarkMode?: boolean;
    className?: string;
    readOnly?: boolean;
    viewOnly?: boolean;
    onMarkComplete?: () => void;
}

export default function LearningMaterialViewer({
    taskId,
    userId = '',
    isDarkMode = true,
    className = "",
    readOnly = true,
    viewOnly = false,
    onMarkComplete,
}: LearningMaterialViewerProps) {
    const { user } = useAuth();

    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [taskData, setTaskData] = useState<TaskData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Add state for button animation
    const [showButtonEntrance, setShowButtonEntrance] = useState(true);
    const [showButtonPulse, setShowButtonPulse] = useState(false);

    // Check if user has clicked the button before
    const [hasClickedFabButton, setHasClickedFabButton] = useState(false);

    // Add state for mobile menu
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    // Add state for chat view
    const [showChatView, setShowChatView] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isAiResponding, setIsAiResponding] = useState(false);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Add state to track viewport size
    const [isMobileView, setIsMobileView] = useState(false);
    // Add state for chat exit animation
    const [isChatClosing, setIsChatClosing] = useState(false);

    // Mobile view mode for responsive layout
    const [mobileViewMode, setMobileViewMode] = useState<'content-full' | 'chat-full' | 'split'>('split');

    const initialContent = taskData?.blocks && taskData.blocks.length > 0 ? taskData.blocks : undefined;

    // Fetch task data when taskId changes
    useEffect(() => {
        if (taskId) {
            setIsLoading(true);

            // Use AbortController to cancel any in-flight requests
            const controller = new AbortController();

            fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}`, {
                signal: controller.signal
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch task: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    setTaskData(data);
                    setIsLoading(false);
                })
                .catch(error => {
                    // Ignore AbortError as it's expected when navigating away
                    if (error.name !== 'AbortError') {
                        console.error("Error fetching task data:", error);
                    }
                    setIsLoading(false);
                });

            // Clean up function will abort the fetch if the component unmounts
            // or if the effect runs again (i.e., taskId changes)
            return () => {
                controller.abort();
            };
        }
    }, [taskId]);

    // Check localStorage on component mount
    useEffect(() => {
        const hasClicked = safeLocalStorage.getItem('hasClickedLMActionsButton') === 'true';
        setHasClickedFabButton(hasClicked);
    }, []);

    // Add effect to manage button animation
    useEffect(() => {
        // Start entrance animation
        setShowButtonEntrance(true);

        // After entrance animation completes, only start pulse if user hasn't clicked before
        const timer = setTimeout(() => {
            setShowButtonEntrance(false);
            // Only show pulse animation if user hasn't clicked the button before
            if (!hasClickedFabButton) {
                setShowButtonPulse(true);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [hasClickedFabButton]);

    // Function to toggle mobile menu
    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(prev => !prev);

        // If opening the menu, stop pulse animation and save to localStorage
        if (!isMobileMenuOpen) {
            setShowButtonPulse(false);

            // If this is the first time clicking, save to localStorage
            if (!hasClickedFabButton) {
                setHasClickedFabButton(true);
                safeLocalStorage.setItem('hasClickedFabButton', 'true');
            }
        }
    };

    // Add effect to handle clicks outside the mobile menu
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                mobileMenuRef.current &&
                !mobileMenuRef.current.contains(event.target as Node) &&
                !(event.target as HTMLElement).closest('.mobile-action-toggle-button')
            ) {
                setIsMobileMenuOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Add effect to handle viewport size changes
    useEffect(() => {
        const checkMobileView = () => {
            setIsMobileView(window.innerWidth <= 1024);
        };

        // Initial check
        checkMobileView();

        // Set up event listener for window resize
        window.addEventListener('resize', checkMobileView);

        // Clean up event listener
        return () => {
            window.removeEventListener('resize', checkMobileView);
        };
    }, []);

    // Handle chat input change
    const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setCurrentAnswer(e.target.value);
    };

    // Create a handle retry function to resubmit the last user message
    const handleRetry = () => {
        // Find the last user message
        const lastUserMessage = [...chatHistory].reverse().find(msg => msg.sender === 'user');
        if (lastUserMessage) {
            // Store the message content and type before modifying chat history
            const messageContent = lastUserMessage.content;
            const messageType = lastUserMessage.messageType === 'code' ? 'code' : 'text';

            // Filter the chat history to remove error messages and the last user message
            const filteredChatHistory = chatHistory
                .filter(msg => !msg.isError)
                .filter(msg => msg.id !== lastUserMessage.id);

            // Update the chat history state
            setChatHistory(filteredChatHistory);

            // Call handleChatSubmit with the filtered history
            handleChatSubmit(messageType, messageContent, filteredChatHistory);
        }
    };

    // Handle chat submit
    const handleChatSubmit = async (responseType: 'text' | 'code' = 'text', currentResponse?: string, currentChatHistory?: ChatMessage[]) => {
        // Use currentResponse if provided (for retry), otherwise use currentAnswer
        const messageContent = currentResponse || currentAnswer;

        if (!messageContent.trim() || !taskId) return;

        // Add user message to chat history
        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            content: messageContent,
            sender: 'user',
            timestamp: new Date(),
            messageType: responseType
        };

        const chatHistoryToUse = currentChatHistory ? currentChatHistory : chatHistory;

        // Use the updated chat history instead of relying on the chatHistory state
        const formattedChatHistory = chatHistoryToUse.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content,
            response_type: msg.messageType,
        }));

        setChatHistory(prev => [...prev, newMessage]);

        // Only clear currentAnswer if we're not using an override
        if (!currentResponse) {
            setCurrentAnswer('');
        }

        // Set AI responding state
        setIsAiResponding(true);
        setIsSubmitting(true);

        try {
            // Prepare the request body
            const responseContent = messageContent.trim();

            const requestBody = {
                user_response: responseContent,
                response_type: 'text',
                task_id: parseInt(taskId),
                chat_history: formattedChatHistory,
                task_type: 'learning_material',
                user_id: userId,
                user_email: user?.email,
            };

            let receivedAnyResponse = false;

            // Make the API call
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            // Get the response body as a readable stream
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('ReadableStream not supported');
            }

            // Create a unique ID for the AI message
            const aiMessageId = Date.now().toString();

            // Add initial empty AI message to chat history
            const aiMessage: ChatMessage = {
                id: aiMessageId,
                content: '',
                sender: 'ai',
                timestamp: new Date(),
                messageType: 'text'
            }

            // Process the stream
            let accumulatedContent = '';
            const processStream = async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                            break;
                        }

                        // Decode the value to text
                        const text = new TextDecoder().decode(value);

                        // Split the text into chunks (assuming each chunk is a JSON object)
                        const chunks = text.split('\n').filter(chunk => chunk.trim() !== '');

                        for (const chunk of chunks) {
                            try {
                                const data = JSON.parse(chunk);

                                // Process the response field if it exists
                                if (data.response) {
                                    // Replace content instead of accumulating it
                                    accumulatedContent = data.response;

                                    if (!receivedAnyResponse) {
                                        receivedAnyResponse = true;

                                        // Stop showing the animation
                                        setIsAiResponding(false);

                                        setChatHistory(prev => [...prev, {
                                            ...aiMessage,
                                            content: accumulatedContent
                                        }]);

                                    } else {

                                        // Update the AI message with the latest content
                                        setChatHistory(prev =>
                                            prev.map(msg =>
                                                msg.id === aiMessageId
                                                    ? { ...msg, content: accumulatedContent }
                                                    : msg
                                            )

                                        );
                                    }
                                }
                            } catch (e) {
                                console.error('Error parsing JSON chunk:', e);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error reading stream:', error);
                } finally {
                    // If we never received any feedback, also reset the AI responding state
                    if (!receivedAnyResponse) {
                        setIsAiResponding(false);
                    }

                    setIsSubmitting(false);
                }
            };

            // Start processing the stream
            await processStream();

        } catch (error) {
            console.error('Error in chat submission:', error);

            // Add error message to chat history
            const errorMessage: ChatMessage = {
                id: Date.now().toString(),
                content: 'There was an error while processing your response. Please try again.',
                sender: 'ai',
                timestamp: new Date(),
                messageType: 'text',
                isError: true
            };

            setChatHistory(prev => [...prev, errorMessage]);

            // Reset states
            setIsAiResponding(false);
            setIsSubmitting(false);
        }
    };

    // Function to handle audio submission
    const handleAudioSubmit = (audioBlob: Blob) => {
    };

    // Function to handle viewing scorecard
    const handleViewScorecard = (scorecard: any[]) => {
    };

    // Handle ask doubt button click
    const handleAskDoubt = () => {
        if (showChatView && isMobileView) {
            // For mobile view, start closing animation first
            setIsChatClosing(true);
            // Wait for animation to complete before hiding chat
            setTimeout(() => {
                setShowChatView(false);
                setIsChatClosing(false);
            }, 300); // Match this with animation duration
        } else {
            setShowChatView(prev => !prev);
        }
    };

    // Apply CSS classes based on mode
    useEffect(() => {
        const container = document.querySelector('.material-view-container');
        if (container) {
            // Remove existing mode classes
            container.classList.remove('mode-split', 'mode-content-full', 'mode-chat-full');
            // Add current mode class
            container.classList.add(`mode-${mobileViewMode}`);
        }
    }, [mobileViewMode]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div data-testid="loading-spinner" className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <div className={`w-full h-full ${className}`}>
            {/* Add responsive styles */}
            <style jsx>{`
                .two-column-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    height: 100%;
                    
                    @media (max-width: 1024px) {
                        grid-template-columns: 1fr;
                        grid-template-rows: 50% 50%;
                        height: 100%;
                        overflow: hidden;
                    }
                }

                .material-view-container {
                    height: 100% !important;
                    max-height: 100% !important;
                    overflow: hidden !important;
                    display: grid !important;
                }
                
                /* Make sure the content and chat containers properly fit their content */
                @media (max-width: 1024px) {               
                    .material-view-container {
                        height: 100% !important;
                        max-height: 100% !important;
                        overflow: hidden !important;
                        display: grid !important;
                        grid-template-rows: 50% 50% !important;
                        grid-template-columns: 1fr !important;
                    }

                    .content-container {
                        height: 100% !important;
                        max-height: 100% !important;
                        overflow-y: auto !important;
                        grid-row: 1 !important;
                    }
                    
                    .chat-container {
                        height: 100% !important;
                        max-height: 100% !important;
                        overflow: hidden !important;
                        display: flex !important;
                        flex-direction: column !important;
                        grid-row: 2 !important;
                    }
                    
                    /* Ensure the messages area scrolls but input stays fixed */
                    .chat-container .messages-container {
                        flex: 1 !important;
                        overflow-y: auto !important;
                        min-height: 0 !important;
                    }
                    
                    /* Ensure the input area stays at the bottom and doesn't scroll */
                    .chat-container .input-container {
                        flex-shrink: 0 !important;
                        position: sticky !important;
                        bottom: 0 !important;
                        background-color: #111111 !important;
                        z-index: 10 !important;
                        padding-top: 0.5rem !important;
                        border-top: 1px solid #222222 !important;
                    }
                    
                    /* Mobile layout view modes */
                    .material-view-container.mode-content-full {
                        grid-template-rows: 100% 0% !important;
                    }
                    
                    .material-view-container.mode-content-full .content-container {
                        display: block !important;
                        height: 100% !important;
                    }
                    
                    .material-view-container.mode-content-full .chat-container {
                        display: none !important;
                    }
                    
                    .material-view-container.mode-chat-full {
                        grid-template-rows: 0% 100% !important;
                    }
                    
                    .material-view-container.mode-chat-full .content-container {
                        display: none !important;
                    }
                    
                    .material-view-container.mode-chat-full .chat-container {
                        display: flex !important;
                        height: 100% !important;
                    }
                    
                    .material-view-container.mode-split {
                        grid-template-rows: 50% 50% !important;
                    }
                }

                /* Slide up animation for mobile chat */
                @keyframes slide-up {
                    0% {
                        transform: translateY(100%);
                    }
                    100% {
                        transform: translateY(0);
                    }
                }

                /* Slide down animation for mobile chat */
                @keyframes slide-down {
                    0% {
                        transform: translateY(0);
                    }
                    100% {
                        transform: translateY(100%);
                    }
                }

                /* Mobile-specific styles for the chat container when not in split view */
                @media (max-width: 1024px) {
                    /* Ensure the editor stays within the content container on mobile */
                    .content-container .dark-editor {
                        max-height: calc(100% - 80px) !important;
                        overflow: auto !important;
                    }
                    
                    .mobile-chat-container {
                        position: fixed !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        top: 0 !important;
                        z-index: 50 !important;
                        background-color: #111111 !important;
                        animation: slide-up 0.3s ease-out forwards !important;
                        display: flex !important;
                        flex-direction: column !important;
                        overflow: hidden !important;
                    }
                    
                    .mobile-chat-container.slide-down {
                        animation: slide-down 0.3s ease-out forwards !important;
                    }
                }

                /* Button animation styles */
                @keyframes pulse-ring {
                    0% {
                        box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.7);
                    }
                    70% {
                        box-shadow: 0 0 0 10px rgba(147, 51, 234, 0);
                    }
                    100% {
                        box-shadow: 0 0 0 0 rgba(147, 51, 234, 0);
                    }
                }

                /* Animation for the inner pulse */
                @keyframes pulse-dot {
                    0% {
                        transform: scale(0.95);
                    }
                    70% {
                        transform: scale(1.05);
                    }
                    100% {
                        transform: scale(0.95);
                    }
                }
                
                /* Entrance animation for the button */
                @keyframes button-entrance {
                    0% {
                        opacity: 0;
                        transform: scale(0.5) translateY(20px);
                    }
                    60% {
                        transform: scale(1.1) translateY(-5px);
                    }
                    80% {
                        transform: scale(0.95) translateY(2px);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                
                .button-entrance {
                    animation: button-entrance 0.8s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
                }

                .button-pulse {
                    animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
                }

                .button-pulse:after {
                    content: '';
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    border-radius: 50%;
                    box-shadow: 0 0 8px 4px rgba(147, 51, 234, 0.5);
                    animation: pulse-dot 1.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
                }
                
                /* Responsive styles for the action button */
                .mobile-action-button {
                    /* Default mobile styles */
                    width: 3.5rem;
                    height: 3.5rem;
                    bottom: 1.5rem;
                }

                /* Center the icon in mobile view */
                .mobile-icon {
                    margin-right: 0;
                }
                
                @media (min-width: 1025px) {
                    .mobile-action-button {
                        /* Desktop styles */
                        padding: 0 1.5rem;
                        width: auto;
                        height: 3rem;
                        bottom: 6rem;
                    }
                    
                    /* In desktop view, add margin to the icon */
                    .mobile-icon {
                        margin-right: 0.5rem;
                    }
                }
            `}</style>

            <div className={`bg-[#111111] material-view-container ${showChatView ? (isMobileView ? 'mode-chat-full' : 'two-column-grid rounded-md overflow-hidden split-view-container') : 'mode-content-full'}`}>
                {/* Content Container - Always rendered to avoid reloading */}
                <div
                    className="py-6 flex flex-col bg-[#1A1A1A] h-full content-container"
                    style={{ overflow: 'auto' }}
                    ref={editorContainerRef}
                >
                    <div className="flex-1">
                        <BlockNoteEditor
                            initialContent={initialContent}
                            onChange={() => { }} // Read-only, no changes
                            isDarkMode={isDarkMode}
                            readOnly={true}
                            className="dark-editor"
                        />
                    </div>
                </div>

                {/* Chat Container - Only visible when showChatView is true */}
                {showChatView && (
                    <div className={`${isMobileView ? `mobile-chat-container ${isChatClosing ? 'slide-down' : ''}` : 'flex flex-col bg-[#111111] h-full overflow-hidden lg:border-l lg:border-t-0 sm:border-t sm:border-l-0 border-[#222222]'} chat-container`}>
                        <div className="chat-header flex justify-between items-center px-4 py-2 border-b border-[#222222]">
                            <h3 className="text-white text-sm font-light">Ask your doubts</h3>

                            <button
                                onClick={handleAskDoubt}
                                className="text-white hover:bg-[#222222] rounded-full p-1 transition-colors cursor-pointer"
                                aria-label="Close chat"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <ChatView
                            currentChatHistory={chatHistory}
                            isAiResponding={isAiResponding}
                            showPreparingReport={false}
                            isChatHistoryLoaded={true}
                            isTestMode={false}
                            taskType="learning_material"
                            isSubmitting={isSubmitting}
                            currentAnswer={currentAnswer}
                            handleInputChange={handleChatInputChange}
                            handleSubmitAnswer={handleChatSubmit}
                            handleAudioSubmit={handleAudioSubmit}
                            handleViewScorecard={handleViewScorecard}
                            completedQuestionIds={{}}
                            handleRetry={handleRetry}
                        />
                    </div>
                )}
            </div>

            {/* Floating button for desktop and mobile with different layouts */}
            {
                !showChatView && !viewOnly && (
                    <>
                        {/* Floating action button - behavior changes based on screen size */}
                        <button
                            onClick={() => {
                                // For desktop view OR mobile view with no onMarkComplete, directly trigger handleAskDoubt
                                if (!isMobileView || !onMarkComplete) {
                                    // For desktop view direct click
                                    if (!hasClickedFabButton) {
                                        setHasClickedFabButton(true);
                                        safeLocalStorage.setItem('hasClickedFabButton', 'true');
                                    }
                                    handleAskDoubt();
                                } else {
                                    // Only toggle menu in mobile view when onMarkComplete exists
                                    toggleMobileMenu();
                                }
                            }}
                            className={`fixed right-6 bottom-12 mobile-action-toggle-button mobile-action-button rounded-full bg-purple-700 text-white flex items-center justify-center shadow-lg z-20 cursor-pointer transition-transform duration-300 focus:outline-none ${showButtonEntrance ? 'button-entrance' : ''} ${showButtonPulse ? 'button-pulse' : ''}`}
                            style={{ bottom: '100px' }}
                            aria-label={isMobileMenuOpen ? "Close menu" : "Ask a doubt"}
                        >
                            {isMobileMenuOpen ? (
                                <X className="h-6 w-6" />
                            ) : (
                                <>
                                    {/* 
                                  In mobile view:
                                  - Show MessageCircle directly if onMarkComplete is not defined
                                  - Show ListChecks as toggle icon if onMarkComplete exists (representing task actions)
                                */}
                                    <span className="lg:hidden">
                                        {!onMarkComplete ? (
                                            <MessageCircle className="h-6 w-6" />
                                        ) : (
                                            <ListChecks className="h-6 w-6" strokeWidth={2} />
                                        )}
                                    </span>                                    <span className="hidden lg:flex lg:items-center">
                                        <MessageCircle className="h-5 w-5 mobile-icon" />
                                        <span className="lg:ml-2">Ask a doubt</span>
                                    </span>
                                </>
                            )}
                        </button>

                        {/* Only show mobile menu overlay and options when onMarkComplete exists */}
                        {isMobileMenuOpen && onMarkComplete && (
                            <div
                                className="fixed inset-0 z-10"
                                style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
                                aria-hidden="true"
                                onClick={() => setIsMobileMenuOpen(false)}
                            />
                        )}

                        {/* Mobile menu - only shown on smaller screens and when onMarkComplete exists */}
                        {isMobileMenuOpen && onMarkComplete && (
                            <div className="lg:hidden fixed right-6 flex flex-col gap-4 items-end z-20" style={{ bottom: '170px' }} ref={mobileMenuRef}>
                                {/* Ask a doubt button */}
                                <div className="flex items-center gap-3">
                                    <span className="bg-black text-white py-2 px-4 rounded-full text-sm shadow-md">
                                        Ask a doubt
                                    </span>
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            handleAskDoubt();
                                        }}
                                        className="mobile-action-button rounded-full bg-white text-black flex items-center justify-center shadow-md cursor-pointer hover:bg-purple-600 transition-colors"
                                        aria-label="Ask a doubt"
                                    >
                                        <MessageCircle className="h-6 w-6" />
                                    </button>
                                </div>

                                {/* Mark as complete button */}
                                <div className="flex items-center gap-3">
                                    <span className="bg-black text-white py-2 px-4 rounded-full text-sm shadow-md">
                                        Mark as complete
                                    </span>
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            onMarkComplete();
                                        }}
                                        className="mobile-action-button rounded-full bg-green-700 text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-purple-600 transition-colors"
                                        aria-label="Mark as complete"
                                    >
                                        <CheckCircle className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )
            }
        </div>
    );
}

