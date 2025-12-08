"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import BlockNoteEditor from "./BlockNoteEditor";
import ChatView from "./ChatView";
import ScorecardView from "./ScorecardView";
import { ChatMessage, ScorecardItem } from "../types/quiz";
import { getDraft, setDraft, deleteDraft } from '@/lib/utils/indexedDB';
import { blobToBase64, convertAudioBufferToWav } from '@/lib/utils/audioUtils';
import Toast from "./Toast";

import { CheckCircle } from "lucide-react";
import { BlockList, RenderConfig } from "@udus/notion-renderer/components";
import "@udus/notion-renderer/styles/globals.css";
import "katex/dist/katex.min.css";
import { useAuth } from "@/lib/auth";

interface LearnerAssignmentViewProps {
    problemBlocks?: unknown[];
    title?: string;
    submissionType?: string;
    userId?: string;
    taskId?: string;
    isTestMode?: boolean;
    viewOnly?: boolean;
    className?: string;
    onTaskComplete?: (taskId: string, isComplete: boolean) => void;
    onAiRespondingChange?: (isResponding: boolean) => void;
}

// Local chat message type aligned with ChatView expectations
type Sender = "user" | "ai";
type MessageType = "text" | "audio" | "code" | "file";

interface ChatMessageLocal {
    id: string;
    content: string;
    sender: Sender;
    timestamp: Date;
    messageType?: MessageType;
    audioData?: string;
    isError?: boolean;
    rawContent?: string; // Store the original JSON content for AI messages
}

// New assignment response interface
interface AssignmentResponse {
    feedback: string;
    evaluation_status: "in_progress" | "needs_resubmission" | "completed";
    key_area_scores: Record<string, number>;
    current_key_area: string;
}

export default function LearnerAssignmentView({
    problemBlocks: initialProblemBlocks = [],
    title: initialTitle,
    submissionType: initialSubmissionType = "text",
    userId = "",
    taskId = "",
    isTestMode = true,
    viewOnly = false,
    className = "",
    onTaskComplete,
    onAiRespondingChange,
}: LearnerAssignmentViewProps) {
    // Left panel editor is read-only
    const isDarkMode = true;

    const { user } = useAuth();

    // Data fetching state
    const [isLoadingAssignment, setIsLoadingAssignment] = useState(true);
    const [hasFetchedData, setHasFetchedData] = useState(false);

    // Assignment data state
    const [problemBlocks, setProblemBlocks] = useState<unknown[]>(initialProblemBlocks);
    const [title, setTitle] = useState<string>(initialTitle || "");
    const [submissionType, setSubmissionType] = useState<string>(initialSubmissionType);
    const [settings, setSettings] = useState<{ allowCopyPaste?: boolean }>({});

    // Right panel: chat + upload local state
    const [chatHistory, setChatHistory] = useState<ChatMessageLocal[]>([]);
    const [isAiResponding, setIsAiResponding] = useState(false);
    const [isChatHistoryLoaded, setIsChatHistoryLoaded] = useState(false);

    // NEW: Assignment evaluation state
    const [evaluationStatus, setEvaluationStatus] = useState<"in_progress" | "needs_resubmission" | "completed">("in_progress");

    // Scorecard state
    const [isViewingScorecard, setIsViewingScorecard] = useState(false);
    const [activeScorecard, setActiveScorecard] = useState<ScorecardItem[]>([]);
    const [showPreparingReport, setShowPreparingReport] = useState(false);

    // Input state for ChatView
    const [currentAnswer, setCurrentAnswer] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Toast state
    const [toastData, setToastData] = useState({
        title: '',
        description: '',
        emoji: ''
    });
    const [showToast, setShowToast] = useState(false);
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => setShowToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // Update the parent component when AI responding state changes
    useEffect(() => {
        if (onAiRespondingChange) {
            onAiRespondingChange(isAiResponding);
        }
    }, [isAiResponding, onAiRespondingChange]);

    // Fetch assignment data from API when taskId changes
    useEffect(() => {
        const fetchAssignmentData = async () => {
            if (!taskId || hasFetchedData) {
                setIsLoadingAssignment(false);
                return;
            }

            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch assignment details');
                }

                const data = await response.json();
                const assignment = data.assignment;

                if (assignment) {
                    // Load problem blocks
                    if (assignment.blocks && Array.isArray(assignment.blocks)) {
                        setProblemBlocks(assignment.blocks);
                    }

                    // Load title
                    if (assignment.title) {
                        setTitle(assignment.title);
                    }

                    // Load submission type
                    if (assignment.input_type) {
                        setSubmissionType(assignment.input_type);
                    }

                    // Load settings
                    if (assignment.settings) {
                        setSettings(assignment.settings);
                    }
                }

                setHasFetchedData(true);
            } catch (error) {
                console.error('Error fetching assignment data:', error);
            } finally {
                setIsLoadingAssignment(false);
            }
        };

        fetchAssignmentData();
    }, [taskId, hasFetchedData]);

    // Reset hasFetchedData when taskId changes
    useEffect(() => {
        setHasFetchedData(false);
    }, [taskId]);


    // Handle assignment response based on evaluation status
    const handleAssignmentResponse = useCallback((response: AssignmentResponse) => {
        // Update evaluation status
        setEvaluationStatus(response.evaluation_status);

        // Call onTaskComplete callback when assignment is completed
        if (response.evaluation_status === "completed" && onTaskComplete && taskId) {
            onTaskComplete(taskId, true);
        }
    }, [onTaskComplete, taskId]);


    // Helper function to convert scorecard scores to ScorecardItem format
    const convertScorecardScoresToScorecard = useCallback((scorecardScores: Record<string, any>): ScorecardItem[] => {
        return Object.entries(scorecardScores).map(([category, data]) => ({
            category,
            score: data.score || 0,
            max_score: data.max_score || 4,
            pass_score: data.pass_score || 3,
            feedback: data.feedback || {}
        }));
    }, []);

    // Function to store chat history in backend (similar to LearnerQuizView)
    const storeChatHistory = useCallback(async (userMessage: ChatMessageLocal, aiResponse: AssignmentResponse) => {
        if (!userId || isTestMode || !taskId) return;

        // Create content object for AI response
        const contentObj = {
            feedback: aiResponse.feedback,
            evaluation_status: aiResponse.evaluation_status,
            current_key_area: aiResponse.current_key_area,
            key_area_scores: aiResponse.key_area_scores,
        };
        const aiContent = JSON.stringify(contentObj);

        const messages = [
            {
                role: "user",
                content: userMessage.content,
                response_type: userMessage.messageType || 'text',
                created_at: userMessage.timestamp
            },
            {
                role: "assistant",
                content: aiContent,
                created_at: new Date()
            }
        ];

        const requestBody = {
            user_id: parseInt(userId),
            task_id: parseInt(taskId),
            messages: messages,
            is_complete: aiResponse.evaluation_status === "completed"
        };

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat/?userId=${encodeURIComponent(userId)}&taskId=${encodeURIComponent(taskId)}`, {
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
    }, [userId, isTestMode, taskId]);


    // Fetch chat history from backend when component mounts or task changes
    useEffect(() => {
        // Skip if we're in test mode or if userId is not available or if we've already loaded chat history
        if (isTestMode || !userId || isChatHistoryLoaded || !taskId) {
            return;
        }

        const fetchChatHistory = async () => {
            try {
                // Make API call to fetch chat history using the provided taskId
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat/user/${userId}/task/${taskId}`);

                if (!response.ok) {
                    throw new Error(`Failed to fetch chat history: ${response.status}`);
                }

                const chatData = await response.json();

                // Process messages sequentially with Promise.all for audio messages
                const localChatHistory: ChatMessageLocal[] = await Promise.all((chatData as Array<{
                    role: string;
                    id: string | number;
                    content: string;
                    created_at: string;
                    response_type?: string;
                }>).map(async (message) => {
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

                    // For AI messages, extract only the feedback field from JSON content
                    // For user file messages, extract filename from JSON content
                    let displayContent = message.content;
                    let rawContent = message.content;
                    if (message.role === 'assistant' && message.content) {
                        try {
                            const parsedContent = JSON.parse(message.content);
                            if (parsedContent.feedback) {
                                displayContent = parsedContent.feedback;
                                rawContent = message.content;
                            }
                        } catch (error) {
                            // If parsing fails, use the original content
                            console.log('Failed to parse AI message content, using original:', error);
                        }
                    } else if (message.role === 'user' && message.response_type === 'file' && message.content) {
                        try {
                            const parsedContent = JSON.parse(message.content);
                            if (parsedContent.filename) {
                                displayContent = parsedContent.filename;
                                rawContent = message.content;
                            }
                        } catch (error) {
                            // If parsing fails, use the original content
                            console.log('Failed to parse user file message content, using original:', error);
                        }
                    }

                    // Extract file info for file messages
                    let fileUuid: string | undefined;
                    let fileName: string | undefined;
                    if (message.role === 'user' && message.response_type === 'file' && rawContent) {
                        try {
                            const parsedContent = JSON.parse(rawContent);
                            fileUuid = parsedContent.file_uuid;
                            fileName = parsedContent.filename;
                        } catch {
                            // Ignore parse errors
                        }
                    }

                    return {
                        id: `${message.role}-${message.id}`,
                        content: displayContent,
                        sender: message.role === 'user' ? 'user' : 'ai',
                        timestamp: new Date(message.created_at),
                        messageType: (message.response_type as MessageType) || 'text',
                        audioData: audioData,
                        isError: false,
                        rawContent: rawContent,
                        fileUuid: fileUuid,
                        fileName: fileName
                    };
                }));

                setChatHistory(localChatHistory);
                setIsChatHistoryLoaded(true);

            } catch (error) {
                console.error("Error fetching chat history:", error);
                setIsChatHistoryLoaded(true); // Set to true even on error to prevent retries
            }
        };

        fetchChatHistory();
    }, [isTestMode, userId, isChatHistoryLoaded, taskId]);

    // Derived config for ChatView
    const currentQuestionConfig = useMemo(() => ({
        title: title || "Assignment",
        inputType: submissionType || "text",
        responseType: "chat",
        questionType: "subjective",
        correctAnswer: [],
        scorecardData: undefined,
        codingLanguages: [],
        settings: settings,
    }), [title, submissionType, settings]);

    // Map local chat history to ChatView-compatible messages, attaching scorecard for completed assignment
    const chatHistoryForView = useMemo(() => {
        const mapped = (chatHistory as unknown as any[]).map((msg) => {
            const base: any = { ...msg };
            // Ensure messageType aligns with ChatView expectations
            base.messageType = base.messageType || 'text';
            // For AI messages, try to attach scorecard when completed
            if (base.sender === 'ai') {
                try {
                    const parsed = JSON.parse(base.rawContent || base.content || '{}');
                    if (parsed && parsed.evaluation_status === 'completed' && parsed.key_area_scores) {
                        const scorecard = convertScorecardScoresToScorecard(parsed.key_area_scores);
                        if (Array.isArray(scorecard) && scorecard.length > 0) {
                            base.scorecard = scorecard;
                            // Ensure displayed content is feedback text
                            if (parsed.feedback) {
                                base.content = parsed.feedback;
                            }
                        }
                    }
                } catch { /* ignore parse errors */ }
            }
            return base;
        });
        return mapped as unknown as ChatMessage[];
    }, [chatHistory, convertScorecardScoresToScorecard]);

    // Helpers for ChatView handlers
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setCurrentAnswer(newValue);
        try {
            const key = String(taskId || 'assignment');
            setDraft(key, newValue || '');
        } catch { }
    }, [taskId]);

    // Process a user response
    const processUserResponse = useCallback(
        async (
            responseContent: string,
            responseType: 'text' | 'audio' | 'file' = 'text',
            audioData?: string,
            fileUuid?: string,
            fileData?: string
        ) => {
            if (!taskId || !userId) {
                return;
            }

            // Set submitting state to true
            setIsSubmitting(true);
            setIsAiResponding(true);

            // Create the user message object for display
            const displayMessage: ChatMessageLocal = {
                id: `user-${Date.now()}`,
                content: responseType === 'file' ? `${responseContent}` : responseContent,
                sender: 'user',
                timestamp: new Date(),
                messageType: responseType,
                audioData: audioData,
            };

            // Create storage message
            const storageMessage: ChatMessageLocal = {
                ...displayMessage,
                content: responseType === 'file' && fileUuid ? JSON.stringify({
                    file_uuid: fileUuid,
                    filename: responseContent,
                }) : responseContent,
                messageType: responseType === 'file' ? 'file' : responseType,
            };

            // Immediately add the display message to chat history
            setChatHistory(prev => [...prev, displayMessage]);

            // Clear the input field after submission (only for text input)
            if (responseType === 'text') {
                setCurrentAnswer("");
                try {
                    const key = String(taskId || 'assignment');
                    deleteDraft(key);
                } catch { }
            }

            // Track if we've received any feedback
            let receivedAnyFeedback = false;

            // Shared upload flow for 'audio' (with audioData) and 'file' (with fileData)
            let presigned_url = '';
            let file_uuid = '';
            if ((responseType === 'audio' && audioData) || (responseType === 'file' && fileData)) {
                console.log({ responseType });
                const isAudio = responseType === 'audio';
                const contentType = isAudio ? 'audio/wav' : 'application/zip';
                const filename = isAudio ? 'audio.wav' : 'file.zip';

                try {
                    // First, get a presigned URL for the file
                    const presignedUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/create`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            content_type: contentType
                        })
                    });

                    if (!presignedUrlResponse.ok) {
                        throw new Error('Failed to get presigned URL');
                    }

                    const presignedData = await presignedUrlResponse.json();
                    presigned_url = presignedData.presigned_url;
                    file_uuid = presignedData.file_uuid;
                } catch {
                    console.error("Error getting presigned URL");
                }

                // Convert base64 data to a Blob
                const binaryData = atob(isAudio ? (audioData as string) : (fileData as string));
                const arrayBuffer = new ArrayBuffer(binaryData.length);
                const uint8Array = new Uint8Array(arrayBuffer);
                for (let i = 0; i < binaryData.length; i++) {
                    uint8Array[i] = binaryData.charCodeAt(i);
                }
                const dataBlob = new Blob([uint8Array], { type: contentType });

                if (!presigned_url) {
                    // If we couldn't get a presigned URL, try direct upload to the backend
                    try {
                        // Create FormData for the file upload
                        const formData = new FormData();
                        formData.append('file', dataBlob, filename);
                        formData.append('content_type', contentType);

                        // Upload directly to the backend
                        const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/upload-local`, {
                            method: 'POST',
                            body: formData
                        });

                        if (!uploadResponse.ok) {
                            throw new Error(`Failed to upload file to backend`);
                        }

                        const uploadData = await uploadResponse.json();
                        file_uuid = uploadData.file_uuid;

                        // Update the storage message content with the file information
                        if (isAudio) {
                            storageMessage.content = file_uuid || '';
                        } else {
                            storageMessage.content = JSON.stringify({ file_uuid: file_uuid || '', filename: responseContent });
                        }
                    } catch {
                        throw new Error('Error with direct upload to backend');
                    }
                } else {
                    // Upload the file to S3 using the presigned URL
                    try {
                        const uploadResponse = await fetch(presigned_url, {
                            method: 'PUT',
                            body: dataBlob,
                            headers: {
                                'Content-Type': contentType
                            }
                        });

                        if (!uploadResponse.ok) {
                            throw new Error(`Failed to upload file to S3`);
                        }

                        // Update the storage message content with the file information
                        if (isAudio) {
                            storageMessage.content = file_uuid;
                        } else {
                            storageMessage.content = JSON.stringify({ file_uuid, filename: responseContent });
                        }
                    } catch {
                        throw new Error('Error uploading file to S3');
                    }
                }
            }

            // In test mode, include chat history in the request
            const formattedChatHistory = isTestMode ? chatHistory.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.sender === 'user' ? msg.content : msg.rawContent || msg.content,
                response_type: msg.messageType || 'text',
                created_at: msg.timestamp
            })) : undefined;

            const requestBody: Record<string, unknown> = {
                user_response: responseType === 'audio' ? (file_uuid || audioData) : responseType === 'file' ? (fileUuid || file_uuid) : responseContent,
                response_type: responseType,
                task_id: taskId,
                user_id: userId,
                user_email: user?.email,
                task_type: 'assignment',
                ...(isTestMode && { chat_history: formattedChatHistory })
            };

            // Call the API with the appropriate request body for streaming response
            console.log({ requestBody });
            fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ai/assignment`, {
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

                    // Get the response reader for streaming
                    const reader = response.body?.getReader();

                    if (!reader) {
                        console.error('assignment stream: failed to get reader from response body');
                        throw new Error('Failed to get response reader');
                    }

                    // Function to process the streaming chunks
                    const processStream = async () => {
                        try {
                            let assignmentResponse: AssignmentResponse = {
                                feedback: "",
                                evaluation_status: "in_progress",
                                key_area_scores: {},
                                current_key_area: "",
                            };

                            // Buffer to accumulate partial lines across chunks
                            let bufferedLine = "";

                            while (true) {
                                const { done, value } = await reader.read();

                                if (done) {
                                    break;
                                }

                                // Convert the chunk to text
                                const chunk = new TextDecoder().decode(value);
                                console.debug('assignment stream: chunk received', { length: chunk.length, preview: chunk.slice(0, 200) });

                                // Prepend any buffered partial line from the previous chunk
                                const text = bufferedLine ? bufferedLine + chunk : chunk;
                                bufferedLine = "";

                                // Split by newlines to handle multiple JSON objects in a single chunk
                                const lines = text.split('\n');

                                // Process all complete lines; keep the last as buffer if it seems incomplete
                                for (let i = 0; i < lines.length; i++) {
                                    const isLast = i === lines.length - 1;
                                    const line = lines[i];

                                    // If this is the last line and the chunk doesn't end with a newline,
                                    // buffer it for the next chunk (it might be incomplete)
                                    if (isLast && chunk && !chunk.endsWith('\n')) {
                                        bufferedLine = line;
                                        continue;
                                    }

                                    // Skip empty lines
                                    const trimmedLine = line.trim();
                                    if (!trimmedLine) continue;

                                    try {
                                        const data = JSON.parse(trimmedLine);

                                        // Merge any received fields unconditionally to avoid stale state
                                        assignmentResponse = { ...assignmentResponse, ...data };

                                        // Handle feedback-specific UI updates
                                        if (data.feedback) {
                                            // If this is the first feedback chunk we've received
                                            if (!receivedAnyFeedback) {
                                                receivedAnyFeedback = true;

                                                // Stop showing the animation
                                                setIsAiResponding(false);

                                                // Add the AI message to chat history now that we have content
                                                setChatHistory(prev => [...prev, {
                                                    id: `ai-${Date.now()}`,
                                                    content: assignmentResponse.feedback,
                                                    sender: 'ai',
                                                    timestamp: new Date(),
                                                    messageType: 'text',
                                                    audioData: undefined,
                                                }]);
                                            } else {
                                                // Update the existing AI message content for subsequent chunks
                                                setChatHistory(prev => {
                                                    const newHistory = [...prev];
                                                    const lastIndex = newHistory.length - 1;
                                                    if (lastIndex >= 0 && newHistory[lastIndex].sender === 'ai') {
                                                        newHistory[lastIndex] = { ...newHistory[lastIndex], content: assignmentResponse.feedback } as any;
                                                    }
                                                    return newHistory;
                                                });
                                            }
                                        }

                                        // Detect when report (scorecard) starts preparing as soon as we see scores and completed status
                                        if (data.key_area_scores && !showPreparingReport && (assignmentResponse.evaluation_status === "completed" || data.evaluation_status === "completed")) {
                                            setShowPreparingReport(true);
                                        }
                                    } catch (err) {
                                        // Parsing failed - log but don't throw (like LearnerQuizView does)
                                        // This allows the stream to continue processing even if one line fails
                                        console.error('assignment stream: JSON parse failed', { linePreview: trimmedLine.slice(0, 200) }, err);
                                        // Continue processing other lines instead of crashing
                                    }
                                }
                            }

                            // Process any remaining buffered content after the stream ends
                            if (bufferedLine && bufferedLine.trim()) {
                                try {
                                    const data = JSON.parse(bufferedLine.trim());
                                    // Merge final buffered data
                                    assignmentResponse = { ...assignmentResponse, ...data };
                                } catch (err) {
                                    console.error('assignment stream: Failed to parse final buffered line', err);
                                }
                            }

                            // After processing all chunks (stream is complete)
                            // Store the raw JSON on the last AI message so downstream logic can parse status/scorecard
                            try {
                                const finalRaw = JSON.stringify(assignmentResponse);
                                setChatHistory(prev => {
                                    const newHistory = [...prev];
                                    const lastIndex = newHistory.length - 1;
                                    if (lastIndex >= 0 && newHistory[lastIndex].sender === 'ai') {
                                        newHistory[lastIndex] = { ...newHistory[lastIndex], rawContent: finalRaw } as any;
                                    }
                                    return newHistory;
                                });
                            } catch { }

                            // Update evaluation state
                            handleAssignmentResponse(assignmentResponse);
                            console.table({ assignmentResponse });

                            // Hide preparing report indicator now that streaming is complete
                            if (showPreparingReport) {
                                setTimeout(() => setShowPreparingReport(false), 0);
                            }

                            // Store chat history after getting complete response
                            if (!isTestMode) {
                                storeChatHistory(storageMessage, assignmentResponse);
                            }
                        } catch (error) {
                            const err = error as Error;
                            console.error('assignment stream: processing error', { message: err?.message, stack: err?.stack });
                            // Only reset the preparing report state when an error occurs
                            // and we need to allow the user to try again
                            if (showPreparingReport) {
                                setTimeout(() => setShowPreparingReport(false), 0);
                            }
                        }
                    };

                    // Start processing the stream
                    return processStream();
                })
                .catch((error) => {
                    console.error('Error fetching AI response', error);

                    // Show error message to the user
                    const errorMessage = responseType === 'audio'
                        ? "There was an error while processing your audio. Please try again."
                        : responseType === 'file'
                            ? "There was an error while processing your file. Please try again."
                            : "There was an error while processing your answer. Please try again.";

                    const errorResponse: ChatMessageLocal = {
                        id: `ai-error-${Date.now()}`,
                        content: errorMessage,
                        sender: 'ai',
                        timestamp: new Date(),
                        messageType: 'text',
                        audioData: undefined,
                        isError: true
                    };

                    // Add the error message to the chat history
                    setChatHistory(prev => [...prev, errorResponse]);

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
            taskId,
            userId,
            user?.email,
            isTestMode,
            storeChatHistory,
            handleAssignmentResponse,
            showPreparingReport,
            chatHistory
        ]
    );

    const handleSubmitAnswer = useCallback(async () => {
        if (!currentAnswer.trim()) return;

        // Use the shared processing function
        processUserResponse(currentAnswer, 'text');
    }, [currentAnswer, processUserResponse]);

    const handleAudioSubmit = useCallback(async (audioBlob: Blob) => {
        try {
            // Convert the WebM audio blob to WAV format (8kHz)
            const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const wavBuffer = convertAudioBufferToWav(audioBuffer, 8000);
            const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

            // Convert the WAV blob to base64 for immediate local playback in chat
            const reader = new FileReader();
            reader.readAsDataURL(wavBlob);

            reader.onloadend = async () => {
                const base64Audio = reader.result as string;
                const base64Data = base64Audio.split(',')[1];

                processUserResponse('', 'audio', base64Data);
            };
        } catch {
            console.error("Error processing audio submission");
            setIsSubmitting(false);
            setIsAiResponding(false);
        }
    }, [processUserResponse]);

    const handleFileSubmit = async (file: File) => {
        if (viewOnly) return;

        try {
            // Convert the file to base64 for presigned URL upload (similar to audio flow)
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onloadend = async () => {
                const base64File = reader.result as string;
                const base64Data = base64File.split(',')[1];

                // Pass fileData to processUserResponse so it uses the presigned URL flow
                processUserResponse(file.name, 'file', undefined, undefined, base64Data);
            };

            reader.onerror = () => {
                throw new Error('Failed to read file');
            };
        } catch (error) {
            console.error('Error processing file upload:', error);
            // Show error message to the user
            const errorResponse: ChatMessageLocal = {
                id: `ai-error-${Date.now()}`,
                content: "There was an error while processing your file. Please try again.",
                sender: 'ai',
                timestamp: new Date(),
                messageType: 'text',
                audioData: undefined,
                isError: true
            };
            setChatHistory(prev => [...prev, errorResponse]);
        }
    };

    const handleViewScorecard = useCallback((scorecard: ScorecardItem[]) => {
        setActiveScorecard(scorecard);
        setIsViewingScorecard(true);
        // Hide preparing report once the scorecard is opened
        setShowPreparingReport(false);
    }, []);

    const handleBackToChat = useCallback(() => {
        setIsViewingScorecard(false);
    }, []);

    const handleFileDownload = useCallback(async (fileUuid: string, fileName: string) => {
        try {
            // Try to get presigned URL first
            const presignedResponse = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/get?uuid=${fileUuid}&file_extension=zip`,
                { method: 'GET' }
            );

            let downloadUrl: string;
            if (presignedResponse.ok) {
                const { url } = await presignedResponse.json();
                downloadUrl = url;
            } else {
                // Fallback to direct download
                downloadUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/file/download-local/?uuid=${fileUuid}&file_extension=zip`;
            }

            // Fetch the file as a blob to have control over the filename
            const fileResponse = await fetch(downloadUrl);
            if (!fileResponse.ok) {
                throw new Error('Failed to download file');
            }

            const blob = await fileResponse.blob();
            const blobUrl = URL.createObjectURL(blob);

            // Create a temporary link and trigger download with the correct filename
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up the object URL
            URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    }, []);

    // Check if assignment is completed based on evaluation status or last AI message
    const isCompleted = useMemo(() => {
        // If no chat history, not completed
        if (chatHistory.length === 0) {
            return false;
        }

        // Find the last AI message
        const lastAiMessage = [...chatHistory].reverse().find(msg => msg.sender === 'ai');
        if (!lastAiMessage) {
            return false;
        }

        // Try to parse the rawContent to check evaluation status
        try {
            const parsedContent = JSON.parse(lastAiMessage.rawContent || lastAiMessage.content);
            // check if all criteria are met
            if (parsedContent.key_area_scores && parsedContent.evaluation_status === "completed") {
                const scorecard = convertScorecardScoresToScorecard(parsedContent.key_area_scores);
                if (scorecard.length > 0) {
                    // check if all scorecard items meet their pass criteria
                    const allCriteriaMet = scorecard.every((item: ScorecardItem) =>
                        item.score !== null && item.score !== undefined &&
                        (
                            (item.pass_score !== null && item.pass_score !== undefined && item.score >= item.pass_score) ||
                            (item.max_score !== null && item.max_score !== undefined && item.score === item.max_score)
                        )
                    );
                    return allCriteriaMet;
                }
            }

            return false;
        } catch (error) {
            // If parsing fails, check if content contains "completed" status
            return (lastAiMessage.rawContent || lastAiMessage.content).includes('"evaluation_status":"completed"');
        }
    }, [evaluationStatus, chatHistory, convertScorecardScoresToScorecard]);

    // Load draft on task change
    useEffect(() => {
        const loadDraft = async () => {
            try {
                const key = String(taskId || 'assignment');
                const draft = await getDraft(key);
                if (typeof draft === 'string') {
                    setCurrentAnswer(draft);
                } else {
                    setCurrentAnswer('');
                }
            } catch { }
        };
        loadDraft();
    }, [taskId]);

    // Auto-show scorecard when assignment is completed
    useEffect(() => {
        if (isCompleted && chatHistory.length > 0) {
            // Find the last AI message
            const lastAiMessage = [...chatHistory].reverse().find(msg => msg.sender === 'ai');
            if (lastAiMessage) {
                try {
                    const parsedContent = JSON.parse(lastAiMessage.rawContent || lastAiMessage.content);
                    if (parsedContent.key_area_scores) {
                        const scorecard = convertScorecardScoresToScorecard(parsedContent.key_area_scores);
                        if (scorecard.length > 0) {
                            setActiveScorecard(scorecard);
                            setIsViewingScorecard(true);
                            // Ensure the preparing report banner is hidden when opening scorecard automatically
                            setShowPreparingReport(false);
                        }
                    }
                } catch (error) {
                    console.log('Failed to parse AI message for scorecard:', error);
                }
            }
        }
    }, [isCompleted, chatHistory, convertScorecardScoresToScorecard]);

    // Check if needs resubmission based on evaluation status or last AI message
    const needsResubmission = useMemo(() => {
        // First check evaluation status
        if (evaluationStatus === "needs_resubmission") {
            return true;
        }

        // If no chat history, show upload for first submission
        if (chatHistory.length === 0) {
            return true;
        }

        // Find the last AI message
        const lastAiMessage = [...chatHistory].reverse().find(msg => msg.sender === 'ai');
        if (!lastAiMessage) {
            return true; // No AI message yet, show upload
        }

        // Try to parse the rawContent to check evaluation status
        try {
            const parsedContent = JSON.parse(lastAiMessage.rawContent || lastAiMessage.content);
            return parsedContent.evaluation_status === "needs_resubmission";
        } catch (error) {
            // If parsing fails, check if content contains "needs_resubmission" status
            return (lastAiMessage.rawContent || lastAiMessage.content).includes('"evaluation_status":"needs_resubmission"');
        }
    }, [evaluationStatus, chatHistory]);

    // Disable copy/paste only when explicitly set to false
    const disableCopyPaste = settings?.allowCopyPaste === false;

    // Prevent CMD/CTRL+A when copy/paste is disabled
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (disableCopyPaste) {
                if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
                    event.preventDefault();
                    event.stopPropagation();
                    setToastData({
                        title: 'Not allowed',
                        description: 'Selecting all text is disabled for this assignment',
                        emoji: '🚫'
                    });
                    setShowToast(true);
                }
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [disableCopyPaste]);

    // Show loading state while fetching assignment data
    if (isLoadingAssignment) {
        return (
            <div className={`w-full h-full flex items-center justify-center ${className}`}>
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            </div>
        );
    }

    // Integration logic for Notion blocks (parity with LearnerQuizView)
    const currentIntegrationType = 'notion';
    type IntegrationBlock = { type?: string; content?: unknown[]; props?: { resource_name?: string } };
    const integrationBlock = (problemBlocks as IntegrationBlock[]).find((block) => block?.type === currentIntegrationType);
    const integrationBlocks = integrationBlock?.content || [];
    const initialContent = integrationBlock ? undefined : problemBlocks;

    return (
        <div className={`w-full h-full ${className}`}>
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
            `}</style>
            <div className="two-column-grid rounded-md overflow-hidden bg-[#111111]">
                {/* Left: Problem Statement */}
                <div className="p-6 border-r border-[#222222] flex flex-col bg-[#1A1A1A]" style={{ overflow: 'auto' }}>
                    {/* Header chip like LearnerQuizView */}
                    <div className="flex items-center justify-center w-full mb-6">
                        <div className="bg-[#222222] px-3 py-1 rounded-full text-white text-sm flex items-center">
                            <span>Problem Statement</span>
                            {isCompleted && (
                                <CheckCircle size={14} className="ml-2 text-green-500 flex-shrink-0" />
                            )}
                        </div>
                    </div>

                    <div className="flex-1">
                        <div
                            className="ml-[-60px]"
                            onCopy={(e) => {
                                if (disableCopyPaste) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setToastData({
                                        title: 'Not allowed',
                                        description: 'Copying is disabled for this assignment',
                                        emoji: '🚫'
                                    });
                                    setShowToast(true);
                                }
                            }}
                        >
                            {integrationBlocks.length > 0 ? (
                                <div className="bg-[#191919] text-white px-20 pr-0 pb-6 rounded-lg">
                                    <h1 className="text-white text-4xl font-bold mb-4 pl-0.5">{integrationBlock?.props?.resource_name}</h1>
                                    <RenderConfig theme="dark">
                                        <BlockList blocks={integrationBlocks} />
                                    </RenderConfig>
                                </div>
                            ) : (
                                <BlockNoteEditor
                                    key={`assignment-problem-view`}
                                    initialContent={initialContent as any}
                                    onChange={() => { }}
                                    isDarkMode={isDarkMode}
                                    readOnly={true}
                                    className={`!bg-transparent quiz-viewer`}
                                    placeholder="Problem statement will appear here"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Upload + Chat */}
                <div className="flex flex-col bg-[#111111] h-full overflow-auto border-l border-[#222222] chat-container">
                    {isViewingScorecard ? (
                        /* Use the ScorecardView component */
                        <ScorecardView
                            activeScorecard={activeScorecard}
                            handleBackToChat={handleBackToChat}
                            lastUserMessage={null}
                        />
                    ) : (
                        /* Use the ChatView component */
                        <div className="flex-1 min-h-0">
                            <ChatView
                                currentChatHistory={chatHistoryForView}
                                isAiResponding={isAiResponding}
                                showPreparingReport={showPreparingReport}
                                isChatHistoryLoaded={isChatHistoryLoaded}
                                isTestMode={isTestMode}
                                taskType={'assignment'}
                                currentQuestionConfig={currentQuestionConfig}
                                isSubmitting={isSubmitting}
                                currentAnswer={currentAnswer}
                                handleInputChange={handleInputChange}
                                handleSubmitAnswer={() => handleSubmitAnswer()}
                                handleAudioSubmit={handleAudioSubmit}
                                handleViewScorecard={handleViewScorecard}
                                viewOnly={viewOnly || isCompleted}
                                completedQuestionIds={{}}
                                currentQuestionId={"assignment"}
                                userId={userId}
                                showUploadSection={needsResubmission}
                                onFileUploaded={handleFileSubmit}
                                    onFileDownload={handleFileDownload}
                            />
                        </div>
                    )}
                </div>
            </div>
            {/* Toast */}
            <Toast
                show={showToast}
                title={toastData.title}
                description={toastData.description}
                emoji={toastData.emoji}
                onClose={() => setShowToast(false)}
            />
        </div>
    );
}