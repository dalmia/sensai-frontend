"use client";

import "@blocknote/core/fonts/inter.css";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, MoreVertical, Maximize2, Minimize2, MessageCircle, X, Columns, LayoutGrid, SplitSquareVertical, CheckCircle, Eye, EyeOff } from "lucide-react";
import BlockNoteEditor from "./BlockNoteEditor";
import { QuizQuestion, ChatMessage, ScorecardItem, AIResponse, QuizQuestionConfig } from "../types/quiz";
import ChatView, { CodeViewState, ChatViewHandle } from './ChatView';
import ScorecardView from './ScorecardView';
import ConfirmationDialog from './ConfirmationDialog';
import { getKnowledgeBaseContent } from './QuizEditor';
import { CodePreview } from './CodeEditorView';
import isEqual from 'lodash/isEqual';
import { safeLocalStorage } from "@/lib/utils/localStorage";

// Add interface for mobile view mode
export interface MobileViewMode {
    mode: 'question-full' | 'chat-full' | 'split';
}

export interface LearnerQuizViewProps {
    questions: QuizQuestion[];
    onSubmitAnswer?: (questionId: string, answer: string) => void;
    isDarkMode?: boolean;
    className?: string;
    viewOnly?: boolean;
    currentQuestionId?: string;
    onQuestionChange?: (questionId: string) => void;
    userId?: string;
    isTestMode?: boolean;
    taskId?: string;
    completedQuestionIds?: Record<string, boolean>;
    onAiRespondingChange?: (isResponding: boolean) => void;
    onMobileViewChange?: (mode: MobileViewMode) => void;
    isAdminView?: boolean;
}

export default function LearnerQuizView({
    questions = [],
    onSubmitAnswer,
    isDarkMode = true,
    className = "",
    viewOnly = false,
    currentQuestionId,
    onQuestionChange,
    userId = '',
    isTestMode = false,
    taskId = '',
    completedQuestionIds: initialCompletedQuestionIds = {},
    onAiRespondingChange,
    onMobileViewChange,
    isAdminView = false,
}: LearnerQuizViewProps) {
    // Constant message for exam submission confirmation
    const EXAM_CONFIRMATION_MESSAGE = "Thank you for your submission. We will review it shortly";

    // Add state for tracking view mode
    const [showLearnerView, setShowLearnerView] = useState(false);

    // Current question index
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    // Update current question index when currentQuestionId changes
    useEffect(() => {
        if (currentQuestionId && questions.length > 0) {
            const index = questions.findIndex(q => q.id === currentQuestionId);
            if (index !== -1) {
                setCurrentQuestionIndex(index);
                // Reset to chat view when changing questions
                setIsViewingScorecard(false);
            }
        }
    }, [currentQuestionId, questions]);

    // Ensure we have valid questions
    const validQuestions = useMemo(() => {
        // Don't filter out any questions, just convert format if needed
        return (questions || []).map(q => {
            // If the question is null or undefined, return it with default empty values
            if (!q) {
                return {
                    id: `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    content: [],
                    config: {
                        title: '',
                        inputType: 'text',
                        responseType: 'chat',
                        questionType: 'objective',
                        correctAnswer: [],
                        audioMaxDuration: 3600, // Default to 1 hour
                        scorecardData: undefined,
                        codingLanguages: [] // Default code language
                    }
                };
            }

            // If the question already has the right format, use it as is
            if (q.content && Array.isArray(q.content)) {
                // Ensure config has all required properties with defaults
                const completeConfig = {
                    ...q.config,
                    title: q.config?.title,
                    inputType: q.config?.inputType || 'text',
                    responseType: q.config?.responseType,
                    questionType: q.config?.questionType,
                    correctAnswer: q.config?.correctAnswer || [],
                    audioMaxDuration: q.config?.audioMaxDuration || 3600,
                    scorecardData: q.config?.scorecardData,
                    codingLanguages: q.config?.codingLanguages || [] // Ensure code language is set
                };
                return {
                    ...q,
                    config: completeConfig
                };
            }

            // Handle API format where content might be in 'blocks' property
            if ((q as any).blocks && Array.isArray((q as any).blocks)) {
                const config = q.config || {};
                return {
                    id: q.id || `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    content: (q as any).blocks,
                    config: {
                        ...config,
                        inputType: config.inputType || 'text',
                        responseType: config.responseType,
                        questionType: config.questionType,
                        correctAnswer: config.correctAnswer || [],
                        audioMaxDuration: config.audioMaxDuration || 3600,
                        scorecardData: config.scorecardData,
                        codingLanguages: config.codingLanguages || [] // Ensure code language is set
                    }
                };
            }

            // Return a default structure for any other case
            const config = q.config || {};
            return {
                id: q.id || `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                content: [],
                config: {
                    ...config,
                    inputType: config.inputType || 'text',
                    responseType: config.responseType,
                    questionType: config.questionType,
                    correctAnswer: config.correctAnswer || [],
                    audioMaxDuration: config.audioMaxDuration || 3600,
                    scorecardData: config.scorecardData,
                    codingLanguages: config.codingLanguages || [] // Ensure code language is set
                }
            };
        });
    }, [questions]);

    // Current answer input
    const [currentAnswer, setCurrentAnswer] = useState("");

    // State to track if an answer is being submitted
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modify the state to track chat history per question
    const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});

    // State to track if AI is responding
    const [isAiResponding, setIsAiResponding] = useState(false);

    // State to track if chat history has been loaded
    const [isChatHistoryLoaded, setIsChatHistoryLoaded] = useState(false);

    // State to track if we should show the preparing report button
    const [showPreparingReport, setShowPreparingReport] = useState(false);

    // New state to track if we're viewing a scorecard
    const [isViewingScorecard, setIsViewingScorecard] = useState(false);

    // New state to track which scorecard we're viewing
    const [activeScorecard, setActiveScorecard] = useState<ScorecardItem[]>([]);

    // Add state to remember chat scroll position
    const [chatScrollPosition, setChatScrollPosition] = useState(0);

    // Add state for navigation confirmation dialog
    const [showNavigationConfirmation, setShowNavigationConfirmation] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<'next' | 'prev' | null>(null);

    // Reference to the input element to maintain focus
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    // Reference to the chat container for scrolling
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Add a reference for the scorecard container
    const scorecardContainerRef = useRef<HTMLDivElement>(null);

    // Reference to the ChatView component
    const chatViewRef = useRef<ChatViewHandle>(null);

    // Store the current answer in a ref to avoid re-renders
    const currentAnswerRef = useRef(currentAnswer);

    // Store the handleSubmitAnswer function in a ref to avoid circular dependencies
    const handleSubmitAnswerRef = useRef<() => void>(() => { });

    // Use a single state to track completed/submitted questions - initialize with props
    const [completedQuestionIds, setCompletedQuestionIds] = useState<Record<string, boolean>>(initialCompletedQuestionIds);

    // Update completedQuestionIds when the prop changes
    useEffect(() => {
        // To avoid infinite update loops, only update if there are actual differences
        const hasChanges = Object.keys(initialCompletedQuestionIds).some(id =>
            initialCompletedQuestionIds[id] !== completedQuestionIds[id]
        );

        if (hasChanges) {
            setCompletedQuestionIds(prev => ({
                ...prev,
                ...initialCompletedQuestionIds
            }));
        }
    }, [initialCompletedQuestionIds, completedQuestionIds]);

    // State to track which questions are currently being submitted (waiting for API response)
    const [pendingSubmissionQuestionIds, setPendingSubmissionQuestionIds] = useState<Record<string, boolean>>({});

    // Update the ref when the state changes
    useEffect(() => {
        currentAnswerRef.current = currentAnswer;
    }, [currentAnswer]);

    // Effect to focus the input when the component mounts
    useEffect(() => {
        // Focus the input field when the component mounts
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Reset chat history loaded state when taskId changes
    useEffect(() => {
        if (taskId) {
            setIsChatHistoryLoaded(false);
        }
    }, [taskId]);

    // Get the current question's chat history
    const currentChatHistory = useMemo(() => {
        const currentQuestionId = validQuestions[currentQuestionIndex]?.id || '';
        const history = chatHistories[currentQuestionId] || [];

        // For exam questions with existing chat history, we need to filter what's shown
        if (validQuestions[currentQuestionIndex]?.config?.responseType === 'exam') {
            // Find any user messages in the history
            const userMessages = history.filter(msg => msg.sender === 'user');

            // Check if this question has a user message and is properly submitted (not currently in the submission process)
            const isSubmitted = completedQuestionIds[currentQuestionId] && !pendingSubmissionQuestionIds[currentQuestionId];

            // If we have user messages and the question is already submitted (not pending)
            if (userMessages.length > 0 && isSubmitted) {
                // Get the last user message
                const lastUserMessage = userMessages[userMessages.length - 1];

                // If showing learner view, return only the last user message and confirmation
                if (showLearnerView) {
                    return [
                        lastUserMessage,
                        {
                            id: `ai-confirmation-${currentQuestionId}`,
                            content: EXAM_CONFIRMATION_MESSAGE,
                            sender: 'ai',
                            timestamp: new Date(),
                            messageType: 'text',
                            audioData: undefined,
                            scorecard: []
                        }
                    ];
                }

                // Otherwise return the full history to show AI feedback
                return history;
            }
        }

        return history;
    }, [chatHistories, currentQuestionIndex, validQuestions, completedQuestionIds, pendingSubmissionQuestionIds, showLearnerView]);

    // Get the last user message for the current question
    const getLastUserMessage = useMemo(() => {
        // Filter for user messages only
        const userMessages = currentChatHistory.filter(msg => msg.sender === 'user');
        // Return the last user message if exists
        return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
    }, [currentChatHistory]);

    // Fetch chat history from backend when component mounts or task changes
    useEffect(() => {
        // Skip if we're in test mode or if userId is not available or if we've already loaded chat history
        // Also skip if taskId is not provided
        if (isTestMode || !userId || isChatHistoryLoaded || !taskId) {
            return;
        }

        const fetchChatHistory = async () => {
            if (!validQuestions || validQuestions.length === 0) {
                return;
            }

            try {
                // Make API call to fetch chat history using the provided taskId
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat/user/${userId}/task/${taskId}`);

                if (!response.ok) {
                    throw new Error(`Failed to fetch chat history: ${response.status}`);
                }

                const chatData = await response.json();

                // Organize chat messages by question ID
                const chatHistoryByQuestion: Record<string, ChatMessage[]> = {};
                // Track which questions had user messages
                const questionsWithResponses: Record<string, boolean> = {};

                // Process messages sequentially with Promise.all for audio messages
                await Promise.all(chatData.map(async (message: any) => {
                    const questionId = message.question_id.toString();
                    if (!chatHistoryByQuestion[questionId]) {
                        chatHistoryByQuestion[questionId] = [];
                    }

                    // For audio messages, fetch the actual audio data
                    let audioData = undefined;
                    if (message.response_type === 'audio') {
                        try {
                            // Get presigned URL
                            const file_uuid = message.content;
                            const presignedResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/get?uuid=${file_uuid}&file_extension=wav`, {
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            });

                            let audioResponse = null;

                            if (!presignedResponse.ok) {
                                audioResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/download-local/?uuid=${message.content}&file_extension=wav`);
                                if (!audioResponse.ok) {
                                    throw new Error('Failed to fetch audio data from backend');
                                }
                            }
                            else {
                                const { url: presignedUrl } = await presignedResponse.json();
                                // Fetch the audio data using the presigned URL
                                audioResponse = await fetch(presignedUrl);
                                if (!audioResponse.ok) {
                                    throw new Error('Failed to fetch audio data from presigned URL');
                                }
                            }

                            // Convert the audio data to base64
                            const audioBlob = await audioResponse.blob();
                            audioData = await blobToBase64(audioBlob);
                        } catch (error) {
                            console.error('Error fetching audio data:', error);
                        }
                    }

                    // Convert API message to ChatMessage format
                    const chatMessage: ChatMessage = {
                        id: `${message.role}-${message.id}`,
                        content: message.content,
                        sender: message.role === 'user' ? 'user' : 'ai',
                        timestamp: new Date(message.created_at),
                        messageType: message.response_type,
                        audioData: audioData,
                        scorecard: []
                    };

                    // If this is an AI message, try to parse the content as JSON
                    if (message.role === 'assistant') {
                        try {
                            // Try to parse the content as JSON
                            const contentObj = JSON.parse(message.content);

                            // Extract the feedback field to display as the message content
                            if (contentObj && contentObj.feedback) {
                                chatMessage.content = contentObj.feedback;
                            }

                            // Extract scorecard if available
                            if (contentObj && contentObj.scorecard) {
                                chatMessage.scorecard = contentObj.scorecard;
                            }

                            // Extract is_correct if available
                            if (contentObj && contentObj.is_correct !== undefined) {
                                chatMessage.is_correct = contentObj.is_correct;
                            }
                        } catch (error) {
                            // If parsing fails, assume it's the old format (plain text)
                            // Keep the original content as is - it's already set in chatMessage
                        }
                    }

                    // Track questions with user responses for exam questions
                    if (message.role === 'user') {
                        questionsWithResponses[questionId] = true;
                    }

                    chatHistoryByQuestion[questionId].push(chatMessage);
                }));

                // Sort chat history by timestamp for each question to ensure correct order
                Object.keys(chatHistoryByQuestion).forEach(questionId => {
                    chatHistoryByQuestion[questionId].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                });

                // Update chat histories state
                setChatHistories(chatHistoryByQuestion);

                // For exam questions with responses, mark them as completed
                if (validQuestions[currentQuestionIndex]?.config?.responseType === 'exam') {
                    setCompletedQuestionIds(prev => ({
                        ...prev,
                        ...questionsWithResponses
                    }));

                    // Clear any pending submissions for these questions since they're loaded from history
                    setPendingSubmissionQuestionIds(prev => {
                        const newState = { ...prev };
                        Object.keys(questionsWithResponses).forEach(id => {
                            delete newState[id];
                        });
                        return newState;
                    });
                }

                setIsChatHistoryLoaded(true);

            } catch (error) {
                console.error("Error fetching chat history:", error);
            }
        };

        fetchChatHistory();
    }, [isTestMode, userId, validQuestions, isChatHistoryLoaded, taskId]);

    // Helper function to convert Blob to base64
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                // Extract the base64 data portion (remove "data:audio/wav;base64," prefix)
                const base64Data = base64String.split(',')[1];
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // Effect to focus the input when the question changes
    useEffect(() => {
        // Ensure the input is focused after a short delay to allow the DOM to fully render
        const timer = setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [currentQuestionIndex]);

    // Effect to log and validate questions when they change
    useEffect(() => {
        if (validQuestions.length > 0 && currentQuestionIndex >= validQuestions.length) {
            setCurrentQuestionIndex(0);
        }
    }, [questions, validQuestions, currentQuestionIndex]);

    // Effect to scroll to the bottom of the chat when new messages are added
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistories]);

    // Navigate to previous question
    const goToPreviousQuestion = useCallback(() => {
        // If AI is responding, show confirmation dialog
        if (isAiResponding) {
            setPendingNavigation('prev');
            setShowNavigationConfirmation(true);
            return;
        }

        // Otherwise proceed with navigation
        executeGoToPreviousQuestion();
    }, [currentQuestionIndex, onQuestionChange, validQuestions, isAiResponding]);

    // Execute navigation to previous question without checks
    const executeGoToPreviousQuestion = useCallback(() => {
        if (currentQuestionIndex > 0) {
            const newIndex = currentQuestionIndex - 1;
            setCurrentQuestionIndex(newIndex);
            setCurrentAnswer(""); // Reset answer when changing questions
            // Reset to chat view when changing questions
            setIsViewingScorecard(false);

            // Always notify parent component about question change
            if (onQuestionChange && validQuestions[newIndex]) {
                onQuestionChange(validQuestions[newIndex].id);
            }
        }
    }, [currentQuestionIndex, onQuestionChange, validQuestions]);

    // Navigate to next question
    const goToNextQuestion = useCallback(() => {
        // If AI is responding, show confirmation dialog
        if (isAiResponding) {
            setPendingNavigation('next');
            setShowNavigationConfirmation(true);
            return;
        }

        // Otherwise proceed with navigation
        executeGoToNextQuestion();
    }, [currentQuestionIndex, validQuestions.length, onQuestionChange, validQuestions, isAiResponding]);

    // Execute navigation to next question without checks
    const executeGoToNextQuestion = useCallback(() => {
        if (currentQuestionIndex < validQuestions.length - 1) {
            const newIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(newIndex);
            setCurrentAnswer(""); // Reset answer when changing questions
            // Reset to chat view when changing questions
            setIsViewingScorecard(false);

            // Always notify parent component about question change
            if (onQuestionChange && validQuestions[newIndex]) {
                onQuestionChange(validQuestions[newIndex].id);
            }
        }
    }, [currentQuestionIndex, validQuestions.length, onQuestionChange, validQuestions]);

    // Handle navigation confirmation
    const handleNavigationConfirm = useCallback(() => {
        setShowNavigationConfirmation(false);

        // Execute the navigation based on pending action
        if (pendingNavigation === 'next') {
            executeGoToNextQuestion();
        } else if (pendingNavigation === 'prev') {
            executeGoToPreviousQuestion();
        }

        setPendingNavigation(null);
    }, [executeGoToNextQuestion, executeGoToPreviousQuestion, pendingNavigation]);

    // Handle navigation cancellation
    const handleNavigationCancel = useCallback(() => {
        setShowNavigationConfirmation(false);
        setPendingNavigation(null);
    }, []);

    // Handle input change with focus preservation
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setCurrentAnswer(newValue);
        currentAnswerRef.current = newValue;
    }, []); // No dependencies to ensure stability

    // Function to store chat history in backend
    const storeChatHistory = useCallback(async (questionId: string, userMessage: ChatMessage, aiResponse: AIResponse) => {
        if (!userId || isTestMode) return;

        // For quiz questions, use the completedQuestionIds state
        const userIsSolved = completedQuestionIds[questionId] || false;

        // For AI messages, check if it contains feedback about correctness
        // We'll extract the is_correct value from the message if it exists
        let aiIsSolved = false;
        try {
            // Try to parse the AI message as JSON to see if it contains is_correct
            if (aiResponse && typeof aiResponse.is_correct === 'boolean') {
                aiIsSolved = aiResponse.is_correct;
            }
        } catch (e) {
            console.error('Error parsing AI message:', e);
        }

        // Get the response type from the current question config
        const currentQuestion = validQuestions.find(q => q.id === questionId);

        // Create content based on the response type
        let contentObj = {};
        if (currentQuestion?.config?.questionType === 'subjective') {
            // For report type, include both feedback and scorecard
            contentObj = {
                feedback: aiResponse.feedback,
                scorecard: aiResponse.scorecard || []
            };
        } else {
            // For chat type or any other type, just include feedback
            contentObj = {
                feedback: aiResponse.feedback,
                is_correct: aiResponse.is_correct
            };
        }
        let aiContent = JSON.stringify(contentObj);

        const messages = [
            {
                role: "user",
                content: userMessage.content,
                response_type: userMessage.messageType,
                audio_data: userMessage.messageType === 'audio' ? userMessage.audioData : undefined,
                created_at: userMessage.timestamp
            },
            {
                role: "assistant",
                content: aiContent,
                response_type: null,
                created_at: new Date()
            }
        ];

        const isComplete = currentQuestion?.config?.responseType === 'exam' ? true : !userIsSolved && aiIsSolved;

        const requestBody = {
            user_id: parseInt(userId),
            question_id: parseInt(questionId),
            messages: messages,
            is_complete: isComplete
        };

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Failed to store chat history');
            }
        } catch (error) {
            console.error('Error storing chat history:', error);
        }
    }, [userId, isTestMode, completedQuestionIds, validQuestions]);

    // Process a user response (shared logic between text and audio submission)
    const processUserResponse = useCallback(
        async (
            responseContent: string,
            responseType: 'text' | 'audio' | 'code' = 'text',
            audioData?: string
        ) => {
            if (!validQuestions || validQuestions.length === 0 || currentQuestionIndex >= validQuestions.length) {
                return;
            }

            const currentQuestionId = validQuestions[currentQuestionIndex].id;

            // Set submitting state to true
            setIsSubmitting(true);

            // Create the user message object
            const userMessage: ChatMessage = {
                id: `user-${Date.now()}`,
                content: responseContent,
                sender: 'user',
                timestamp: new Date(),
                messageType: responseType,
                audioData: audioData,
                scorecard: []
            };

            // Handle code type message differently for UI display
            // Only set messageType to 'code' when it actually comes from the code editor
            // or when the responseType is explicitly set to 'code'
            if (responseType === 'code') {
                userMessage.messageType = 'code';
            }
            // Don't automatically convert text messages to code messages for coding questions

            // Immediately add the user's message to chat history
            setChatHistories(prev => ({
                ...prev,
                [currentQuestionId]: [...(prev[currentQuestionId] || []), userMessage]
            }));

            // Clear the input field after submission (only for text input)
            if (responseType === 'text' || responseType === 'code') {
                setCurrentAnswer("");
                currentAnswerRef.current = "";

                // Focus the input field again
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }

            // Special case: For exam questions in test mode, don't make the API call
            // instead show confirmation immediately
            if (validQuestions[currentQuestionIndex]?.config?.responseType === 'exam' && isTestMode) {
                // Mark this question as completed
                setCompletedQuestionIds(prev => ({
                    ...prev,
                    [currentQuestionId]: true
                }));

                // Call the onSubmitAnswer callback to mark completion
                if (onSubmitAnswer) {
                    onSubmitAnswer(currentQuestionId, responseType === 'audio' ? audioData || '' : responseContent);
                }

                // Add confirmation message immediately
                const confirmationMessage: ChatMessage = {
                    id: `ai-${Date.now()}`,
                    content: EXAM_CONFIRMATION_MESSAGE,
                    sender: 'ai',
                    timestamp: new Date(),
                    messageType: 'text',
                    audioData: undefined
                };

                // Update chat history with confirmation message
                setChatHistories(prev => ({
                    ...prev,
                    [currentQuestionId]: [...(prev[currentQuestionId] || []), confirmationMessage]
                }));

                // Reset states
                setIsSubmitting(false);
                return; // Skip the API call completely
            }

            // For exam questions, mark as pending submission
            if (validQuestions[currentQuestionIndex]?.config?.responseType === 'exam') {
                setPendingSubmissionQuestionIds(prev => ({
                    ...prev,
                    [currentQuestionId]: true
                }));
            }

            // Show the AI typing animation
            setIsAiResponding(true);

            // Prepare the request body based on whether this is a teacher testing or a real learner
            let requestBody;

            if (isTestMode) {
                // In teacher testing mode, send chat_history and question data
                // Format the chat history for the current question
                const formattedChatHistory = (chatHistories[currentQuestionId] || []).map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.sender === 'user' ? msg.content :
                        validQuestions[currentQuestionIndex].config.questionType === 'objective' ? JSON.stringify({ feedback: msg.content }) : JSON.stringify({ feedback: msg.content, scorecard: msg.scorecard }),
                    response_type: msg.messageType,
                    audio_data: msg.audioData
                }));

                let scorecardId = undefined;
                if (validQuestions[currentQuestionIndex].config.questionType === 'subjective') {
                    scorecardId = validQuestions[currentQuestionIndex].config.scorecardData?.id
                }

                // Create the request body for teacher testing mode
                requestBody = {
                    user_response: responseType === 'audio' ? audioData : responseContent,
                    ...(responseType === 'audio' && { response_type: "audio" }),
                    ...(responseType === 'code' && { response_type: "code" }),
                    chat_history: formattedChatHistory,
                    question: {
                        "blocks": validQuestions[currentQuestionIndex].content,
                        "response_type": validQuestions[currentQuestionIndex].config.responseType,
                        "answer": validQuestions[currentQuestionIndex].config.correctAnswer,
                        "title": validQuestions[currentQuestionIndex].config.title,
                        "type": validQuestions[currentQuestionIndex].config.questionType,
                        "input_type": validQuestions[currentQuestionIndex].config.inputType,
                        "scorecard_id": scorecardId,
                        "coding_languages": validQuestions[currentQuestionIndex].config.codingLanguages,
                        "context": getKnowledgeBaseContent(validQuestions[currentQuestionIndex].config as QuizQuestionConfig)
                    },
                    user_id: userId,
                    task_id: taskId,
                    task_type: 'quiz'
                };
            } else {
                // In normal mode, send question_id and user_id
                requestBody = {
                    user_response: responseType === 'audio' ? audioData : responseContent,
                    response_type: responseType,
                    question_id: currentQuestionId,
                    user_id: userId,
                    task_id: taskId,
                    task_type: 'quiz'
                };
            }

            // Create a message ID for the streaming response
            const aiMessageId = `ai-${Date.now()}`;

            // Create an initial empty message for streaming content
            const initialAiMessage: ChatMessage = {
                id: aiMessageId,
                content: "",
                sender: 'ai',
                timestamp: new Date(),
                messageType: 'text',
                audioData: undefined,
                scorecard: []
            };

            let isCorrect = false;

            // Track if we've received any feedback
            let receivedAnyFeedback = false;

            // For audio responses, get a presigned URL to upload the audio file
            if (responseType === 'audio' && audioData) {
                let presigned_url = '';
                let file_uuid = '';

                try {
                    // First, get a presigned URL for the audio file
                    const presignedUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/create`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            content_type: "audio/wav"
                        })
                    });

                    if (!presignedUrlResponse.ok) {
                        throw new Error('Failed to get presigned URL');
                    }

                    const presignedData = await presignedUrlResponse.json();
                    presigned_url = presignedData.presigned_url;
                    file_uuid = presignedData.file_uuid;
                } catch (error) {
                    console.error("Error getting presigned URL for audio:", error);
                }

                // Convert base64 audio data to a Blob
                const binaryData = atob(audioData);
                const arrayBuffer = new ArrayBuffer(binaryData.length);
                const uint8Array = new Uint8Array(arrayBuffer);

                for (let i = 0; i < binaryData.length; i++) {
                    uint8Array[i] = binaryData.charCodeAt(i);
                }

                // Create audio blob with WAV format
                const audioBlob = new Blob([uint8Array], { type: 'audio/wav' });

                if (!presigned_url) {
                    // If we couldn't get a presigned URL, try direct upload to the backend
                    try {
                        console.log("Attempting direct upload to backend");

                        // Create FormData for the file upload
                        const formData = new FormData();
                        formData.append('file', audioBlob, 'audio.wav');
                        formData.append('content_type', 'audio/wav');

                        // Upload directly to the backend
                        const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/upload-local`, {
                            method: 'POST',
                            body: formData
                        });

                        if (!uploadResponse.ok) {
                            throw new Error(`Failed to upload audio to backend: ${uploadResponse.status}`);
                        }

                        const uploadData = await uploadResponse.json();
                        file_uuid = uploadData.file_uuid;

                        console.log('Audio file uploaded successfully to backend');
                        // Update the request body with the file information
                        requestBody.user_response = file_uuid || '';
                        userMessage.content = file_uuid || '';
                    } catch (error) {
                        console.error('Error with direct upload to backend:', error);
                        throw error;
                    }
                } else {
                    // Upload the audio file to S3 using the presigned URL
                    try {
                        // Upload to S3 using the presigned URL with WAV content type
                        const uploadResponse = await fetch(presigned_url, {
                            method: 'PUT',
                            body: audioBlob,
                            headers: {
                                'Content-Type': 'audio/wav'
                            }
                        });

                        if (!uploadResponse.ok) {
                            throw new Error(`Failed to upload audio to S3: ${uploadResponse.status}`);
                        }

                        console.log('Audio file uploaded successfully to S3');
                        // Update the request body with the file information
                        requestBody.user_response = file_uuid;
                        userMessage.content = file_uuid || '';
                    } catch (error) {
                        console.error('Error uploading audio to S3:', error);
                        throw error;
                    }
                }
            }

            // Call the API with the appropriate request body for streaming response
            fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }

                    // Get the response reader for streaming for both exam and quiz
                    const reader = response.body?.getReader();

                    if (!reader) {
                        throw new Error('Failed to get response reader');
                    }

                    // Function to process the streaming chunks
                    const processStream = async () => {
                        try {
                            let accumulatedFeedback = "";
                            // Add a variable to collect the complete scorecard
                            let completeScorecard = [];
                            // Add a flag to track if streaming is done
                            let streamingComplete = false;

                            while (true) {
                                const { done, value } = await reader.read();

                                if (done) {
                                    streamingComplete = true;
                                    break;
                                }

                                // Convert the chunk to text
                                const chunk = new TextDecoder().decode(value);

                                // Split by newlines to handle multiple JSON objects in a single chunk
                                const jsonLines = chunk.split('\n').filter(line => line.trim());

                                for (const line of jsonLines) {
                                    try {
                                        const data = JSON.parse(line);

                                        // Handle feedback updates
                                        if (data.feedback) {
                                            // Append to accumulated feedback
                                            accumulatedFeedback = data.feedback;

                                            // For practice questions, update the UI as we receive chunks
                                            if (validQuestions[currentQuestionIndex]?.config?.responseType === 'chat') {
                                                // If this is the first feedback chunk we've received
                                                if (!receivedAnyFeedback) {
                                                    receivedAnyFeedback = true;

                                                    // Stop showing the animation
                                                    setIsAiResponding(false);

                                                    // Add the AI message to chat history now that we have content
                                                    setChatHistories(prev => ({
                                                        ...prev,
                                                        [currentQuestionId]: [...(prev[currentQuestionId] || []), {
                                                            ...initialAiMessage,
                                                            content: accumulatedFeedback
                                                        }]
                                                    }));
                                                } else {
                                                    // Update the existing AI message content for subsequent chunks
                                                    setChatHistories(prev => {
                                                        // Find the current question's chat history
                                                        const currentHistory = [...(prev[currentQuestionId] || [])];

                                                        // Find the index of the AI message to update
                                                        const aiMessageIndex = currentHistory.findIndex(msg => msg.id === aiMessageId);

                                                        if (aiMessageIndex !== -1) {
                                                            // Update the existing message
                                                            currentHistory[aiMessageIndex] = {
                                                                ...currentHistory[aiMessageIndex],
                                                                content: accumulatedFeedback
                                                            };
                                                        }

                                                        return {
                                                            ...prev,
                                                            [currentQuestionId]: currentHistory
                                                        };
                                                    });
                                                }
                                            }
                                            // For exam questions, we don't update the UI yet
                                            // but we still track that we received feedback
                                            else if (!receivedAnyFeedback) {
                                                receivedAnyFeedback = true;
                                            }
                                        }

                                        // Handle scorecard data when available
                                        if (data.scorecard && data.scorecard.length > 0) {
                                            // Show preparing report message if not already shown
                                            if (!showPreparingReport && validQuestions[currentQuestionIndex]?.config?.responseType === 'chat') {
                                                setShowPreparingReport(true);
                                            }

                                            // Instead of immediately updating the chat message,
                                            // collect the scorecard data
                                            completeScorecard = data.scorecard;
                                        }

                                        // Handle is_correct when available - for practice questions
                                        if (validQuestions[currentQuestionIndex]?.config?.responseType === 'chat' && data.is_correct !== undefined) {
                                            isCorrect = data.is_correct;
                                        }
                                    } catch (e) {
                                        console.error('Error parsing JSON chunk:', e);
                                    }
                                }
                            }

                            // After processing all chunks (stream is complete)

                            // Only now update the chat message with the complete scorecard
                            if (completeScorecard.length > 0) {
                                // Check if all criteria received maximum scores
                                if (completeScorecard.length > 0) {
                                    // Set isCorrect to true only if all criteria have received their maximum score
                                    isCorrect = completeScorecard.every((item: ScorecardItem) =>
                                        item.score !== undefined &&
                                        ((item.pass_score !== undefined && item.score >= item.pass_score) ||
                                            (item.max_score !== undefined && item.score === item.max_score))
                                    );
                                }

                                // Update the existing AI message with the complete scorecard data
                                setChatHistories(prev => {
                                    // Find the current question's chat history
                                    const currentHistory = [...(prev[currentQuestionId] || [])];

                                    // Find the index of the AI message to update
                                    const aiMessageIndex = currentHistory.findIndex(msg => msg.id === aiMessageId);

                                    if (aiMessageIndex !== -1) {
                                        // Update the existing message with the complete scorecard
                                        currentHistory[aiMessageIndex] = {
                                            ...currentHistory[aiMessageIndex],
                                            scorecard: completeScorecard
                                        };
                                    }

                                    return {
                                        ...prev,
                                        [currentQuestionId]: currentHistory
                                    };
                                });

                                // Only now hide the preparing report message
                                setTimeout(() => setShowPreparingReport(false), 0);
                            }

                            if (isCorrect) {
                                // Mark this specific question as completed
                                setCompletedQuestionIds(prev => ({
                                    ...prev,
                                    [currentQuestionId]: true
                                }));

                                // Call the onSubmitAnswer callback to mark completion
                                if (onSubmitAnswer) {
                                    onSubmitAnswer(currentQuestionId, responseType === 'audio' ? audioData || '' : responseContent);
                                }
                            }

                            // Handle exam questions completion
                            if (validQuestions[currentQuestionIndex]?.config?.responseType === 'exam') {
                                // Now that all chunks have been received, mark as complete
                                // Mark this question as completed
                                setCompletedQuestionIds(prev => ({
                                    ...prev,
                                    [currentQuestionId]: true
                                }));

                                // Call the onSubmitAnswer callback to mark completion
                                if (onSubmitAnswer) {
                                    onSubmitAnswer(currentQuestionId, responseType === 'audio' ? audioData || '' : responseContent);
                                }

                                // For exam questions, clear the pending submission status
                                setPendingSubmissionQuestionIds(prev => {
                                    const newState = { ...prev };
                                    delete newState[currentQuestionId];
                                    return newState;
                                });

                                initialAiMessage.content = EXAM_CONFIRMATION_MESSAGE;

                                // Add exam confirmation message to chat history
                                setChatHistories(prev => ({
                                    ...prev,
                                    [currentQuestionId]: [...(prev[currentQuestionId] || []), {
                                        ...initialAiMessage,
                                        content: EXAM_CONFIRMATION_MESSAGE,
                                        scorecard: []
                                    }]
                                }));

                                // Stop showing the AI responding animation for exam questions
                                setIsAiResponding(false);
                            }

                            // Store chat history in backend for quiz
                            if (!isTestMode) {
                                const aiResponse: AIResponse = {
                                    feedback: accumulatedFeedback,
                                    is_correct: isCorrect,
                                    scorecard: completeScorecard
                                };
                                storeChatHistory(currentQuestionId, userMessage, aiResponse);
                            }
                        } catch (error) {
                            console.error('Error processing stream:', error);
                            // Only reset the preparing report state when an error occurs
                            // and we need to allow the user to try again
                            if (showPreparingReport) {
                                setTimeout(() => setShowPreparingReport(false), 0);
                            }
                            throw error;
                        }
                    };

                    // Start processing the stream for both exam and quiz
                    return processStream();
                })
                .catch(error => {
                    console.error('Error fetching AI response:', error);

                    // Show error message to the user
                    const errorMessage = responseType === 'audio'
                        ? "There was an error while processing your audio. Please try again."
                        : "There was an error while processing your answer. Please try again.";

                    const errorResponse: ChatMessage = {
                        id: `ai-error-${Date.now()}`,
                        content: errorMessage,
                        sender: 'ai',
                        timestamp: new Date(),
                        messageType: 'text',
                        audioData: undefined,
                        scorecard: [],
                        isError: true
                    };

                    // For exam questions, clear the pending status so the user can try again
                    if (validQuestions[currentQuestionIndex]?.config?.responseType === 'exam') {
                        setPendingSubmissionQuestionIds(prev => {
                            const newState = { ...prev };
                            delete newState[currentQuestionId];
                            return newState;
                        });
                    }

                    // Add the error message to the chat history
                    // This is only for UI display and won't be saved to the database
                    setChatHistories(prev => ({
                        ...prev,
                        [currentQuestionId]: [...(prev[currentQuestionId] || []), errorResponse]
                    }));

                    // Reset report preparation state on error since the user needs to try again
                    setShowPreparingReport(false);
                })
                .finally(() => {
                    // Only reset submitting state when API call is done
                    setIsSubmitting(false);

                    // If we never received any feedback, also reset the AI responding state
                    if (!receivedAnyFeedback) {
                        setIsAiResponding(false);
                    }
                });
        },
        [
            validQuestions,
            currentQuestionIndex,
            onSubmitAnswer,
            userId,
            isTestMode,
            chatHistories,
            storeChatHistory,
            completedQuestionIds,
            EXAM_CONFIRMATION_MESSAGE
        ]
    );

    // Add state for exam submission confirmation
    const [showExamSubmissionConfirmation, setShowExamSubmissionConfirmation] = useState(false);
    const [pendingExamSubmission, setPendingExamSubmission] = useState<{
        responseContent: string;
        responseType: 'text' | 'audio' | 'code';
        audioData?: string;
    } | null>(null);

    // Modified handleSubmitAnswer function to use shared logic
    const handleSubmitAnswer = useCallback((responseType: 'text' | 'code' = 'text') => {
        // Get the current answer from the ref
        const answer = currentAnswerRef.current;

        if (!answer.trim()) return;

        // For exam questions, show confirmation dialog
        if (validQuestions[currentQuestionIndex]?.config?.responseType === 'exam') {
            setPendingExamSubmission({
                responseContent: answer,
                responseType
            });
            setShowExamSubmissionConfirmation(true);
            return;
        }

        // Use the shared processing function for non-exam questions
        processUserResponse(answer, responseType);
    }, [processUserResponse, validQuestions, currentQuestionIndex]);

    // Handle exam submission confirmation
    const handleExamSubmissionConfirm = useCallback(() => {
        if (pendingExamSubmission) {
            processUserResponse(
                pendingExamSubmission.responseContent,
                pendingExamSubmission.responseType,
                pendingExamSubmission.audioData
            );
        }
        setShowExamSubmissionConfirmation(false);
        setPendingExamSubmission(null);
        chatViewRef.current?.toggleCodeView();
    }, [pendingExamSubmission, processUserResponse]);

    // Handle exam submission cancellation
    const handleExamSubmissionCancel = useCallback(() => {
        setShowExamSubmissionConfirmation(false);
        setPendingExamSubmission(null);
    }, []);

    // New function to handle audio submission using shared logic
    const handleAudioSubmit = useCallback(async (audioBlob: Blob) => {
        try {
            // Convert the WebM audio blob to WAV format
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Convert AudioBuffer to WAV format
            const wavBuffer = convertAudioBufferToWav(audioBuffer);
            const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

            // Convert the WAV blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(wavBlob);

            reader.onloadend = async () => {
                const base64Audio = reader.result as string;
                // Remove the data URL prefix (e.g., "data:audio/wav;base64,")
                const base64Data = base64Audio.split(',')[1];

                // Use the shared processing function with audio-specific parameters
                processUserResponse('', 'audio', base64Data);
            };
        } catch (error) {
            console.error("Error processing audio submission:", error);
            setIsSubmitting(false);
        }
    }, [processUserResponse]);

    // Helper function to convert AudioBuffer to WAV format
    const convertAudioBufferToWav = (audioBuffer: AudioBuffer) => {
        const numOfChan = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numOfChan * 2;
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);
        const sampleRate = audioBuffer.sampleRate;
        const channels = [];

        // Extract channels
        for (let i = 0; i < numOfChan; i++) {
            channels.push(audioBuffer.getChannelData(i));
        }

        // RIFF identifier
        writeString(view, 0, 'RIFF');
        // File length
        view.setUint32(4, 36 + length, true);
        // RIFF type
        writeString(view, 8, 'WAVE');
        // Format chunk identifier
        writeString(view, 12, 'fmt ');
        // Format chunk length
        view.setUint32(16, 16, true);
        // Sample format (raw)
        view.setUint16(20, 1, true);
        // Channel count
        view.setUint16(22, numOfChan, true);
        // Sample rate
        view.setUint32(24, sampleRate, true);
        // Byte rate (sample rate * block align)
        view.setUint32(28, sampleRate * numOfChan * 2, true);
        // Block align (channel count * bytes per sample)
        view.setUint16(32, numOfChan * 2, true);
        // Bits per sample
        view.setUint16(34, 16, true);
        // Data chunk identifier
        writeString(view, 36, 'data');
        // Data chunk length
        view.setUint32(40, length, true);

        // Write PCM samples
        const offset = 44;
        let pos = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numOfChan; channel++) {
                // Clamp the value to -1.0 - 1.0 range and convert to 16-bit
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));
                const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset + pos, value, true);
                pos += 2;
            }
        }

        return buffer;
    };

    // Helper function to write strings to DataView
    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    // Update the handleSubmitAnswerRef when handleSubmitAnswer changes
    useEffect(() => {
        handleSubmitAnswerRef.current = handleSubmitAnswer;
    }, [handleSubmitAnswer]);

    // Get current question content
    const currentQuestionContent = validQuestions[currentQuestionIndex]?.content || [];

    // Get current question config
    const currentQuestionConfig = validQuestions[currentQuestionIndex]?.config

    // Focus the input field directly
    useEffect(() => {
        // Use requestAnimationFrame to ensure the DOM is fully rendered
        requestAnimationFrame(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        });
    }, [currentQuestionIndex]); // Only re-focus when changing questions

    // Custom styles for hiding scrollbars
    const customStyles = `
    /* Hide scrollbar for Chrome, Safari and Opera */
    .hide-scrollbar::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }
    
    /* Hide scrollbar for IE, Edge and Firefox */
    .hide-scrollbar {
      -ms-overflow-style: none;  /* IE and Edge */
      scrollbar-width: none;  /* Firefox */
    }
    `;

    // ScoreCard view toggle functions
    const handleViewScorecard = (scorecard: ScorecardItem[]) => {
        // Save current chat scroll position before switching views
        if (chatContainerRef.current) {
            setChatScrollPosition(chatContainerRef.current.scrollTop);
        }

        setActiveScorecard(scorecard);
        setIsViewingScorecard(true);

        // Reset scroll position of scorecard view when opened
        setTimeout(() => {
            if (scorecardContainerRef.current) {
                scorecardContainerRef.current.scrollTop = 0;
            }
        }, 0);
    };

    const handleBackToChat = () => {
        setIsViewingScorecard(false);

        // Focus the input field when returning to chat if appropriate
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }

            // Restore saved chat scroll position
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatScrollPosition;
            }
        }, 0);
    };

    // Function to handle retrying the last user message
    const handleRetry = useCallback(() => {
        if (!validQuestions || validQuestions.length === 0) {
            return;
        }

        const currentQuestionId = validQuestions[currentQuestionIndex].id;
        const currentHistory = chatHistories[currentQuestionId] || [];

        // Find the most recent user message
        const userMessages = currentHistory.filter(msg => msg.sender === 'user');
        if (userMessages.length === 0) {
            return; // No user message to retry
        }

        const lastUserMessage = userMessages[userMessages.length - 1];

        // If in test mode, first remove the last user message and AI response
        // Find all AI messages
        const aiMessages = currentHistory.filter(msg => msg.sender === 'ai');

        // If there are AI messages, remove the last user message and last AI message
        if (aiMessages.length > 0) {
            setChatHistories(prev => {
                const updatedHistory = [...(prev[currentQuestionId] || [])];
                // Remove the last two messages (last user message and last AI response)
                updatedHistory.splice(updatedHistory.length - 2, 2);
                return {
                    ...prev,
                    [currentQuestionId]: updatedHistory
                };
            });
        } else {
            // If no AI messages (unusual case), just remove the last user message
            setChatHistories(prev => {
                const updatedHistory = [...(prev[currentQuestionId] || [])];
                // Remove just the last user message
                updatedHistory.pop();
                return {
                    ...prev,
                    [currentQuestionId]: updatedHistory
                };
            });
        }

        // Now process the user response again
        // If it's an audio message, get the audio data
        if (lastUserMessage.messageType === 'audio') {
            if (lastUserMessage.audioData) {
                processUserResponse('', 'audio', lastUserMessage.audioData);
            }
        } else {
            // For text messages, resubmit the text content
            processUserResponse(lastUserMessage.content);
        }
    }, [validQuestions, currentQuestionIndex, chatHistories, processUserResponse, isTestMode]);

    // Update the parent component when AI responding state changes
    useEffect(() => {
        if (onAiRespondingChange) {
            onAiRespondingChange(isAiResponding);
        }
    }, [isAiResponding, onAiRespondingChange]);

    // Add state for code view
    const [codeViewState, setCodeViewState] = useState<CodeViewState>({
        isViewingCode: false,
        isRunning: false,
        previewContent: '',
        output: '',
        hasWebLanguages: false
    });

    // Update the state with any code preview changes
    const handleCodeStateChange = (newState: CodeViewState) => {
        setCodeViewState(prevState => {
            const updatedState = { ...prevState, ...newState };

            // Remove the automatic view mode change when toggling between code and chat
            // to preserve the user's selected view mode

            // On mobile, when preview content is first loaded for a code run,
            // we still want to show it (but not when just toggling modes)
            const isMobileView = window.innerWidth < 1024;
            if (isMobileView &&
                updatedState.previewContent &&
                !prevState.previewContent &&
                // Only switch if this is a fresh code run, not just a mode toggle
                updatedState.output) {

                // When preview content is first set on mobile, automatically go to full chat view
                // This ensures the preview is visible
                setMobileViewMode('chat-full');

                // Notify parent if needed
                if (onMobileViewChange) {
                    onMobileViewChange({ mode: 'chat-full' });
                }
            }

            return updatedState;
        });
    };

    // Determine if we should show the 3-column layout
    const isCodeQuestion = useMemo(() => {
        if (!validQuestions || validQuestions.length === 0) return false;
        return validQuestions[currentQuestionIndex]?.config?.inputType === 'code';
    }, [validQuestions, currentQuestionIndex]);

    // Mobile view controls
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [mobileViewMode, setMobileViewMode] = useState<'question-full' | 'chat-full' | 'split'>('split');
    const mobileMenuRef = useRef<HTMLDivElement>(null);
    // Track if we should show the pulse animation
    const [showButtonPulse, setShowButtonPulse] = useState(false);
    // Track if button has completed entrance animation
    const [showButtonEntrance, setShowButtonEntrance] = useState(true);

    // Effect to start pulsing animation after entrance animation completes
    useEffect(() => {
        // Check if user has clicked the FAB before
        const hasClickedFAB = safeLocalStorage.getItem('hasClickedQuizViewToggleButton') === 'true';

        if (hasClickedFAB) {
            // If user has clicked before, don't show animations
            setShowButtonPulse(false);
        } else {
            // For new users, start with entrance animation
            setShowButtonEntrance(true);

            // Wait for entrance animation to complete before starting the pulse
            const entranceTimer = setTimeout(() => {
                setShowButtonEntrance(false);
                setShowButtonPulse(true);
            }, 800); // Match the duration of the entrance animation

            return () => clearTimeout(entranceTimer);
        }
    }, []);

    // Handle clicks outside the mobile menu to close it
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
                setIsMobileMenuOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Toggle mobile menu
    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(prev => !prev);
        // If the menu is being opened, stop the animation
        if (!isMobileMenuOpen) {
            setShowButtonPulse(false);

            // Save to localStorage that user has clicked the button
            safeLocalStorage.setItem('hasClickedViewModeButton', 'true');
        }
    };

    // Direct handler for changing view mode
    const setViewMode = (mode: 'question-full' | 'chat-full' | 'split') => {
        setMobileViewMode(mode);
        setIsMobileMenuOpen(false);
    };

    // Apply CSS classes based on mode
    useEffect(() => {
        const quizContainer = document.querySelector('.quiz-view-container');
        if (quizContainer) {
            // Remove existing mode classes
            quizContainer.classList.remove('mode-split', 'mode-question-full', 'mode-chat-full');
            // Add current mode class
            quizContainer.classList.add(`mode-${mobileViewMode}`);
        }
    }, [mobileViewMode, codeViewState.isViewingCode]); // Also reapply when code view toggle changes

    // Set initial showLearnerView based on isAdminView
    useEffect(() => {
        const currentQuestion = questions.find(q => q.id === currentQuestionId);
        if (!isAdminView && currentQuestion?.config?.responseType === 'exam') {
            setShowLearnerView(true);
        }
    }, [isAdminView, questions, currentQuestionId]);

    return (
        <div className={`w-full h-full ${className}`}>
            {/* Add the custom styles */}
            <style jsx>{customStyles}</style>
            <style jsx>{`
                .three-column-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 0.75fr;
                    height: 100%;
                    
                    @media (max-width: 1024px) {
                        grid-template-columns: 1fr;
                        grid-template-rows: 0.5fr 0.5fr 0.5fr;
                        height: 100vh;
                        overflow: hidden;
                    }
                }
                
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
                
                /* When sidebar is visible on mobile, ensure row-based layout */
                .sidebar-visible .two-column-grid {
                    @media (max-width: 1024px) {
                        grid-template-columns: 1fr;
                        grid-template-rows: 50% 50%;
                        height: 100%;
                        overflow: hidden;
                    }
                }
                
                .preview-placeholder {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100%;
                    background-color: #1A1A1A;
                    color: #666666;
                    font-size: 0.9rem;
                    text-align: center;
                    padding: 1rem;
                }
                
                .preview-placeholder svg {
                    margin-bottom: 1rem;
                    opacity: 0.5;
                }

                /* Make sure the question and chat containers properly fit their content */
                @media (max-width: 1024px) {
                    .quiz-view-container {
                        height: 100% !important;
                        max-height: 100% !important;
                        overflow: hidden !important;
                        display: grid !important;
                        grid-template-rows: 50% 50% !important;
                        grid-template-columns: 1fr !important;
                    }
                    
                    .question-container {
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
                }

                /* Ensure the editor stays within the question container on mobile */
                @media (max-width: 1024px) {
                    .question-container .quiz-viewer,
                    .question-container .quiz-viewer-preview {
                        max-height: calc(100% - 80px) !important;
                        overflow: auto !important;
                    }
                }

                /* Mobile view floating button styles */
                .mobile-view-button {
                    display: none;
                    position: fixed;
                    z-index: 1000;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background-color: #9333EA;
                    color: white;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    border: none;
                    outline: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    align-items: center;
                    justify-content: center;
                }

                .mobile-view-button:hover {
                    background-color: #A855F7;
                    transform: scale(1.05);
                }

                .mobile-view-menu {
                    position: fixed;
                    width: 180px;
                    background-color: #333333;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    overflow: hidden;
                    z-index: 1001;
                }

                .mobile-view-menu-item {
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    color: white;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                }

                .mobile-view-menu-item:hover {
                    background-color: #444444;
                }

                .mobile-view-menu-item svg {
                    margin-right: 8px;
                }

                /* Pulse animation for the floating action button */
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

                @media (max-width: 1024px) {
                    .mobile-view-button {
                        display: flex;
                    }
                    
                    /* Mobile layout view modes */
                    .quiz-view-container.mode-question-full {
                        grid-template-rows: 100% 0% !important;
                    }
                    
                    .quiz-view-container.mode-question-full .question-container {
                        display: block !important;
                        height: 100% !important;
                    }
                    
                    .quiz-view-container.mode-question-full .chat-container {
                        display: none !important;
                    }
                    
                    .quiz-view-container.mode-chat-full {
                        grid-template-rows: 0% 100% !important;
                    }
                    
                    .quiz-view-container.mode-chat-full .question-container {
                        display: none !important;
                    }
                    
                    .quiz-view-container.mode-chat-full .chat-container {
                        display: flex !important;
                        height: 100% !important;
                    }
                    
                    .quiz-view-container.mode-split {
                        grid-template-rows: 50% 50% !important;
                    }
                }
            `}</style>

            <div className={`rounded-md overflow-hidden ${isCodeQuestion && codeViewState.isViewingCode ? 'three-column-grid' : 'two-column-grid'} bg-[#111111] quiz-view-container`}>
                {/* Left side - Question (33% or 50% depending on layout) */}
                <div className="p-6 border-r border-[#222222] flex flex-col bg-[#1A1A1A] lg:border-r lg:border-b-0 sm:border-b sm:border-r-0 question-container"
                    style={{ overflow: 'auto' }}>
                    {/* Navigation controls at the top of left side - only show if more than one question */}
                    {validQuestions.length > 1 ? (
                        <div className="flex items-center justify-between w-full mb-6">
                            <div className="w-10 h-10">
                                <button
                                    className={`w-10 h-10 rounded-full flex items-center justify-center bg-[#222222] text-white ${currentQuestionIndex > 0 ? 'hover:bg-[#333333] cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                                    onClick={goToPreviousQuestion}
                                    disabled={currentQuestionIndex <= 0}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                            </div>

                            <div className="bg-[#222222] px-3 py-1 rounded-full text-white text-sm flex items-center">
                                <span>Question {currentQuestionIndex + 1} / {validQuestions.length}</span>
                                {validQuestions[currentQuestionIndex] &&
                                    completedQuestionIds &&
                                    completedQuestionIds[validQuestions[currentQuestionIndex].id] && (
                                        <CheckCircle size={14} className="ml-2 text-green-500 flex-shrink-0" />
                                    )}
                            </div>

                            <div className="w-10 h-10">
                                <button
                                    className={`w-10 h-10 rounded-full flex items-center justify-center bg-[#222222] text-white ${currentQuestionIndex < validQuestions.length - 1 ? 'hover:bg-[#333333] cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                                    onClick={goToNextQuestion}
                                    disabled={currentQuestionIndex >= validQuestions.length - 1}
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center w-full mb-6">
                            <div className="bg-[#222222] px-3 py-1 rounded-full text-white text-sm">
                                Question
                            </div>
                        </div>
                    )}

                    <div className={`flex-1 ${questions.length > 1 ? 'mt-4' : ''}`}>
                        {/* Use editor with negative margin to offset unwanted space */}
                        <div className="ml-[-60px]"> {/* Increased negative margin to align with navigation arrow */}
                            <BlockNoteEditor
                                key={`question-view-${currentQuestionIndex}`}
                                initialContent={currentQuestionContent}
                                onChange={() => { }} // Read-only in view mode
                                isDarkMode={isDarkMode}
                                readOnly={true}
                                className={`!bg-transparent ${isTestMode ? 'quiz-viewer-preview' : 'quiz-viewer'}`}
                                placeholder="Question content will appear here"
                            />
                        </div>
                    </div>
                </div>

                {/* Middle column - Chat/Code View */}
                <div className="flex flex-col bg-[#111111] h-full overflow-auto lg:border-l lg:border-t-0 sm:border-t sm:border-l-0 border-[#222222] chat-container">
                    {isViewingScorecard ? (
                        /* Use the ScorecardView component */
                        <ScorecardView
                            activeScorecard={activeScorecard}
                            handleBackToChat={handleBackToChat}
                            lastUserMessage={getLastUserMessage as ChatMessage | null}
                        />
                    ) : (
                        /* Use the ChatView component */
                        <ChatView
                            currentChatHistory={currentChatHistory as ChatMessage[]}
                            isAiResponding={isAiResponding}
                            showPreparingReport={showPreparingReport}
                            isChatHistoryLoaded={isChatHistoryLoaded}
                            isTestMode={isTestMode}
                            taskType='quiz'
                            currentQuestionConfig={validQuestions[currentQuestionIndex]?.config}
                            isSubmitting={isSubmitting}
                            currentAnswer={currentAnswer}
                            handleInputChange={handleInputChange}
                            handleSubmitAnswer={handleSubmitAnswer}
                            handleAudioSubmit={handleAudioSubmit}
                            handleViewScorecard={handleViewScorecard}
                            viewOnly={viewOnly}
                            completedQuestionIds={completedQuestionIds}
                            currentQuestionId={validQuestions[currentQuestionIndex]?.id}
                            handleRetry={handleRetry}
                            onCodeStateChange={handleCodeStateChange}
                            initialIsViewingCode={isCodeQuestion}
                            showLearnerView={showLearnerView}
                            onShowLearnerViewChange={setShowLearnerView}
                            isAdminView={isAdminView}
                            userId={userId}
                            ref={chatViewRef}
                        />
                    )}
                </div>

                {/* Third column - Code Preview (only shown for coding questions) */}
                {isCodeQuestion && codeViewState.isViewingCode && (
                    <div className="border-l border-[#222222] bg-[#111111] h-full overflow-auto">
                        <CodePreview
                            isRunning={codeViewState.isRunning}
                            previewContent={codeViewState.previewContent}
                            output={codeViewState.output}
                            isWebPreview={codeViewState.hasWebLanguages}
                            executionTime={codeViewState.executionTime}
                            onClear={() => {
                                // Clear the code output in the codeViewState
                                setCodeViewState(prev => ({
                                    ...prev,
                                    previewContent: '',
                                    output: '',
                                    executionTime: ''
                                }));
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Navigation Confirmation Dialog */}
            <ConfirmationDialog
                open={showNavigationConfirmation}
                title="What's the rush?"
                message="Our AI is still reviewing your answer and will be ready with a response soon. If you navigate away now, you will not see the complete response. Are you sure you want to leave?"
                confirmButtonText="Leave anyway"
                cancelButtonText="Stay"
                onConfirm={handleNavigationConfirm}
                onCancel={handleNavigationCancel}
                type="custom"
            />

            {/* Exam Submission Confirmation Dialog */}
            <ConfirmationDialog
                open={showExamSubmissionConfirmation}
                title="Confirm Submission"
                message="This is an exam question. You can only submit your answer once and won't be able to modify it. Are you sure you want to submit now?"
                confirmButtonText="Submit"
                cancelButtonText="Review again"
                onConfirm={handleExamSubmissionConfirm}
                onCancel={handleExamSubmissionCancel}
                type="custom"
            />

            {/* Mobile view floating button */}
            <button
                onClick={toggleMobileMenu}
                className={`fixed right-4 w-14 h-14 rounded-full bg-purple-700 text-white flex items-center justify-center shadow-lg z-20 cursor-pointer transition-transform duration-300 focus:outline-none mobile-view-button ${showButtonEntrance ? 'button-entrance' : ''} ${showButtonPulse ? 'button-pulse' : ''}`}
                style={{ bottom: '150px' }}
                aria-label="View options"
            >
                {isMobileMenuOpen ? (
                    <X className="h-6 w-6" />
                ) : (
                    mobileViewMode === 'split' ? (
                        <SplitSquareVertical className="h-6 w-6" />
                    ) : mobileViewMode === 'question-full' ? (
                        <Maximize2 className="h-6 w-6" />
                    ) : (
                        <MessageCircle className="h-6 w-6" />
                    )
                )}
            </button>

            {/* Semi-transparent overlay when menu is open */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-10"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
                    aria-hidden="true"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile view menu */}
            {isMobileMenuOpen && (
                <div className="fixed right-4 flex flex-col gap-4 items-end z-20" style={{ bottom: '220px' }} ref={mobileMenuRef}>
                    {/* Question Only Button */}
                    <div className="flex items-center gap-3">
                        <span className="bg-black text-white py-2 px-4 rounded-full text-sm shadow-md">
                            Expand Question
                        </span>
                        <button
                            onClick={() => setViewMode('question-full')}
                            className="w-12 h-12 rounded-full bg-purple-700 text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-purple-600 transition-colors"
                            aria-label="Show question only"
                        >
                            <Maximize2 className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Chat Only Button */}
                    <div className="flex items-center gap-3">
                        <span className="bg-black text-white py-2 px-4 rounded-full text-sm shadow-md">
                            Expand Chat
                        </span>
                        <button
                            onClick={() => setViewMode('chat-full')}
                            className="w-12 h-12 rounded-full bg-purple-700 text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-purple-600 transition-colors"
                            aria-label="Show chat only"
                        >
                            <MessageCircle className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Split View Button */}
                    <div className="flex items-center gap-3">
                        <span className="bg-black text-white py-2 px-4 rounded-full text-sm shadow-md">
                            Split View
                        </span>
                        <button
                            onClick={() => setViewMode('split')}
                            className="w-12 h-12 rounded-full bg-purple-700 text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-purple-600 transition-colors"
                            aria-label="Show split view"
                        >
                            <SplitSquareVertical className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
} 