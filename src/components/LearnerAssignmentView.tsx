"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import BlockNoteEditor from "./BlockNoteEditor";
import ChatView from "./ChatView";
import ScorecardView from "./ScorecardView";
import { ChatMessage, ScorecardItem } from "../types/quiz";

import { CheckCircle } from "lucide-react";
import { BlockList, RenderConfig } from "@udus/notion-renderer/components";
import "@udus/notion-renderer/styles/globals.css";
import "katex/dist/katex.min.css";

interface EvaluationSettings {
    min_score: number;
    max_score: number;
    pass_score: number;
}

interface LearnerAssignmentViewProps {
    problemBlocks?: unknown[];
    title?: string;
    evaluationSettings?: EvaluationSettings;
    submissionType?: string;
    userId?: string;
    taskId?: string;
    isTestMode?: boolean;
    viewOnly?: boolean;
    className?: string;
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

    // Phase 1 fields
    project_score?: number;
    current_key_area?: string;
    key_area_question?: string;
    key_areas_remaining?: string[];

    // Phase 2 fields  
    key_area_score?: number;
    key_areas_completed?: string[];

    // Phase 3 fields
    key_area_scores?: Record<string, number>;
    final_score?: number;
    overall_feedback?: string;
}

export default function LearnerAssignmentView({
    problemBlocks: initialProblemBlocks = [],
    title: initialTitle,
    evaluationSettings: _ = { min_score: 0, max_score: 100, pass_score: 60 },
    submissionType: initialSubmissionType = "text",
    userId = "",
    taskId = "",
    isTestMode = true,
    viewOnly = false,
    className = "",
}: LearnerAssignmentViewProps) {
    // Left panel editor is read-only
    const isDarkMode = true;

    // Data fetching state
    const [isLoadingAssignment, setIsLoadingAssignment] = useState(true);
    const [hasFetchedData, setHasFetchedData] = useState(false);

    // Assignment data state
    const [problemBlocks, setProblemBlocks] = useState<unknown[]>(initialProblemBlocks);
    const [title, setTitle] = useState<string>(initialTitle || "");
    const [submissionType, setSubmissionType] = useState<string>(initialSubmissionType);

    // Right panel: chat + upload local state
    const [chatHistory, setChatHistory] = useState<ChatMessageLocal[]>([]);
    const [isAiResponding, setIsAiResponding] = useState(false);
    const [isChatHistoryLoaded, setIsChatHistoryLoaded] = useState(false);

    // NEW: Assignment evaluation state
    const [evaluationStatus, setEvaluationStatus] = useState<"in_progress" | "needs_resubmission" | "completed">("in_progress");

    // Scorecard state
    const [isViewingScorecard, setIsViewingScorecard] = useState(false);
    const [activeScorecard, setActiveScorecard] = useState<ScorecardItem[]>([]);

    // Input state for ChatView
    const [currentAnswer, setCurrentAnswer] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

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

                if (data) {
                    // Load problem blocks
                    if (data.blocks && Array.isArray(data.blocks)) {
                        setProblemBlocks(data.blocks);
                    }

                    // Load title
                    if (data.title) {
                        setTitle(data.title);
                    }

                    // Load submission type
                    if (data.input_type) {
                        setSubmissionType(data.input_type);
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

    // NEW: Handle assignment response based on evaluation status
    const handleAssignmentResponse = useCallback((response: AssignmentResponse) => {
        // Update evaluation status
        setEvaluationStatus(response.evaluation_status);
    }, []);

    // Helper function to convert key_area_scores to ScorecardItem format
    const convertKeyAreaScoresToScorecard = useCallback((keyAreaScores: Record<string, any>): ScorecardItem[] => {
        return Object.entries(keyAreaScores).map(([category, data]) => ({
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
            overall_feedback: aiResponse.overall_feedback,
            project_score: aiResponse.project_score,
            current_key_area: aiResponse.current_key_area,
            key_area_question: aiResponse.key_area_question,
            key_areas_remaining: aiResponse.key_areas_remaining,
            key_area_score: aiResponse.key_area_score,
            key_areas_completed: aiResponse.key_areas_completed,
            key_area_scores: aiResponse.key_area_scores,
            final_score: aiResponse.final_score
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

    // Audio helpers (mirroring LearnerQuizView)
    const resampleAudio = useCallback((audioBuffer: AudioBuffer, targetSampleRate: number = 8000) => {
        const sourceSampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const sourceLength = audioBuffer.length;

        const ratio = sourceSampleRate / targetSampleRate;
        const targetLength = Math.floor(sourceLength / ratio);

        const resampledBuffer = new AudioBuffer({
            length: targetLength,
            numberOfChannels: numChannels,
            sampleRate: targetSampleRate
        });

        for (let channel = 0; channel < numChannels; channel++) {
            const sourceChannel = audioBuffer.getChannelData(channel);
            const targetChannel = resampledBuffer.getChannelData(channel);

            for (let i = 0; i < targetLength; i++) {
                const sourceIndex = i * ratio;
                const sourceIndexFloor = Math.floor(sourceIndex);
                const sourceIndexCeil = Math.min(sourceIndexFloor + 1, sourceLength - 1);
                const fraction = sourceIndex - sourceIndexFloor;
                const sample = sourceChannel[sourceIndexFloor] * (1 - fraction) + sourceChannel[sourceIndexCeil] * fraction;
                targetChannel[i] = sample;
            }
        }

        return resampledBuffer;
    }, []);

    const writeString = useCallback((view: DataView, offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }, []);

    const convertAudioBufferToWav = useCallback((audioBuffer: AudioBuffer, targetSampleRate: number = 8000) => {
        const resampledBuffer = resampleAudio(audioBuffer, targetSampleRate);

        const numOfChan = resampledBuffer.numberOfChannels;
        const length = resampledBuffer.length * numOfChan * 2;
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);
        const sampleRate = targetSampleRate;
        const channels: Float32Array[] = [];

        for (let i = 0; i < numOfChan; i++) {
            channels.push(resampledBuffer.getChannelData(i));
        }

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numOfChan, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numOfChan * 2, true);
        view.setUint16(32, numOfChan * 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, length, true);

        const offset = 44;
        let pos = 0;
        for (let i = 0; i < resampledBuffer.length; i++) {
            for (let channel = 0; channel < numOfChan; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));
                const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset + pos, value, true);
                pos += 2;
            }
        }

        return buffer;
    }, [resampleAudio, writeString]);

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
                    }

                    return {
                        id: `${message.role}-${message.id}`,
                        content: displayContent,
                        sender: message.role === 'user' ? 'user' : 'ai',
                        timestamp: new Date(message.created_at),
                        messageType: (message.response_type as MessageType) || 'text',
                        audioData: audioData,
                        isError: false,
                        rawContent: rawContent
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
        settings: {},
    }), [title, submissionType]);

    // Helpers for ChatView handlers
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setCurrentAnswer(e.target.value);
    }, []);

    const pushUserMessage = useCallback((content: string, type: MessageType = "text") => {
        const userMsg: ChatMessageLocal = {
            id: `user-${Date.now()}`,
            content,
            sender: "user",
            timestamp: new Date(),
            messageType: type,
        };
        setChatHistory(prev => [...prev, userMsg]);
    }, []);

    const pushAiMessage = useCallback((content: string, extras?: Partial<ChatMessageLocal>) => {
        const aiMsg: ChatMessageLocal = {
            id: `ai-${Date.now()}`,
            content,
            sender: "ai",
            timestamp: new Date(),
            messageType: "text",
            ...extras,
        };
        setChatHistory(prev => [...prev, aiMsg]);
    }, []);

    const handleSubmitAnswer = useCallback(async () => {
        if (!currentAnswer.trim()) return;
        setIsSubmitting(true);
        setIsAiResponding(true);

        // Create user message for storing
        const userMessage: ChatMessageLocal = {
            id: `user-${Date.now()}`,
            content: currentAnswer,
            sender: "user",
            timestamp: new Date(),
            messageType: "text",
        };

        pushUserMessage(currentAnswer, "text");

        try {
            // Prepare the request body
            const requestBody = {
                user_response: currentAnswer,
                response_type: "text",
                task_id: taskId,
                user_id: userId,
                user_email: "user@example.com"
            };

            // Call the API for streaming response
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ai/assignment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            // Get the response reader for streaming
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to get response reader');
            }

            // Process streaming response
            let accumulatedResponse: AssignmentResponse = {
                feedback: "",
                evaluation_status: "in_progress",
            };
            let isFirstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const jsonLines = chunk.split('\n').filter(line => line.trim());

                for (const line of jsonLines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.feedback) {
                            accumulatedResponse = { ...accumulatedResponse, ...data };

                            if (isFirstChunk) {
                                setIsAiResponding(false);
                                pushAiMessage(accumulatedResponse.feedback);
                                isFirstChunk = false;
                            } else {
                                // Update the last AI message
                                setChatHistory(prev => {
                                    const newHistory = [...prev];
                                    const lastIndex = newHistory.length - 1;
                                    if (lastIndex >= 0 && newHistory[lastIndex].sender === 'ai') {
                                        newHistory[lastIndex] = { ...newHistory[lastIndex], content: accumulatedResponse.feedback };
                                    }
                                    return newHistory;
                                });
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing JSON chunk:', e);
                    }
                }
            }

            // Handle assignment response
            handleAssignmentResponse(accumulatedResponse);

            // Store chat history after getting complete response
            if (!isTestMode) {
                await storeChatHistory(userMessage, accumulatedResponse);
            }

        } catch (error) {
            console.error('Error fetching AI response:', error);
            pushAiMessage("There was an error while processing your answer. Please try again.");
        } finally {
            setIsSubmitting(false);
            setIsAiResponding(false);
            setCurrentAnswer("");
        }
    }, [currentAnswer, pushUserMessage, pushAiMessage, taskId, userId, isTestMode, storeChatHistory, handleAssignmentResponse]);

    const handleAudioSubmit = useCallback(async (audioBlob: Blob) => {
        try {
            setIsSubmitting(true);
            setIsAiResponding(true);

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
                try {
                    const base64Audio = reader.result as string;
                    const base64Data = base64Audio.split(',')[1];

                    // Create user message for storing
                    const userMessage: ChatMessageLocal = {
                        id: `user-${Date.now()}`,
                        content: '',
                        sender: 'user',
                        timestamp: new Date(),
                        messageType: 'audio',
                        audioData: base64Data,
                    };

                    // Push user audio message into chat for immediate feedback
                    setChatHistory(prev => [...prev, userMessage]);

                    // Upload audio: try presigned URL first
                    let presigned_url = '';
                    let file_uuid = '';

                    try {
                        const presignedUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/create`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content_type: 'audio/wav' })
                        });

                        if (!presignedUrlResponse.ok) {
                            throw new Error('Failed to get presigned URL');
                        }

                        const presignedData = await presignedUrlResponse.json();
                        presigned_url = presignedData.presigned_url;
                        file_uuid = presignedData.file_uuid;
                    } catch {
                        // continue with fallback
                    }

                    if (presigned_url) {
                        // Upload to S3
                        const uploadResponse = await fetch(presigned_url, {
                            method: 'PUT',
                            body: wavBlob,
                            headers: { 'Content-Type': 'audio/wav' }
                        });
                        if (!uploadResponse.ok) {
                            throw new Error(`Failed to upload audio to S3: ${uploadResponse.status}`);
                        }
                    } else {
                        // Fallback: upload directly to backend
                        const formData = new FormData();
                        formData.append('file', wavBlob, 'audio.wav');
                        formData.append('content_type', 'audio/wav');

                        const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/upload-local`, {
                            method: 'POST',
                            body: formData
                        });
                        if (!uploadResponse.ok) {
                            throw new Error(`Failed to upload audio to backend: ${uploadResponse.status}`);
                        }
                        const uploadData = await uploadResponse.json();
                        file_uuid = uploadData.file_uuid;
                    }

                    // Update user message content with file_uuid for storage
                    userMessage.content = file_uuid;

                    // Prepare request to assignment AI with audio
                    const requestBody = {
                        user_response: file_uuid,
                        response_type: 'audio',
                        task_id: taskId,
                        user_id: userId,
                        user_email: 'user@example.com'
                    };

                    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ai/assignment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }

                    const readerStream = response.body?.getReader();
                    if (!readerStream) {
                        throw new Error('Failed to get response reader');
                    }

                    let accumulatedResponse: AssignmentResponse = {
                        feedback: "",
                        evaluation_status: "in_progress",
                    };
                    let isFirstChunk = true;

                    while (true) {
                        const { done, value } = await readerStream.read();
                        if (done) break;

                        const chunk = new TextDecoder().decode(value);
                        const jsonLines = chunk.split('\n').filter(line => line.trim());

                        for (const line of jsonLines) {
                            try {
                                const data = JSON.parse(line);
                                if (data.feedback) {
                                    accumulatedResponse = { ...accumulatedResponse, ...data };

                                    if (isFirstChunk) {
                                        setIsAiResponding(false);
                                        pushAiMessage(accumulatedResponse.feedback);
                                        isFirstChunk = false;
                                    } else {
                                        // Update the last AI message
                                        setChatHistory(prev => {
                                            const newHistory = [...prev];
                                            const lastIndex = newHistory.length - 1;
                                            if (lastIndex >= 0 && newHistory[lastIndex].sender === 'ai') {
                                                newHistory[lastIndex] = { ...newHistory[lastIndex], content: accumulatedResponse.feedback };
                                            }
                                            return newHistory;
                                        });
                                    }
                                }
                            } catch (err) {
                                console.error('Error parsing JSON chunk:', err);
                            }
                        }
                    }

                    // Handle assignment response
                    handleAssignmentResponse(accumulatedResponse);

                    // Store chat history after getting complete response
                    if (!isTestMode) {
                        await storeChatHistory(userMessage, accumulatedResponse);
                    }

                } catch (err) {
                    console.error('Error during audio submission:', err);
                    pushAiMessage('There was an error while processing your audio. Please try again.');
                } finally {
                    setIsSubmitting(false);
                    setIsAiResponding(false);
                }
            };
        } catch (error) {
            console.error('Error processing audio submission:', error);
            setIsSubmitting(false);
            setIsAiResponding(false);
        }
    }, [pushAiMessage, taskId, userId, convertAudioBufferToWav, isTestMode, storeChatHistory, handleAssignmentResponse]);

    const handleViewScorecard = useCallback((scorecard: ScorecardItem[]) => {
        setActiveScorecard(scorecard);
        setIsViewingScorecard(true);
    }, []);

    const handleBackToChat = useCallback(() => {
        setIsViewingScorecard(false);
    }, []);

    const onZipUploaded = async (file: File) => {
        if (viewOnly) return;

        // Create user message for storing
        const userMessage: ChatMessageLocal = {
            id: `user-${Date.now()}`,
            content: `Uploaded ${file.name}`,
            sender: 'user',
            timestamp: new Date(),
            messageType: 'text',
        };

        pushUserMessage(`Uploaded ${file.name}`);

        setIsAiResponding(true);

        try {
            // Upload the file first
            const formData = new FormData();
            formData.append('file', file);
            formData.append('content_type', 'application/zip');

            const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/upload-local`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload file: ${uploadResponse.status}`);
            }

            const uploadData = await uploadResponse.json();
            const fileUuid = uploadData.file_uuid;

            // Update user message content with file_uuid for storage
            userMessage.content = fileUuid;
            userMessage.messageType = 'file';

            // Now process the uploaded file using the new assignment endpoint
            const requestBody = {
                user_response: fileUuid,
                response_type: "file",
                task_type: "assignment",
                task_id: taskId,
                user_id: userId,
                user_email: ""
            };

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ai/assignment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            // Process streaming response
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to get response reader');
            }

            let accumulatedResponse: AssignmentResponse = {
                feedback: "",
                evaluation_status: "in_progress",
            };
            let isFirstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const jsonLines = chunk.split('\n').filter(line => line.trim());

                for (const line of jsonLines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.feedback) {
                            accumulatedResponse = { ...accumulatedResponse, ...data };

                            if (isFirstChunk) {
                                setIsAiResponding(false);
                                pushAiMessage(accumulatedResponse.feedback);
                                isFirstChunk = false;
                            } else {
                                // Update the last AI message
                                setChatHistory(prev => {
                                    const newHistory = [...prev];
                                    const lastIndex = newHistory.length - 1;
                                    if (lastIndex >= 0 && newHistory[lastIndex].sender === 'ai') {
                                        newHistory[lastIndex] = { ...newHistory[lastIndex], content: accumulatedResponse.feedback };
                                    }
                                    return newHistory;
                                });
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing JSON chunk:', e);
                    }
                }
            }

            // Handle assignment response
            handleAssignmentResponse(accumulatedResponse);

            // Store chat history after getting complete response
            if (!isTestMode) {
                await storeChatHistory(userMessage, accumulatedResponse);
            }

        } catch (error) {
            console.error('Error processing file upload:', error);
            pushAiMessage("There was an error while processing your file. Please try again.");
        } finally {
            setIsAiResponding(false);
        }
    };

    // Check if assignment is completed based on evaluation status or last AI message
    const isCompleted = useMemo(() => {
        // First check evaluation status
        if (evaluationStatus === "completed") {
            return true;
        }

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
            return parsedContent.evaluation_status === "completed";
        } catch (error) {
            // If parsing fails, check if content contains "completed" status
            return (lastAiMessage.rawContent || lastAiMessage.content).includes('"evaluation_status":"completed"');
        }
    }, [evaluationStatus, chatHistory]);

    // Auto-show scorecard when assignment is completed
    useEffect(() => {
        if (isCompleted && chatHistory.length > 0) {
            // Find the last AI message
            const lastAiMessage = [...chatHistory].reverse().find(msg => msg.sender === 'ai');
            if (lastAiMessage) {
                try {
                    const parsedContent = JSON.parse(lastAiMessage.rawContent || lastAiMessage.content);
                    if (parsedContent.key_area_scores) {
                        const scorecard = convertKeyAreaScoresToScorecard(parsedContent.key_area_scores);
                        if (scorecard.length > 0) {
                            setActiveScorecard(scorecard);
                            setIsViewingScorecard(true);
                        }
                    }
                } catch (error) {
                    console.log('Failed to parse AI message for scorecard:', error);
                }
            }
        }
    }, [isCompleted, chatHistory, convertKeyAreaScoresToScorecard]);

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

    // Show loading state while fetching assignment data
    if (isLoadingAssignment) {
        return (
            <div className={`w-full h-full flex items-center justify-center ${className}`}>
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                    <div className="text-white text-lg">Loading assignment...</div>
                </div>
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

                /* Make sure the question and chat containers properly fit their content */
                @media (max-width: 1024px) {
                    .assignment-view-container {
                        height: 100% !important;
                        max-height: 100% !important;
                        overflow: hidden !important;
                        display: grid !important;
                        grid-template-rows: 50% 50% !important;
                        grid-template-columns: 1fr !important;
                    }
                    
                    .assignment-container {
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
                    .chat-container {
                        flex: 1 !important;
                        overflow-y: auto !important;
                        min-height: 0 !important;
                    }
                    
                    /* Ensure the input area stays at the bottom and doesn't scroll */
                    .chat-container {
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
                    .assignment-container,
                    .assignment-container {
                        max-height: calc(100% - 80px) !important;
                        overflow: auto !important;
                    }
                }
            `}</style>
            <div className="two-column-grid rounded-md overflow-hidden bg-[#111111] assignment-view-container">
                {/* Left: Problem Statement */}
                <div className="p-6 border-r border-[#222222] flex flex-col bg-[#1A1A1A] assignment-container" style={{ overflow: 'auto' }}>
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
                        <div className="ml-[-60px]">
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
                                currentChatHistory={chatHistory as unknown as ChatMessage[]}
                                isAiResponding={isAiResponding}
                                showPreparingReport={false}
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
                                onZipUploaded={onZipUploaded}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}