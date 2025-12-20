"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { Plus, FileText, Trash2, Check, HelpCircle, Pen, ClipboardCheck, BookOpen, Code, Sparkles, Tag } from "lucide-react";

// Add custom styles for dark mode
import "./editor-styles.css";

// Import the BlockNoteEditor component
import BlockNoteEditor from "./BlockNoteEditor";
// Import the LearnerQuizView component
import LearnerQuizView from "./LearnerQuizView";
import ConfirmationDialog from "./ConfirmationDialog";
// Import the new Dropdown component
import Dropdown, { DropdownOption } from "./Dropdown";
// Import the ScorecardPickerDialog component for types
import { CriterionData, ScorecardTemplate } from "./ScorecardPickerDialog";
// Import the ScorecardManager component
import ScorecardManager, { ScorecardManagerHandle } from "./ScorecardManager";
// Import dropdown options
import { questionTypeOptions, answerTypeOptions, codingLanguageOptions, questionPurposeOptions, copyPasteControlOptions } from "./dropdownOptions";
// Import quiz types
import { QuizEditorHandle, QuizQuestionConfig, QuizQuestion, QuizEditorProps, APIQuestionResponse, ScorecardCriterion } from "../types";
import { extractTextFromBlocks, hasBlocksContent } from "@/lib/utils/blockUtils";
// Add import for KnowledgeBaseEditor
import KnowledgeBaseEditor from "./KnowledgeBaseEditor";
// Import Toast component
import Toast from "./Toast";
// Import the PublishConfirmationDialog component
import PublishConfirmationDialog from './PublishConfirmationDialog';
// Import the useAuth hook
import { useAuth } from "@/lib/auth";
// Import scorecard validation utility
import { validateScorecardCriteria as validateScorecardCriteriaUtil, ValidationCallbacks } from "@/lib/utils/scorecardValidation";

// Add import for NotionIntegration
import NotionIntegration from "./NotionIntegration";

// Add imports for Notion rendering
import { BlockList, RenderConfig } from "@udus/notion-renderer/components";
import "@udus/notion-renderer/styles/globals.css";
import "katex/dist/katex.min.css";

// Add import for shared Integration utilities
import {
    handleIntegrationPageSelection,
    handleIntegrationPageRemoval,
} from "@/lib/utils/integrationUtils";

import { updateTaskAndQuestionIdInUrl } from "@/lib/utils/urlUtils";
import { useRouter } from "next/navigation";
import { useThemePreference } from "@/lib/hooks/useThemePreference";

// Default configuration for new questions
const defaultQuestionConfig: QuizQuestionConfig = {
    inputType: 'text',
    responseType: 'chat',
    questionType: 'objective',
    knowledgeBaseBlocks: [],
    linkedMaterialIds: [],
    title: '',
    settings: {},
};

// Helper function to extract text from all blocks in a BlockNote document

/**
 * Extracts and formats knowledge base content for API calls.
 * Validates that blocks contain actual content, not just empty structures.
 * 
 * @param {QuizQuestionConfig} config - The question configuration containing knowledge base data
 * @returns {Object|null} - Formatted knowledge base data for API or null if no valid content
 */
export const getKnowledgeBaseContent = (config: QuizQuestionConfig) => {
    // Check for knowledgeBaseBlocks
    const knowledgeBaseBlocks = config.knowledgeBaseBlocks || [];
    const linkedMaterialIds = config.linkedMaterialIds || [];

    // Extract text from blocks to check if they contain actual content
    const hasNonEmptyBlocks = knowledgeBaseBlocks.length > 0 &&
        extractTextFromBlocks(knowledgeBaseBlocks).trim().length > 0;

    // Check if there are any linked materials
    const hasLinkedMaterials = linkedMaterialIds.length > 0;

    // If we have either valid blocks or linked materials, return the knowledge base data
    if (hasNonEmptyBlocks || hasLinkedMaterials) {
        return {
            blocks: hasNonEmptyBlocks ? knowledgeBaseBlocks : [],
            linkedMaterialIds: hasLinkedMaterials ? linkedMaterialIds : []
        };
    }

    // If no valid knowledge base content, return null
    return null;
};

/**
 * Sanitizes question data from the backend by removing position properties.
 * The backend includes position properties in blocks, but the frontend editor doesn't use them.
 * This ensures clean comparison between original and edited data.
 */
const sanitizeQuestionDataFromBackend = (questions: QuizQuestion[]): QuizQuestion[] => {
    return questions.map(question => {
        // Sanitize content blocks
        const sanitizedContent = question.content.map((block: any) => {
            const { position, ...blockWithoutPosition } = block;
            return blockWithoutPosition;
        });

        // Sanitize correctAnswer blocks if they exist
        let sanitizedCorrectAnswer = question.config.correctAnswer;
        if (sanitizedCorrectAnswer && Array.isArray(sanitizedCorrectAnswer)) {
            sanitizedCorrectAnswer = sanitizedCorrectAnswer.map((block: any) => {
                const { position, ...blockWithoutPosition } = block;
                return blockWithoutPosition;
            });
        }

        // Return sanitized question
        return {
            ...question,
            content: sanitizedContent,
            config: {
                ...question.config,
                correctAnswer: sanitizedCorrectAnswer
            }
        };
    });
};

const QuizEditor = forwardRef<QuizEditorHandle, QuizEditorProps>(({
    initialQuestions = [], // Not used anymore - kept for backward compatibility
    onChange,
    className = "",
    isPreviewMode = false,
    readOnly = false,
    taskId,
    status = 'draft',
    onPublishSuccess,
    showPublishConfirmation = false,
    onPublishCancel,
    showUnpublishConfirmation = false,
    setShowUnpublishConfirmation,
    onUnPublishSuccess,
    isEditMode = false,
    onSaveSuccess,
    taskType = 'quiz',
    currentQuestionId,
    onQuestionChange,
    onSubmitAnswer,
    schoolId, // Add schoolId prop to access school scorecards
    onValidationError,
    courseId,
    scheduledPublishAt = null,
    onQuestionChangeWithUnsavedScorecardChanges,
}, ref) => {
    const { isDarkMode } = useThemePreference();
    // Get authenticated user ID
    const { user } = useAuth();
    const router = useRouter();
    // For published quizzes: data is always fetched from the API
    // For draft quizzes: always start with empty questions
    // initialQuestions prop is no longer used

    // Initialize questions state - always start with empty array
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    // Store the original data for cancel functionality
    const originalQuestionsRef = useRef<QuizQuestion[]>([]);
    // Add a ref to store the original title
    const originalTitleRef = useRef<string>("");

    // Add ref to store pending action when unsaved scorecard changes are detected
    const pendingScorecardActionRef = useRef<(() => void) | null>(null);

    // Add loading state for fetching questions
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
    // Track if data has been fetched to prevent infinite loops
    const [hasFetchedData, setHasFetchedData] = useState(false);

    // Add state for school scorecards
    const [schoolScorecards, setSchoolScorecards] = useState<ScorecardTemplate[]>([]);
    // Add loading state for fetching scorecards
    const [isLoadingScorecards, setIsLoadingScorecards] = useState(false);

    // Add state to track original scorecard data for change detection
    const [originalScorecardData, setOriginalScorecardData] = useState<Map<string, { name: string, criteria: CriterionData[] }>>(new Map());
    // Add ref to track if we're currently saving a scorecard
    const isSavingScorecardRef = useRef(false);

    // Add toast state
    const [showToast, setShowToast] = useState(false);
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");
    const [toastEmoji, setToastEmoji] = useState("🚀");

    // Add integration state variables
    const [integrationBlocks, setIntegrationBlocks] = useState<any[]>([]);
    const [isLoadingIntegration, setIsLoadingIntegration] = useState(false);
    const [integrationError, setIntegrationError] = useState<string | null>(null);

    // Add useEffect to automatically hide toast after 5 seconds
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => {
                setShowToast(false);
            }, 5000);

            // Cleanup the timer when component unmounts or showToast changes
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // Make sure we reset questions when component mounts for draft quizzes
    // useEffect(() => {
    //     if (status === 'draft') {
    //         setQuestions([]);
    //     }
    // }, [status]);

    // Fetch school scorecards when component mounts for draft quizzes
    useEffect(() => {
        const fetchSchoolScorecards = async () => {
            if (schoolId) {
                setIsLoadingScorecards(true);
                try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/scorecards/?org_id=${schoolId}`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch school scorecards');
                    }

                    const data = await response.json();

                    // Transform the API response to ScorecardTemplate format
                    if (data && Array.isArray(data)) {
                        const transformedScorecards = data.map(scorecard => ({
                            id: scorecard.id,
                            name: scorecard.title,
                            icon: <FileText size={16} className="text-white" />,
                            is_template: false, // Not a hard-coded template
                            new: scorecard.status === 'draft', // Not newly created in this session
                            criteria: scorecard.criteria.map((criterion: ScorecardCriterion) => ({
                                name: criterion.name,
                                description: criterion.description,
                                maxScore: criterion.max_score,
                                minScore: criterion.min_score,
                                passScore: criterion.pass_score
                            })) || []
                        }));

                        setSchoolScorecards(transformedScorecards);

                        // Now that we have the scorecards, fetch the questions
                        await fetchQuestions(transformedScorecards);
                    } else {
                        // If no scorecard data, fetch questions with empty scorecards
                        await fetchQuestions();
                    }
                } catch (error) {
                    console.error('Error fetching school scorecards:', error);
                } finally {
                    setIsLoadingScorecards(false);
                }
            } else {
                // If no schoolId, just fetch questions with empty scorecards
                await fetchQuestions();
            }
        };

        // Define the fetchQuestions function that takes scorecards as a parameter
        const fetchQuestions = async (availableScorecards: ScorecardTemplate[] = []) => {
            // Only fetch if we have a taskId, the status is published, and we haven't already fetched
            if (taskId && !hasFetchedData) {
                try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch task details');
                    }

                    const data = await response.json();

                    // Update the questions with the fetched data
                    if (data && data.questions && data.questions.length > 0) {
                        // If no currentQuestionId specified, push first question id to URL
                        if (!currentQuestionId && taskId) {
                            try {
                                // Replace current history entry to avoid adding an extra entry when updating URL next
                                if (typeof window !== 'undefined') {
                                    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
                                }
                                updateTaskAndQuestionIdInUrl(router, String(taskId), String(data.questions[0].id));
                            } catch {
                                // noop
                            }
                        }

                        const updatedQuestions = data.questions.map((question: APIQuestionResponse) => {
                            // Map API question type to local questionType
                            const questionType = question.type;

                            // Use answer blocks directly from the API if available,
                            // otherwise create a default paragraph block
                            const correctAnswer = (question.answer ? question.answer : [
                                {
                                    type: "paragraph",
                                    content: [
                                        {
                                            type: "text",
                                            text: question.answer || "",
                                            styles: {}
                                        }
                                    ]
                                }
                            ]);

                            // Handle scorecard data if scorecard_id is present
                            let scorecardData = undefined;
                            if (question.scorecard_id && availableScorecards.length > 0) {
                                // Find matching scorecard from school scorecards
                                const matchingScorecard = availableScorecards.find(sc => parseInt(sc.id) === question.scorecard_id);

                                if (matchingScorecard) {
                                    scorecardData = {
                                        id: matchingScorecard.id,
                                        name: matchingScorecard.name,
                                        new: matchingScorecard.new,
                                        criteria: matchingScorecard.criteria.map(criterion => ({
                                            ...criterion,
                                            minScore: criterion.minScore
                                        })),
                                    };
                                }
                            }

                            // Extract knowledgeBaseBlocks and linkedMaterialIds from context if it exists
                            let knowledgeBaseBlocks: any[] = [];
                            let linkedMaterialIds: string[] = [];

                            if (question.context) {
                                // Extract blocks for knowledge base if they exist
                                if (question.context.blocks && Array.isArray(question.context.blocks)) {
                                    knowledgeBaseBlocks = question.context.blocks;
                                }

                                // Extract linkedMaterialIds if they exist
                                if (question.context.linkedMaterialIds && Array.isArray(question.context.linkedMaterialIds)) {
                                    linkedMaterialIds = question.context.linkedMaterialIds;
                                }
                            }

                            const settings = { allowCopyPaste: true };
                            if (question.settings) {
                                settings.allowCopyPaste = question.settings.allowCopyPaste;
                            }

                            return {
                                id: String(question.id),
                                content: question.blocks || [],
                                config: {
                                    inputType: question.input_type || 'text' as 'text' | 'code' | 'audio',
                                    responseType: question.response_type,
                                    correctAnswer: correctAnswer,
                                    questionType: questionType as 'objective' | 'subjective',
                                    scorecardData: scorecardData,
                                    knowledgeBaseBlocks: knowledgeBaseBlocks,
                                    linkedMaterialIds: linkedMaterialIds,
                                    codingLanguages: question.coding_languages || [],
                                    title: question.title,
                                    settings: settings
                                }
                            };
                        });

                        // Update questions state
                        setQuestions(updatedQuestions);

                        // Store original scorecard data for change detection
                        const originalData = new Map<string, { name: string, criteria: CriterionData[] }>();
                        updatedQuestions.forEach((question: QuizQuestion) => {
                            if (question.config.scorecardData) {
                                // Store original data for all scorecards fetched from API (including draft ones)
                                const scorecardId = question.config.scorecardData.id;
                                if (!originalData.has(scorecardId)) {
                                    originalData.set(scorecardId, {
                                        name: question.config.scorecardData.name,
                                        criteria: JSON.parse(JSON.stringify(question.config.scorecardData.criteria))
                                    });
                                }
                            }
                        });
                        setOriginalScorecardData(originalData);

                        // Notify parent component about the update, but only once and after our state is updated
                        if (onChange) {
                            // Use setTimeout to break the current render cycle
                            setTimeout(() => {
                                onChange(updatedQuestions);
                            }, 0);
                        }

                        // Store the original data for cancel operation (sanitized)
                        const sanitizedQuestions = sanitizeQuestionDataFromBackend(updatedQuestions);
                        originalQuestionsRef.current = JSON.parse(JSON.stringify(sanitizedQuestions));
                    }

                    // Mark that we've fetched the data - do this regardless of whether questions were found
                    setHasFetchedData(true);
                } catch (error) {
                    console.error('Error fetching quiz questions:', error);
                    // Even on error, mark as fetched to prevent infinite retry loops
                    setHasFetchedData(true);
                } finally {
                    setIsLoadingQuestions(false);
                }
            } else {
                setIsLoadingQuestions(false);
            }
        };

        fetchSchoolScorecards();
    }, [taskId, status]);

    // Reset hasFetchedData when taskId changes
    useEffect(() => {
        setHasFetchedData(false);
    }, [taskId]);

    // Cleanup effect - clear questions when component unmounts or taskId changes
    useEffect(() => {
        // Return cleanup function
        return () => {
            // Clear questions state and refs when component unmounts
            setQuestions([]);
            originalQuestionsRef.current = [];
        };
    }, [taskId]);

    // Store the original title when it changes in the dialog (for cancel operation)
    useEffect(() => {
        const dialogTitleElement = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
        if (dialogTitleElement) {
            originalTitleRef.current = dialogTitleElement.textContent || "";
        }
    }, []);

    // Current question index
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    // Internal state to track the current question ID for preview mode
    const [activeQuestionId, setActiveQuestionId] = useState<string | undefined>(() => {
        // Initialize with currentQuestionId if provided, otherwise use first question id if questions exist
        if (currentQuestionId) {
            return currentQuestionId;
        }
        return questions.length > 0 ? questions[0]?.id : undefined;
    });

    // Update current question index when currentQuestionId changes
    useEffect(() => {
        if (currentQuestionId && questions.length > 0) {
            const index = questions.findIndex(q => q.id === currentQuestionId);
            if (index !== -1) {
                setCurrentQuestionIndex(index);
            }
        }
    }, [currentQuestionId, questions]);

    // Update activeQuestionId when currentQuestionIndex changes in preview mode
    useEffect(() => {
        if (questions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
            const newActiveId = questions[currentQuestionIndex].id;
            setActiveQuestionId(newActiveId);
        }
    }, [currentQuestionIndex, questions]);

    // State to track if a new question was just added (for animation)
    const [newQuestionAdded, setNewQuestionAdded] = useState(false);

    // State for delete confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // State for tracking publishing status
    const [isPublishing, setIsPublishing] = useState(false);
    const [isUnpublishing, setIsUnpublishing] = useState(false);

    // State for tracking publishing errors
    const [errorMessage, setErrorMessage] = useState<string | null>(null); // Using the same state for both publish and unpublish error messages since only one of the actions can be performed at once

    // Reference to the current BlockNote editor instance
    const editorRef = useRef<any>(null);

    // Use ref to track the last edit to prevent unnecessary updates
    const lastContentUpdateRef = useRef<string>("");

    // Reference to the correct answer editor
    const correctAnswerEditorRef = useRef<any>(null);

    // Reference to the scorecard manager component
    const scorecardManagerRef = useRef<ScorecardManagerHandle>(null);

    // State for tracking active tab (question or answer)
    const [activeEditorTab, setActiveEditorTab] = useState<'question' | 'answer' | 'scorecard' | 'knowledge'>('question');

    // State to track which field is being highlighted for validation errors
    const [highlightedField, setHighlightedField] = useState<'question' | 'answer' | 'codingLanguage' | 'title' | null>(null);

    // State to track if the question count should be highlighted (after adding a new question)
    const [questionCountHighlighted, setQuestionCountHighlighted] = useState(false);

    // Add validation utility functions to reduce duplication
    // These functions can validate both the current question and any question by index

    /**
     * Highlights a field (question or answer) to draw attention to a validation error
     * @param field The field to highlight
     */
    const highlightField = useCallback((field: 'question' | 'answer' | 'codingLanguage' | 'title') => {
        // Set the highlighted field
        setHighlightedField(field);

        // Clear the highlight after 4 seconds
        setTimeout(() => {
            setHighlightedField(null);
        }, 4000);
    }, []);

    /**
     * Validates if question content is non-empty
     * @param content The content blocks to validate
     * @returns True if content has non-empty text or contains media blocks, false otherwise
     */
    const validateQuestionContent = useCallback((content: any[]) => hasBlocksContent(content), []);

    /**
     * Validates if a question has a non-empty correct answer
     * @param questionConfig The question configuration containing the answer
     * @returns True if correct answer exists and is non-empty, false otherwise
     */
    const validateCorrectAnswer = useCallback((questionConfig: QuizQuestionConfig) => {
        if (questionConfig.correctAnswer && questionConfig.correctAnswer.length > 0) {
            const textContent = extractTextFromBlocks(questionConfig.correctAnswer);
            return textContent.trim().length > 0;
        }
        return false;
    }, []);

    /**
     * Validates if a question has a valid scorecard attached
     * @param questionConfig The question configuration containing the scorecard data
     * @returns True if a valid scorecard with criteria exists, false otherwise
     */
    const validateScorecard = useCallback((questionConfig: QuizQuestionConfig) => {
        return !!(questionConfig.scorecardData &&
            questionConfig.scorecardData.criteria &&
            questionConfig.scorecardData.criteria.length > 0);
    }, []);


    /**
     * Validates all questions in the quiz and navigates to the first invalid question
     * @returns True if all questions are valid, false otherwise
     */
    const validateAllQuestions = useCallback(() => {
        // Check if there are any questions
        if (questions.length === 0) {
            if (onValidationError) {
                onValidationError(
                    "No questions",
                    "Please add at least one question before publishing"
                );
            }
            return false;
        }

        // Validate all questions
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];

            // Check if question title is missing or empty
            if (!question.config.title || question.config.title.trim() === '') {
                // Navigate to the question with missing title
                setCurrentQuestionIndex(i);
                setActiveEditorTab('question');
                highlightField('title');
                updateCurrentQuestionId(question.id);

                // Notify parent about validation error
                if (onValidationError) {
                    onValidationError(
                        "Empty title",
                        `Question ${i + 1} has no title. Please add a title to the question`
                    );
                }
                return false;
            }

            // Check if question has content
            if (!validateQuestionContent(question.content)) {
                // Navigate to the question with missing content
                setCurrentQuestionIndex(i);
                setActiveEditorTab('question');

                // Highlight the question field
                highlightField('question');
                updateCurrentQuestionId(question.id);

                // Notify parent about validation error
                if (onValidationError) {
                    onValidationError(
                        "Empty question",
                        `Question ${i + 1} is empty. Please add details to the question`
                    );
                }
                return false;
            }


            // For coding questions, check if coding languages are set
            if (question.config.inputType === 'code') {
                if (!question.config.codingLanguages || !Array.isArray(question.config.codingLanguages) || question.config.codingLanguages.length === 0) {
                    // Navigate to the question with missing coding languages
                    setCurrentQuestionIndex(i);

                    // Highlight the coding language field
                    highlightField('codingLanguage');
                    updateCurrentQuestionId(question.id);
                    // Notify parent about validation error
                    if (onValidationError) {
                        onValidationError(
                            "Missing coding languages",
                            `Question ${i + 1} does not have any programming language selected`
                        );
                    }
                    return false;
                } else {
                    console.log("question.config.codingLanguages is not empty");
                }
            }

            // For objective questions, check if correct answer is set
            if (question.config.questionType === 'objective') {
                if (!validateCorrectAnswer(question.config)) {
                    // Navigate to the question with missing answer
                    setCurrentQuestionIndex(i);
                    setActiveEditorTab('answer');

                    // Highlight the answer field
                    highlightField('answer');
                    updateCurrentQuestionId(question.id);

                    // Notify parent about validation error
                    if (onValidationError) {
                        onValidationError(
                            "Empty correct answer",
                            `Question ${i + 1} has no correct answer. Please add a correct answer`
                        );
                    }
                    return false;
                }
            }

            // For subjective questions, check if scorecard is set
            if (question.config.questionType === 'subjective') {
                if (!validateScorecard(question.config)) {
                    // Navigate to the question with missing scorecard
                    setCurrentQuestionIndex(i);
                    setActiveEditorTab('scorecard');

                    updateCurrentQuestionId(question.id);

                    // Notify parent about validation error
                    if (onValidationError) {
                        onValidationError(
                            "Missing scorecard",
                            `Question ${i + 1} has no scorecard. Please add a scorecard for evaluating the answer`
                        );
                    }
                    return false;
                }

                // Check for empty criterion names or descriptions in the scorecard
                if (question.config.scorecardData) {
                    // Navigate to the question with the problematic scorecard first
                    setCurrentQuestionIndex(i);
                    updateCurrentQuestionId(question.id);
                    
                    // Use the shared validation function for scorecards
                    const isValid = validateScorecardCriteriaUtil(
                        question.config.scorecardData,
                        {
                            setActiveTab: setActiveEditorTab,
                            showErrorMessage: onValidationError,
                            questionIndex: i
                        }
                    );

                    if (!isValid) {
                        return false;
                    }
                }
            }
        }

        return true;
    }, [questions, onValidationError, validateQuestionContent, validateCorrectAnswer, validateScorecard, setCurrentQuestionIndex, setActiveEditorTab, highlightField]);


    // Function to set the editor reference
    const setEditorInstance = useCallback((editor: any) => {
        editorRef.current = editor;
    }, []);

    // Memoize the current question content and config to prevent unnecessary re-renders
    const currentQuestion = useMemo(() =>
        questions[currentQuestionIndex] || { content: [], config: defaultQuestionConfig },
        [questions, currentQuestionIndex]);

    const currentQuestionContent = useMemo(() =>
        currentQuestion.content || [],
        [currentQuestion]);

    const currentQuestionConfig = useMemo(() =>
        currentQuestion.config || defaultQuestionConfig,
        [currentQuestion]);

    // Function to set the correct answer editor reference
    const setCorrectAnswerEditorInstance = useCallback((editor: any) => {
        correctAnswerEditorRef.current = editor;
    }, []);

    // Handle content change for the current question - use useCallback to memoize
    const handleQuestionContentChange = useCallback((content: any[]) => {
        if (questions.length === 0) return;

        // Clear highlight and toast immediately when user starts editing
        if (highlightedField === 'question') {
            setHighlightedField(null);
        }

        // Simply update the content without all the complexity
        const updatedQuestions = [...questions];
        updatedQuestions[currentQuestionIndex] = {
            ...updatedQuestions[currentQuestionIndex],
            content
        };

        // Update state
        setQuestions(updatedQuestions);

        // Call onChange callback if provided
        if (onChange) {
            onChange(updatedQuestions);
        }
    }, [questions, currentQuestionIndex, onChange, highlightedField]);

    // Integration logic for questions
    const currentIntegrationType = 'notion';
    const integrationBlock = currentQuestionContent.find(block => block.type === currentIntegrationType);
    
    const initialContent = integrationBlock ? undefined : currentQuestionContent;

    // Handle integration blocks and editor instance clearing
    useEffect(() => {
        if (currentQuestionContent.length > 0) {
            if (integrationBlock && integrationBlock.content && integrationBlock.content.length > 0) {
                setIntegrationBlocks(integrationBlock.content);
            } else {
                setIntegrationBlocks([]);
            }
        }

        // Ensure editor instance is updated when content is cleared
        if (editorRef.current && currentQuestionContent.length === 0) {
            try {
                if (editorRef.current.replaceBlocks) {
                    editorRef.current.replaceBlocks(editorRef.current.document, []);
                } else if (editorRef.current.setContent) {
                    editorRef.current.setContent([]);
                }
            } catch (error) {
                console.error('Error clearing editor content:', error);
            }
        }
    }, [currentQuestionContent]);

    // Handle Integration page selection
    const handleIntegrationPageSelect = async (pageId: string, pageTitle: string) => {
        if (!user?.id) {
            console.error('User ID not provided');
            return;
        }

        setIsLoadingIntegration(true);
        setIntegrationError(null);

        try {
            return await handleIntegrationPageSelection(
                pageId,
                pageTitle,
                user.id,
                'notion',
                (content) => {
                    handleQuestionContentChange(content);
                },
                setIntegrationBlocks,
                (error) => {
                    setIntegrationError(error);
                }
            );
        } catch (error) {
            console.error('Error handling Integration page selection:', error);
        } finally {
            setIsLoadingIntegration(false);
        }
    };

    // Handle Integration page removal
    const handleIntegrationPageRemove = () => {
        setIntegrationError(null);

        handleIntegrationPageRemoval(
            (content) => {
                handleQuestionContentChange(content);
                setIntegrationBlocks([]);
            },
            setIntegrationBlocks
        );
    };

    // Handle correct answer content change
    const handleCorrectAnswerChange = useCallback((content: any[]) => {
        if (questions.length === 0) return;

        // Clear highlight and toast immediately when user starts editing
        if (highlightedField === 'answer') {
            setHighlightedField(null);
        }

        // Store blocks but don't extract text on every change
        const updatedQuestions = [...questions];
        updatedQuestions[currentQuestionIndex] = {
            ...updatedQuestions[currentQuestionIndex],
            config: {
                ...updatedQuestions[currentQuestionIndex].config,
                correctAnswer: content
            }
        };
        setQuestions(updatedQuestions);

        if (onChange) {
            onChange(updatedQuestions);
        }
    }, [questions, currentQuestionIndex, onChange, highlightedField]);

    // Handle configuration change for the current question
    const handleConfigChange = useCallback((configUpdate: Partial<QuizQuestionConfig>, options?: { updateTemplate?: boolean, newQuestionType?: 'objective' | 'subjective', newInputType?: 'text' | 'code' | 'audio' }) => {
        if (questions.length === 0) return;

        const updatedQuestions = [...questions];
        updatedQuestions[currentQuestionIndex] = {
            ...updatedQuestions[currentQuestionIndex],
            config: {
                ...updatedQuestions[currentQuestionIndex].config,
                ...configUpdate
            }
        };

        // If updateTemplate flag is true and we have a newQuestionType, update the template content
        if (options?.updateTemplate && options.newQuestionType && options.newInputType && status === 'draft') {
            const currentContent = updatedQuestions[currentQuestionIndex].content || [];

            // Check if any block has an ID (indicating user modification)
            const hasUserModifiedContent = currentContent.some(block => 'id' in block);

            if (!hasUserModifiedContent) {
                updatedQuestions[currentQuestionIndex].content = [];
            }
        }

        setQuestions(updatedQuestions);

        if (onChange) {
            onChange(updatedQuestions);
        }
    }, [questions, currentQuestionIndex, onChange, status]);



    // Add a new question
    const addQuestion = useCallback(() => {
        if (checkUnsavedScorecardChanges()) {
            // Store the add question action as pending
            pendingScorecardActionRef.current = () => {
                // Execute the add question logic without checking for unsaved changes
                executeAddQuestion();
            };

            if (onQuestionChangeWithUnsavedScorecardChanges) {
                onQuestionChangeWithUnsavedScorecardChanges();
            }
            return;
        }

        executeAddQuestion();
    }, [questions, onChange]);

    const updateCurrentQuestionId = (questionId: string) => {
        if (onQuestionChange) {
            onQuestionChange(questionId);
        }
    };

    // Extract the actual add question logic to a separate function
    const executeAddQuestion = useCallback(() => {
        // Get the previous question's configuration if available
        // Otherwise, use default values
        let questionType = 'objective';
        let inputType: 'text' | 'code' | 'audio' = 'text';
        let codingLanguages: string[] = [];
        let responseType: 'chat' | 'exam' = 'chat';
        let settings: { allowCopyPaste?: boolean } = { allowCopyPaste: true };
        // If there's at least one question (to be used as a reference)
        if (questions.length > 0) {
            const previousQuestion = questions[questions.length - 1];
            if (previousQuestion && previousQuestion.config) {
                // Use the previous question's type
                questionType = previousQuestion.config.questionType;
                // Use the previous question's input type (answer type)
                inputType = previousQuestion.config.inputType;
                // Use the previous question's coding languages if available
                if (previousQuestion.config.codingLanguages &&
                    Array.isArray(previousQuestion.config.codingLanguages) &&
                    previousQuestion.config.codingLanguages.length > 0) {
                    codingLanguages = [...previousQuestion.config.codingLanguages];
                }
                responseType = previousQuestion.config.responseType;
                settings = previousQuestion.config.settings
            }
        }

        const newQuestion: QuizQuestion = {
            id: `question-${Date.now()}`,
            content: [],
            config: {
                ...defaultQuestionConfig,
                questionType: questionType as 'objective' | 'subjective',
                inputType: inputType,
                codingLanguages: codingLanguages,
                responseType: responseType,
                title: 'Question ' + (questions.length + 1),
                settings: settings
            }
        };

        const updatedQuestions = [...questions, newQuestion];
        setQuestions(updatedQuestions);
        setCurrentQuestionIndex(updatedQuestions.length - 1);

        // Reset last content update ref
        lastContentUpdateRef.current = "";

        // Reset integration blocks for the new question
        setIntegrationBlocks([]);
        setIntegrationError(null);
        setIsLoadingIntegration(false);

        // Trigger animation
        setNewQuestionAdded(true);

        // Trigger question count highlight animation
        setQuestionCountHighlighted(true);

        // Reset animation flags after animation completes
        setTimeout(() => {
            setNewQuestionAdded(false);
        }, 800); // slightly longer than animation duration to ensure it completes

        setTimeout(() => {
            setQuestionCountHighlighted(false);
        }, 1000); // Animation duration for the question counter highlight

        if (onChange) {
            onChange(updatedQuestions);
        }

        updateCurrentQuestionId(newQuestion.id);

        setActiveEditorTab('question');

        // Removed slash menu opening after adding a new question
    }, [questions, onChange, onQuestionChange]);

    // Navigate to previous question
    const goToPreviousQuestion = useCallback(() => {
        if (currentQuestionIndex == 0) return;

        if (checkUnsavedScorecardChanges()) {
            // Store the previous question action as pending
            pendingScorecardActionRef.current = () => {
                // Execute the previous question logic without checking for unsaved changes
                executeGoToPreviousQuestion();
            };

            if (onQuestionChangeWithUnsavedScorecardChanges) {
                onQuestionChangeWithUnsavedScorecardChanges();
            }
            return;
        }

        executeGoToPreviousQuestion();
    }, [currentQuestionIndex, onQuestionChange, questions, activeEditorTab, isPreviewMode]);

    // Extract the actual previous question logic to a separate function
    const executeGoToPreviousQuestion = useCallback(() => {
        // Reset last content update ref when navigating to a different question
        lastContentUpdateRef.current = "";
        const newIndex = currentQuestionIndex - 1;


        // Reset active tab to question when navigating
        // Only change active tab if the current tab is not available in the next question
        const nextQuestion = questions[newIndex];
        if (activeEditorTab === 'scorecard' && nextQuestion.config.questionType !== 'subjective') {
            setActiveEditorTab('question');
        } else if (activeEditorTab === 'answer' && nextQuestion.config.questionType == 'subjective') {
            setActiveEditorTab('question');
        }

        setCurrentQuestionIndex(newIndex);

        // Call the onQuestionChange callback if provided
        if (onQuestionChange && questions[newIndex] && !isPreviewMode) {
            onQuestionChange(questions[newIndex].id);
        }
    }, [currentQuestionIndex, onQuestionChange, questions, activeEditorTab, isPreviewMode]);

    // Navigate to next question
    const goToNextQuestion = useCallback(() => {
        if (currentQuestionIndex == questions.length - 1) return;

        if (checkUnsavedScorecardChanges()) {
            // Store the next question action as pending
            pendingScorecardActionRef.current = () => {
                // Execute the next question logic without checking for unsaved changes
                executeGoToNextQuestion();
            };

            if (onQuestionChangeWithUnsavedScorecardChanges) {
                onQuestionChangeWithUnsavedScorecardChanges();
            }
            return;
        }

        executeGoToNextQuestion();
    }, [currentQuestionIndex, questions.length, onQuestionChange, questions, activeEditorTab, isPreviewMode]);

    // Extract the actual next question logic to a separate function
    const executeGoToNextQuestion = useCallback(() => {
        // Reset last content update ref when navigating to a different question
        lastContentUpdateRef.current = "";
        const newIndex = currentQuestionIndex + 1;

        // Reset active tab to question when navigating
        const nextQuestion = questions[newIndex];
        if (activeEditorTab === 'scorecard' && nextQuestion.config.questionType !== 'subjective') {
            setActiveEditorTab('question');
        } else if (activeEditorTab === 'answer' && nextQuestion.config.questionType == 'subjective') {
            setActiveEditorTab('question');
        }

        setCurrentQuestionIndex(newIndex);

        // Call the onQuestionChange callback if provided
        if (onQuestionChange && questions[newIndex] && !isPreviewMode) {
            onQuestionChange(questions[newIndex].id);
        }

    }, [currentQuestionIndex, questions.length, onQuestionChange, questions, activeEditorTab, isPreviewMode]);

    // Delete current question
    const deleteQuestion = useCallback(() => {
        if (questions.length <= 1) {
            // If only one question, just clear the questions array
            setQuestions([]);
            setShowDeleteConfirm(false);

            if (onChange) {
                onChange([]);
            }
            return;
        }

        const updatedQuestions = [...questions];
        updatedQuestions.splice(currentQuestionIndex, 1);

        setQuestions(updatedQuestions);

        // Adjust current index if necessary
        if (currentQuestionIndex >= updatedQuestions.length) {
            setCurrentQuestionIndex(updatedQuestions.length - 1);
        }

        if (onChange) {
            onChange(updatedQuestions);
        }

        // Hide confirmation dialog
        setShowDeleteConfirm(false);

        // Reset last content update ref when deleting a question
        lastContentUpdateRef.current = "";
    }, [questions, currentQuestionIndex, onChange]);

    // Effect to initialize lastContentUpdateRef when changing questions
    useEffect(() => {
        if (questions.length > 0) {
            lastContentUpdateRef.current = JSON.stringify(currentQuestionContent);
        }
    }, [currentQuestionIndex, questions.length, currentQuestionContent]);

    // Placeholder component for empty quiz
    const EmptyQuizPlaceholder = () => (
        <div className="flex flex-col items-center justify-center h-full w-full text-center p-8 dark:p-8 rounded-lg border border-gray-200 bg-gray-50 dark:border-transparent dark:bg-transparent">
            <h3 className="text-xl font-light mb-3 text-gray-900 dark:text-white">Questions are the gateway to learning</h3>
            <p className="max-w-md mb-8 text-gray-700 dark:text-gray-400">
                Add questions to create an interactive quiz for your learners
            </p>
            {status === 'draft' && (
                <button
                    onClick={addQuestion}
                    className="flex items-center px-5 py-2.5 text-sm rounded-md transition-colors cursor-pointer text-white bg-blue-600 hover:bg-blue-700 dark:text-black dark:bg-white dark:hover:bg-gray-100 border border-transparent"
                    disabled={readOnly}
                >
                    <div className="w-4 h-4 rounded-full border border-transparent flex items-center justify-center mr-2">
                        <Plus size={10} className="text-white dark:text-black" />
                    </div>
                    Add question
                </button>
            )}
        </div>
    );

    const handleCancelPublish = () => {
        if (onPublishCancel) {
            onPublishCancel();
        }
    };


    const updateDraftQuiz = async (scheduledPublishAt?: string | null, status: 'draft' | 'published' = 'published') => {
        if (!taskId) {
            console.error("Cannot publish: taskId is not provided");
            setErrorMessage("Cannot unpublish: Task ID is missing");
            return;
        }

        setIsPublishing(true);
        setErrorMessage(null);

        try {
            // Get the current title from the dialog - it may have been edited
            const dialogTitleElement = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
            const currentTitle = dialogTitleElement?.textContent || '';

            // Format questions for the API
            const formattedQuestions = prepareQuestionsFormattedForBackend()

            // Make POST request to update the quiz
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}/quiz`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: currentTitle,
                    questions: formattedQuestions,
                    scheduled_publish_at: scheduledPublishAt,
                    status: status
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to publish quiz: ${response.status}`);
            }

            // Get the updated task data from the response
            const updatedTaskData = await response.json();

            const updatedData = {
                ...updatedTaskData,
                status: status,
                title: currentTitle,
                scheduled_publish_at: scheduledPublishAt,
                id: taskId // Ensure the ID is included for proper updating in the module list
            };

            console.log("Draft quiz updated successfully");

            // Set publishing to false to avoid state updates during callbacks
            setIsPublishing(false);

            // Call the onPublishSuccess callback if provided
            const callback = status === 'published' ? onPublishSuccess : onSaveSuccess;
            if (callback) {
                // Use setTimeout to break the current render cycle
                setTimeout(() => {
                    callback(updatedData);
                }, 0);
            }
        } catch (error) {
            console.error("Error publishing quiz:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to publish quiz");
            setIsPublishing(false);
        }
    };

    // Modified handleSavePublishedQuiz for edit mode to send raw blocks of the correct answer
    const handleSavePublishedQuiz = async () => {
        if (!taskId) {
            console.error("Cannot save: taskId is not provided");
            return;
        }

        try {
            // Get the current title from the dialog - it may have been edited
            const dialogTitleElement = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
            const currentTitle = dialogTitleElement?.textContent || '';

            // Format questions for the API
            const formattedQuestions = questions.map((question) => {
                // Map questionType to API type
                const questionType = question.config.questionType;

                // Get input_type from the current config
                const inputType = question.config.inputType;

                let scorecardId = null

                if (question.config.scorecardData) {
                    // Use our helper function to determine if this is an API scorecard
                    scorecardId = question.config.scorecardData.id
                }

                return {
                    id: question.id,
                    blocks: question.content,
                    answer: question.config.correctAnswer || [],
                    coding_languages: question.config.codingLanguages || [],
                    type: questionType,
                    input_type: inputType,
                    response_type: question.config.responseType,
                    scorecard_id: scorecardId,
                    context: getKnowledgeBaseContent(question.config),
                    title: question.config.title,
                    settings: question.config.settings,
                };
            });

            // Make PUT request to update the quiz content, keeping the same status
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}/quiz`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: currentTitle,
                    questions: formattedQuestions,
                    scheduled_publish_at: scheduledPublishAt
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to save quiz: ${response.status}`);
            }

            // Get the updated task data from the response
            const updatedTaskData = await response.json();

            // Create updated data with the current title
            const updatedData = {
                ...updatedTaskData,
                title: currentTitle,
                id: taskId,
            };

            // Call the onSaveSuccess callback if provided
            if (onSaveSuccess) {
                setTimeout(() => {
                    onSaveSuccess(updatedData);
                }, 0);
            }
        } catch (error) {
            console.error("Error saving quiz:", error);
        }
    };

    // Handle cancel in edit mode - revert to original data
    const handleCancel = () => {
        if (originalQuestionsRef.current.length === 0) return;
        // Restore the original questions
        setQuestions(JSON.parse(JSON.stringify(originalQuestionsRef.current)));

        // Return the original title to the dialog header
        const dialogTitleElement = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
        if (dialogTitleElement && originalTitleRef.current) {
            dialogTitleElement.textContent = originalTitleRef.current;
        }
    };

    // Check if the current question has coding languages set
    const hasCodingLanguages = useCallback(() => {
        if (questions.length === 0 || currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) {
            return false;
        }

        const question = questions[currentQuestionIndex];
        if (question.config.inputType !== 'code') {
            return true; // Not relevant for non-coding questions
        }

        // Check if coding languages array exists and has at least one value
        return !!(question.config.codingLanguages &&
            Array.isArray(question.config.codingLanguages) &&
            question.config.codingLanguages.length > 0);
    }, [questions, currentQuestionIndex]);

    // Add function to check for unsaved scorecard changes across all questions
    const checkUnsavedScorecardChanges = useCallback(() => {
        // Use the scorecard manager's method to check for unsaved changes
        return scorecardManagerRef.current?.hasUnsavedScorecardChanges() ?? false;
    }, []);

    // Expose methods to parent component via the ref
    useImperativeHandle(ref, () => ({
        saveDraft: () => updateDraftQuiz(null, 'draft'),
        savePublished: handleSavePublishedQuiz,
        cancel: handleCancel,
        hasContent: () => questions.length > 0,
        hasQuestionContent: () => {
            const isValid = validateQuestionContent(currentQuestionContent);
            if (!isValid) {
                // Switch to question tab
                setActiveEditorTab('question');
                // Highlight the question field to draw attention to the error
                highlightField('question');
            }
            return isValid;
        },
        getCurrentQuestionType: () => {
            // Return null if there are no questions
            if (questions.length === 0) return null;
            // Return the current question's type, defaulting to 'objective' if not set
            return currentQuestionConfig.questionType;
        },
        getCurrentQuestionInputType: () => {
            // Return null if there are no questions
            if (questions.length === 0) return null;
            // Return the current question's input type, defaulting to 'text' if not set
            return currentQuestionConfig.inputType;
        },
        hasCorrectAnswer: () => {
            const isValid = validateCorrectAnswer(currentQuestionConfig);
            if (!isValid) {
                // Switch to answer tab
                setActiveEditorTab('answer');
                // Highlight the answer field to draw attention to the error
                highlightField('answer');
            }
            return isValid;
        },
        hasScorecard: () => {
            if (questions.length === 0) return false;

            const hasFromConfig = validateScorecard(currentQuestionConfig);
            const hasFromManager = scorecardManagerRef.current?.hasScorecard?.() ?? false;

            return hasFromConfig || hasFromManager;
        },
        hasCodingLanguages: () => {
            const isValid = hasCodingLanguages();
            if (!isValid) {
                // Highlight the coding language field to draw attention to the error
                highlightField('codingLanguage');
            }
            return isValid;
        },
        setActiveTab: (tab) => {
            // Set the active editor tab
            setActiveEditorTab(tab);
        },
        validateBeforePublish: validateAllQuestions,
        getCurrentQuestionConfig: () => {
            // Return undefined if there are no questions
            if (questions.length === 0) return undefined;
            // Return the current question's configuration
            return currentQuestionConfig;
        },
        validateScorecardCriteria: (scorecard: ScorecardTemplate | undefined, callbacks: ValidationCallbacks) =>
            scorecardManagerRef.current?.validateScorecardCriteria(scorecard, callbacks) ?? true,
        hasChanges: () => {
            // If we don't have original questions to compare with, assume no changes
            if (originalQuestionsRef.current.length === 0 && questions.length === 0) return false;

            // Check if title has changed
            const dialogTitleElement = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
            const currentTitle = dialogTitleElement?.textContent || "";
            const originalTitle = originalTitleRef.current || "";

            if (currentTitle !== originalTitle) {
                return true;
            }

            // Check if questions have changed (number, content, or configuration)
            if (questions.length !== originalQuestionsRef.current.length) {
                return true;
            }

            // Sanitize current questions to remove position properties added by the editor
            const sanitizedCurrentQuestions = sanitizeQuestionDataFromBackend(questions);

            // Convert both to JSON strings for deep comparison
            const currentQuestionsStr = JSON.stringify(sanitizedCurrentQuestions);
            const originalQuestionsStr = JSON.stringify(originalQuestionsRef.current);

            console.log("currentQuestionsStr", currentQuestionsStr)
            console.log("originalQuestionsStr", originalQuestionsStr)

            // Return true if there are changes
            return currentQuestionsStr !== originalQuestionsStr;
        },
        hasUnsavedScorecardChanges: () => scorecardManagerRef.current?.hasUnsavedScorecardChanges() ?? false,
        handleScorecardChangesRevert: () => scorecardManagerRef.current?.handleScorecardChangesRevert()
    }));

    // Update the MemoizedLearnerQuizView to include the correct answer
    const MemoizedLearnerQuizView = useMemo(() => {
        // No validation checks - directly use the questions array
        // Make a deep copy of questions
        let questionsWithCorrectAnswers = JSON.parse(JSON.stringify(questions));

        // Update the current question with the latest correct answer blocks if possible
        if (correctAnswerEditorRef.current && currentQuestionIndex >= 0 && currentQuestionIndex < questionsWithCorrectAnswers.length) {
            const currentCorrectAnswer = correctAnswerEditorRef.current.document || [];
            questionsWithCorrectAnswers[currentQuestionIndex].config = {
                ...questionsWithCorrectAnswers[currentQuestionIndex].config,
                correctAnswer: currentCorrectAnswer
            };
        }

        return (
            <LearnerQuizView
                questions={questionsWithCorrectAnswers}
                className="w-full h-full"
                onSubmitAnswer={onSubmitAnswer}
                currentQuestionId={activeQuestionId}
                onQuestionChange={(questionId) => {
                    // Find the index for this question ID
                    const index = questions.findIndex(q => q.id === questionId);
                    if (index !== -1) {
                        // Update our internal state
                        setCurrentQuestionIndex(index);
                    }
                }}
                taskId={taskId}
                userId={user?.id}
                isTestMode={true}
            />
        );
    }, [questions, onSubmitAnswer, taskType, activeQuestionId, currentQuestionIndex, user?.id]);

    // Define dropdown options
    // Now removed and imported from dropdownOptions.ts

    // Get dropdown option objects based on config values
    const getQuestionTypeOption = useCallback((type: string = 'objective') => {
        return questionTypeOptions.find(option => option.value === type) || questionTypeOptions[0];
    }, []);

    const getAnswerTypeOption = useCallback((type: string = 'text') => {
        return answerTypeOptions.find(option => option.value === type) || answerTypeOptions[0];
    }, []);

    const getPurposeOption = useCallback((purpose: string = 'practice') => {
        return questionPurposeOptions.find(option => option.value === purpose) || questionPurposeOptions[0];
    }, []);

    // Handle question title change
    const handleQuestionTitleChange = useCallback((newTitle: string) => {
        // Update the question config with the new question title
        handleConfigChange({
            title: newTitle
        });
    }, [handleConfigChange]);

    // Handle question title input validation
    const handleQuestionTitleInput = useCallback((e: React.FormEvent<HTMLSpanElement>) => {
        // Clear highlight immediately when user starts editing
        if (highlightedField === 'title') {
            setHighlightedField(null);
        }

        const el = e.currentTarget;
        if (el.textContent && el.textContent.length > 200) {
            el.textContent = el.textContent.slice(0, 200);
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(el);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    }, [highlightedField]);

    // Handle question title blur
    const handleQuestionTitleBlur = useCallback((e: React.FocusEvent<HTMLSpanElement>) => {
        const newValue: string = e.currentTarget.textContent?.trim() || '';
        if (newValue !== currentQuestionConfig.title) {
            handleQuestionTitleChange(newValue);
        }
    }, [currentQuestionConfig.title, handleQuestionTitleChange]);

    // Handle question title key down
    const handleQuestionTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
        }
    }, []);

    // Handle question type change
    const handleQuestionTypeChange = useCallback((option: DropdownOption | DropdownOption[]) => {
        // We know this is a single-select dropdown
        if (!Array.isArray(option)) {
            setSelectedQuestionType(option);

            // Get the new question type
            const newQuestionType = option.value as 'objective' | 'subjective';

            // Update the question config with the new question type and also update template if needed
            handleConfigChange({
                questionType: newQuestionType,
            }, {
                updateTemplate: true,
                newQuestionType: newQuestionType,
                newInputType: currentQuestionConfig.inputType
            });

            // Set active tab to question whenever question type changes
            setActiveEditorTab('question');
        }
    }, [handleConfigChange, status, questions, currentQuestionIndex, onChange, currentQuestionConfig.inputType]);

    // Handle purpose change
    const handlePurposeChange = useCallback((option: DropdownOption | DropdownOption[]) => {
        // We know this is a single-select dropdown
        if (!Array.isArray(option)) {
            setSelectedPurpose(option);

            // Get the new purpose
            const newPurpose = option.value as 'practice' | 'exam';

            // Update the question config with the new purpose
            const configUpdate: any = {
                responseType: newPurpose === 'exam' ? 'exam' : 'chat'
            };

            // Set allowCopyPaste based on purpose
            if (newPurpose === 'exam') {
                configUpdate.settings = { allowCopyPaste: false };
            } else {
                configUpdate.settings = { allowCopyPaste: true };
            }

            handleConfigChange(configUpdate);
        }
    }, [handleConfigChange]);

    // Handle copy-paste control change
    const handleCopyPasteControlChange = useCallback((option: DropdownOption | DropdownOption[]) => {
        if (!Array.isArray(option)) {
            setSelectedCopyPasteControl(option);
            handleConfigChange({ settings: { allowCopyPaste: option.value === 'true' } });
        }
    }, [handleConfigChange]);

    // Handle answer type change
    const handleAnswerTypeChange = useCallback((option: DropdownOption | DropdownOption[]) => {
        // We know this is a single-select dropdown
        if (!Array.isArray(option)) {
            setSelectedAnswerType(option);

            // Update the question config with the new input type
            handleConfigChange({
                inputType: option.value as 'text' | 'code' | 'audio'
            }, {
                updateTemplate: true,
                newQuestionType: currentQuestionConfig.questionType,
                newInputType: option.value as 'text' | 'code' | 'audio'
            });
        }
    }, [handleConfigChange, status, questions, currentQuestionIndex, onChange, currentQuestionConfig.questionType]);

    // Handle coding language change
    const handleCodingLanguageChange = useCallback((option: DropdownOption | DropdownOption[]) => {
        // Cast to array since we know this is a multiselect dropdown
        const selectedOptions = Array.isArray(option) ? option : [option];

        // Define exclusive languages
        const exclusiveLanguages = ['react', 'sql', 'python', 'nodejs'];

        // Validation logic for language combinations
        let validatedOptions = [...selectedOptions];
        let invalidMessage = "";

        // Find all exclusive languages in the selection
        const exclusiveSelectedLanguages = selectedOptions.filter(opt =>
            exclusiveLanguages.includes(opt.value)
        );

        // Check if any exclusive language is selected
        if (exclusiveSelectedLanguages.length > 0) {
            // If there are multiple exclusive languages, get the last one selected
            const lastExclusiveLanguage = exclusiveSelectedLanguages[exclusiveSelectedLanguages.length - 1];

            // If we have more than one language selected and at least one is exclusive,
            // we need to filter out all other languages
            if (selectedOptions.length > 1) {
                // Keep only the last exclusive language
                validatedOptions = [lastExclusiveLanguage];

                // Get a nice display name for the exclusive language
                const displayName = lastExclusiveLanguage.label

                invalidMessage = `${displayName} must be used alone. Other languages cannot be added along with it.`;
            }
        } else {
            // No exclusive languages, check for HTML and CSS combination
            const hasCSS = selectedOptions.some(opt => opt.value === 'css');
            const hasHTML = selectedOptions.some(opt => opt.value === 'html');

            if (hasCSS && !hasHTML) {
                // Find the HTML option in the coding language options
                const htmlOption = codingLanguageOptions.find(opt => opt.value === 'html');

                if (htmlOption) {
                    // Add HTML to the validated options
                    validatedOptions.push(htmlOption);
                    invalidMessage = "HTML has been automatically selected because CSS requires HTML";
                }
            }
        }

        // Set the validated options
        setSelectedCodingLanguages(validatedOptions);

        // Update the question config with the validated options
        handleConfigChange({
            codingLanguages: validatedOptions.map(opt => opt.value)
        });

        // Show feedback to the user if there was an invalid combination
        if (invalidMessage) {
            // Use setTimeout to ensure state is updated before showing the feedback
            setTimeout(() => {
                // Show a toast notification
                setToastTitle("Language Selection Updated");
                setToastMessage(invalidMessage);
                setToastEmoji("⚠️");
                setShowToast(true);
            }, 100);
        }
    }, [handleConfigChange]);

    // State for type dropdown
    const [selectedQuestionType, setSelectedQuestionType] = useState<DropdownOption>(questionTypeOptions[0]);
    const [selectedAnswerType, setSelectedAnswerType] = useState<DropdownOption>(answerTypeOptions[0]);
    const [selectedCodingLanguages, setSelectedCodingLanguages] = useState<DropdownOption[]>([codingLanguageOptions[0]]);
    const [selectedPurpose, setSelectedPurpose] = useState<DropdownOption>(questionPurposeOptions[0]);
    const [selectedCopyPasteControl, setSelectedCopyPasteControl] = useState<DropdownOption>(copyPasteControlOptions[0]);

    // Update the selected options based on the current question's config
    useEffect(() => {
        if (questions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
            const currentConfig = questions[currentQuestionIndex].config;

            // Set question type based on config
            setSelectedQuestionType(getQuestionTypeOption(currentConfig.questionType));

            // Set answer type based on config.inputType or default to 'text'
            setSelectedAnswerType(getAnswerTypeOption(currentConfig.inputType));

            // Set purpose based on config.purpose or default to 'practice'
            setSelectedPurpose(getPurposeOption(currentConfig.responseType));

            // Set copy-paste control based on config.settings
            const allowCopyPaste = currentConfig.settings?.allowCopyPaste;
            if (allowCopyPaste !== undefined) {
                const copyPasteOption = copyPasteControlOptions.find(opt => opt.value === allowCopyPaste.toString());
                if (copyPasteOption) {
                setSelectedCopyPasteControl(copyPasteOption);
                } else {
                    setSelectedCopyPasteControl(copyPasteControlOptions[1]);
                }
            } else {
                setSelectedCopyPasteControl(copyPasteControlOptions[1]);
            }

            // Set coding languages based on config.codingLanguages or default to first option
            if (currentConfig.codingLanguages && currentConfig.codingLanguages.length > 0) {
                const selectedLanguages = currentConfig.codingLanguages.map((langValue: string) => {
                    return codingLanguageOptions.find(opt => opt.value === langValue) || codingLanguageOptions[0];
                }).filter(Boolean);
                setSelectedCodingLanguages(selectedLanguages.length > 0 ? selectedLanguages : [codingLanguageOptions[0]]);
            } else {
                setSelectedCodingLanguages([]);
            }
        }
    }, [currentQuestionIndex, questions, getQuestionTypeOption, getAnswerTypeOption, getPurposeOption]);


    // New function to sync all questions with a source scorecard when it changes
    const syncLinkedScorecards = useCallback((sourceId: string, newName?: string, newCriteria?: CriterionData[]) => {
        if (!sourceId) return;

        setQuestions(prevQuestions => {
            const updatedQuestions = prevQuestions.map(question => {
                const scorecard = question.config.scorecardData;
                if (scorecard && scorecard.id === sourceId) {
                    const updatedScorecardData = {
                        ...scorecard,
                        name: newName !== undefined ? newName : scorecard.name,
                        criteria: newCriteria !== undefined ? newCriteria : scorecard.criteria,
                    };

                    return {
                        ...question,
                        config: {
                            ...question.config,
                            scorecardData: updatedScorecardData,
                        },
                    };
                }
                return question;
            });

            // Defer onChange callback to avoid updating parent component during render
            if (onChange) {
                setTimeout(() => {
                    onChange(updatedQuestions);
                }, 0);
            }

            return updatedQuestions;
        });
    }, [onChange]);


    const prepareQuestionsFormattedForBackend = () : QuizQuestion[] => {
        // Format questions for the API
        return questions.map((question) => {
            // Map questionType to API type
            const questionType = question.config.questionType;
            // Map inputType
            const inputType = question.config.inputType

            let scorecardId = null

            if (question.config.scorecardData) {
                // Use our helper function to determine if this is an API scorecard
                scorecardId = question.config.scorecardData.id
            }

            // Return the formatted question object for all questions, not just those with scorecards
            const questionData: any = {
                blocks: question.content,
                answer: question.config.correctAnswer || [],
                input_type: inputType,
                response_type: question.config.responseType,
                coding_languages: question.config.codingLanguages || [],
                generation_model: null,
                type: questionType,
                max_attempts: question.config.responseType === 'exam' ? 1 : null,
                is_feedback_shown: question.config.responseType === 'exam' ? false : true,
                scorecard_id: scorecardId,
                context: getKnowledgeBaseContent(question.config),
                title: question.config.title,
                settings: question.config.settings,
            };

            // Include ID only for existing questions being updated
            if (question.id && !question.id.includes('question-')) {
                questionData.id = question.id;
            }

            return questionData;
        });
    }

    const handleConfirmUnpublish = async () => {
        if (!taskId) {
            setErrorMessage("Cannot unpublish: Task ID is missing");
            return;
        }

        setIsUnpublishing(true);

        try {
            // Get the current title from the dialog - it may have been edited
            const dialogTitleElement = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
            const currentTitle = dialogTitleElement?.textContent || '';

            const formattedQuestions = prepareQuestionsFormattedForBackend()

            // Make POST request to update the quiz
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}/quiz`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: currentTitle,
                    questions: formattedQuestions,
                    scheduled_publish_at: null, // Set to null, since the desired behaviour is to unpublish a quiz and also to unschedule a scheduled quiz which would mean 'null' makes sense in both cases  
                    status: 'draft'
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to publish quiz: ${response.status}`);
            }

            // Get the updated task data from the response
            const updatedTaskData = await response.json();

            onUnPublishSuccess(updatedTaskData)
            setIsUnpublishing(false);
            setShowUnpublishConfirmation(false);
        } catch (error) {
            console.error("Error publishing quiz:", error);
            setErrorMessage(error instanceof Error ? error.message : "Failed to publish quiz");
            setIsPublishing(false);
        }
    }
    
    const handleCancelUnpublish = () => {
        setErrorMessage(null)
        setShowUnpublishConfirmation(false)
    };

    return (
        <div className={`flex flex-col h-full relative ${className}`} key={`quiz-${taskId}-${isEditMode ? 'edit' : 'view'}`}>
            {/* Question delete confirmation modal */}
            <ConfirmationDialog
                show={showDeleteConfirm && !isPreviewMode}
                title="Delete Question"
                message="Are you sure you want to delete this question? This action cannot be undone."
                onConfirm={deleteQuestion}
                onCancel={() => setShowDeleteConfirm(false)}
                type="delete"
            />

            {/* Publish Confirmation Dialog */}
            <PublishConfirmationDialog
                show={showPublishConfirmation}
                title="Ready to publish?"
                message="After publishing, you won't be able to add or remove questions, but you can still edit existing ones"
                onConfirm={updateDraftQuiz}
                onCancel={handleCancelPublish}
                isLoading={isPublishing}
                errorMessage={errorMessage}
            />

            <ConfirmationDialog
                open={showUnpublishConfirmation}
                title="Are you sure to unpublish these changes?"
                message="This quiz will be unpublished to learners immediately after this action. Are you sure you want to proceed?"
                confirmButtonText="Unpublish"
                cancelButtonText="Cancel"
                onConfirm={handleConfirmUnpublish}
                onCancel={handleCancelUnpublish}
                isLoading={isUnpublishing}
                errorMessage={null}
                type="delete"
                deleteIcon={null}
            />

            {/* Loading indicator */}
            {isLoadingQuestions && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white bg-opacity-80 dark:bg-[#1A1A1A] dark:bg-opacity-80">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black dark:border-transparent"></div>
                </div>
            )}

            {/* Content area with animation when a new question is added */}
            <div className={`flex flex-1 gap-0 ${newQuestionAdded ? 'animate-new-question' : ''} ${isPreviewMode ? 'h-full' : ''}`}>
                {isPreviewMode ? (
                    <>
                        <div
                            className="w-full h-full"
                            onClick={(e) => e.stopPropagation()} // Stop events from bubbling up
                            onMouseDown={(e) => e.stopPropagation()} // Stop mousedown events too
                        >
                            {MemoizedLearnerQuizView}
                        </div>
                    </>
                ) : (
                    <>
                        {questions.length === 0 ? (
                            <div className="w-full flex justify-center items-center">
                                <EmptyQuizPlaceholder />
                            </div>
                        ) : (
                            <>
                                {/* Left Sidebar - Questions List */}
                                <div className="w-64 h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-[#121212]">
                                    {/* Sidebar Header */}
                                    <div className="p-4 flex items-center justify-between bg-gray-100 dark:bg-[#0A0A0A]">
                                        <h3 className="text-lg font-light text-black dark:text-white">Questions</h3>
                                        <div className={`px-3 py-1 rounded-full text-xs transition-all duration-300 ${questionCountHighlighted
                                            ? 'bg-green-700 font-semibold shadow-lg animate-question-highlight text-white'
                                            : 'bg-gray-200 border-gray-300 text-gray-700 dark:bg-[#2A2A2A] dark:border-[#3A3A3A] dark:text-gray-300'
                                            }`}>
                                            {questions.length}
                                        </div>
                                    </div>

                                    {/* Add Question Button */}
                                    {!readOnly && status === 'draft' && (
                                        <div className="p-3">
                                            <button
                                                onClick={addQuestion}
                                                className="w-full flex items-center justify-center px-4 py-2 text-sm rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed text-white bg-blue-600 hover:bg-blue-700 dark:text-black dark:bg-white dark:hover:bg-gray-100"
                                                disabled={readOnly || isLoadingIntegration}
                                            >
                                                <div className="w-4 h-4 rounded-full border flex items-center justify-center mr-2 border-white dark:border-black">
                                                    <Plus size={10} className="text-white dark:text-black" />
                                                </div>
                                                Add question
                                            </button>
                                        </div>
                                    )}

                                    {/* Questions List */}
                                    <div className="flex-1 overflow-y-auto">
                                        {questions.map((question, index) => (
                                            <div
                                                key={question.id}
                                                className={`px-4 py-3 cursor-pointer flex items-center justify-between group border-l-2 ${index === currentQuestionIndex
                                                    ? "bg-gray-200 border-green-500 dark:bg-[#222222]"
                                                    : "hover:bg-gray-100 border-transparent dark:hover:bg-[#1A1A1A]"
                                                    }`}
                                                onClick={() => {
                                                    if (checkUnsavedScorecardChanges()) {
                                                        pendingScorecardActionRef.current = () => {
                                                            setCurrentQuestionIndex(index);
                                                            setActiveEditorTab('question');
                                                            if (onQuestionChange && !isPreviewMode) {
                                                                onQuestionChange(question.id);
                                                            }
                                                        };
                                                        if (onQuestionChangeWithUnsavedScorecardChanges) {
                                                            onQuestionChangeWithUnsavedScorecardChanges();
                                                        }
                                                        return;
                                                    }

                                                    setCurrentQuestionIndex(index);
                                                    setActiveEditorTab('question');
                                                    if (onQuestionChange && !isPreviewMode) {
                                                        onQuestionChange(question.id);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center flex-1 min-w-0">
                                                    <div className="flex-1 min-w-0">
                                                        <div
                                                            className={`text-sm break-words whitespace-normal ${index === currentQuestionIndex 
                                                                ? "text-black dark:text-white" 
                                                                : "text-gray-700 dark:text-gray-300"}`}
                                                            data-testid="sidebar-question-label"
                                                        >
                                                            {question.config.title || `Question ${index + 1}`}
                                                        </div>
                                                        <div className={`text-xs truncate ${index === currentQuestionIndex 
                                                            ? "text-gray-600 dark:text-gray-300"
                                                            : "text-gray-500"
                                                            }`}>
                                                            {question.config.responseType === 'chat' ? 'Practice' : 'Exam'} • {question.config.questionType === 'objective' ? 'Objective' : 'Subjective'} • {question.config.inputType}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Delete button - only show for current question and when not readonly */}
                                                {!readOnly && status === 'draft' && index === currentQuestionIndex && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowDeleteConfirm(true);
                                                        }}
                                                        className="opacity-0 cursor-pointer group-hover:opacity-100 ml-2 p-1 text-red-400 hover:text-red-300 transition-all duration-200"
                                                        aria-label="Delete question"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Main Content Area */}
                                <div className="flex-1 flex flex-col">
                                    {/* Question Configuration Header */}
                                    <div className="flex flex-col space-y-2 p-4 bg-gray-100 dark:bg-[#111111]">
                                        <div className={`flex items-center w-full rounded-md ${highlightedField === 'title' ? 'outline outline-2 outline-red-400 shadow-md shadow-red-900/50 animate-pulse bg-red-50 dark:bg-[#2D1E1E]' : ''}`}>
                                            <span className="text-sm flex-shrink-0 w-1/6 mr-2 flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-200 dark:text-gray-500 dark:hover:bg-[#2A2A2A]">
                                                <span className="mr-2"><Tag size={16} /></span>
                                                Title
                                            </span>
                                            <span
                                                className="text-base w-full outline-none p-1 rounded-md text-black dark:text-white"
                                                contentEditable={!readOnly}
                                                suppressContentEditableWarning={true}
                                                onBlur={handleQuestionTitleBlur}
                                                onInput={handleQuestionTitleInput}
                                                onKeyDown={handleQuestionTitleKeyDown}
                                                onClick={e => e.stopPropagation()}
                                                data-testid="question-title-span"
                                            >
                                                {currentQuestionConfig.title}
                                            </span>
                                        </div>
                                        <div className="flex items-center">
                                            <Dropdown
                                                icon={<Sparkles size={16} />}
                                                title="Purpose"
                                                options={questionPurposeOptions}
                                                selectedOption={selectedPurpose}
                                                onChange={handlePurposeChange}
                                                disabled={readOnly}
                                            />
                                        </div>
                                        <div className="flex items-center">
                                            <Dropdown
                                                icon={<ClipboardCheck size={16} />}
                                                title="Allow copy/paste?"
                                                options={copyPasteControlOptions}
                                                selectedOption={selectedCopyPasteControl}
                                                onChange={handleCopyPasteControlChange}
                                                disabled={readOnly}
                                            />
                                        </div>
                                        <div className="flex items-center">
                                            <Dropdown
                                                icon={<HelpCircle size={16} />}
                                                title="Question Type"
                                                options={questionTypeOptions}
                                                selectedOption={selectedQuestionType}
                                                onChange={handleQuestionTypeChange}
                                                disabled={readOnly}
                                            />
                                        </div>
                                        <Dropdown
                                            icon={<Pen size={16} />}
                                            title="Answer Type"
                                            options={answerTypeOptions}
                                            selectedOption={selectedAnswerType}
                                            onChange={handleAnswerTypeChange}
                                            disabled={readOnly}
                                        />
                                        {selectedAnswerType.value == 'code' && (
                                            <div className="flex items-center">
                                                <div className={`w-full ${highlightedField === 'codingLanguage' ? 'outline outline-2 outline-red-400 shadow-md shadow-red-900/50 animate-pulse rounded-md bg-red-50 dark:bg-[#2D1E1E]' : ''}`}>
                                                    <Dropdown
                                                        icon={<Code size={16} />}
                                                        title="Languages"
                                                        options={codingLanguageOptions}
                                                        selectedOptions={selectedCodingLanguages}
                                                        onChange={handleCodingLanguageChange}
                                                        disabled={readOnly}
                                                        multiselect={true}
                                                        placeholder="Select one or more languages"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Segmented control for editor tabs */}
                                    <div className="flex justify-center py-4 bg-white dark:bg-transparent">
                                        <div className="inline-flex rounded-lg p-1 bg-gray-200 dark:bg-[#222222]">
                                            <button
                                                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer ${activeEditorTab === 'question'
                                                    ? 'bg-white text-black dark:bg-[#333333] dark:text-white'
                                                    : 'text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white'
                                                    }`}
                                                onClick={() => setActiveEditorTab('question')}
                                            >
                                                <HelpCircle size={16} className="mr-2" />
                                                Question
                                            </button>
                                            {selectedQuestionType.value !== 'subjective' ? (
                                                <button
                                                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer ${activeEditorTab === 'answer'
                                                        ? 'bg-white text-black dark:bg-[#333333] dark:text-white'
                                                        : 'text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white'
                                                        }`}
                                                    onClick={() => setActiveEditorTab('answer')}
                                                >
                                                    <Check size={16} className="mr-2" />
                                                    Correct answer
                                                </button>
                                            ) : (
                                                <button
                                                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer ${activeEditorTab === 'scorecard'
                                                        ? 'bg-white text-black dark:bg-[#333333] dark:text-white'
                                                        : 'text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white'
                                                        }`}
                                                    onClick={() => setActiveEditorTab('scorecard')}
                                                >
                                                    <ClipboardCheck size={16} className="mr-2" />
                                                    Scorecard
                                                </button>
                                            )}
                                            <button
                                                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer ${activeEditorTab === 'knowledge'
                                                    ? 'bg-white text-black dark:bg-[#333333] dark:text-white'
                                                    : 'text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white'
                                                    }`}
                                                onClick={() => setActiveEditorTab('knowledge')}
                                            >
                                                <BookOpen size={16} className="mr-2" />
                                                AI training resources
                                            </button>
                                        </div>
                                    </div>

                                    {/* Editor Content */}
                                    <div className="flex-1 overflow-hidden">
                                        {/* Show content based on active tab */}
                                        {activeEditorTab === 'question' ? (
                                            <div className="w-full h-full flex flex-col">
                                                {/* Integration */}
                                                {!readOnly && (
                                                    <div className="py-2 bg-white dark:bg-transparent">
                                                        <NotionIntegration
                                                            key={`notion-integration-${currentQuestionIndex}`}
                                                            onPageSelect={handleIntegrationPageSelect}
                                                            onPageRemove={handleIntegrationPageRemove}
                                                            isEditMode={!readOnly}
                                                            editorContent={currentQuestionContent}
                                                            loading={isLoadingIntegration}
                                                            status={status}
                                                            storedBlocks={integrationBlocks}
                                                            onContentUpdate={(updatedContent) => {
                                                                handleQuestionContentChange(updatedContent);
                                                                setIntegrationBlocks(updatedContent.find(block => block.type === 'notion')?.content || []);
                                                            }}
                                                            onLoadingChange={setIsLoadingIntegration}
                                                        />
                                                    </div>
                                                )}
                                                <div className={`editor-container h-full overflow-y-auto overflow-hidden relative z-0 ${highlightedField === 'question' ? 'm-2 outline outline-2 outline-red-400 shadow-md shadow-red-900/50 animate-pulse bg-red-50 dark:bg-[#2D1E1E]' : ''}`}>
                                                    {isLoadingIntegration ? (
                                                        <div className="flex items-center justify-center h-32">
                                                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-black dark:border-white"></div>
                                                        </div>
                                                    ) : integrationError ? (
                                                        <div className="flex flex-col items-center justify-center h-32 text-center">
                                                            <div className="text-red-400 text-sm mb-4">
                                                                {integrationError}
                                                            </div>
                                                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                                                The Notion integration may have been disconnected. Please reconnect it.
                                                            </div>
                                                        </div>
                                                    ) : integrationBlocks.length > 0 ? (
                                                        <div className="px-16 pb-6 rounded-lg bg-white text-black dark:bg-[#191919] dark:text-white">
                                                            <h1 className="text-4xl font-bold mb-4 pl-0.5 text-black dark:text-white">{integrationBlock?.props?.resource_name}</h1>
                                                            <RenderConfig theme={isDarkMode ? "dark" : "light"}>       
                                                                <BlockList blocks={integrationBlocks} />
                                                            </RenderConfig>
                                                        </div>
                                                    ) : integrationBlock ? (
                                                        <div className="flex flex-col items-center justify-center h-64 text-center">
                                                            <div className="text-lg mb-2 text-black dark:text-white">Notion page is empty</div>
                                                            <div className="text-sm text-gray-600 dark:text-white">Please add content to your Notion page and refresh to see changes</div>
                                                        </div>
                                                    ) : (
                                                        <BlockNoteEditor
                                                            key={`quiz-editor-question-${currentQuestionIndex}`}
                                                            initialContent={initialContent}
                                                            onChange={handleQuestionContentChange}
                                                            readOnly={readOnly}
                                                            onEditorReady={setEditorInstance}
                                                            className="quiz-editor"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ) : activeEditorTab === 'answer' ? (
                                            <div className="w-full h-full flex flex-col">
                                                <div className={`editor-container h-full overflow-y-auto overflow-hidden relative z-0 ${highlightedField === 'answer' ? 'm-2 outline outline-2 outline-red-400 shadow-md shadow-red-900/50 animate-pulse bg-red-50 dark:bg-[#2D1E1E]' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Ensure the correct answer editor keeps focus
                                                        if (correctAnswerEditorRef.current) {
                                                            try {
                                                                // Try to focus the editor
                                                                correctAnswerEditorRef.current.focusEditor();
                                                            } catch (err) {
                                                                console.error("Error focusing correct answer editor:", err);
                                                            }
                                                        }
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                    }}
                                                >
                                                    <BlockNoteEditor
                                                        key={`correct-answer-editor-${currentQuestionIndex}`}
                                                        initialContent={currentQuestionConfig.correctAnswer}
                                                        onChange={handleCorrectAnswerChange}
                                                        readOnly={readOnly}
                                                        onEditorReady={setCorrectAnswerEditorInstance}
                                                        className="correct-answer-editor"
                                                        placeholder="Enter the correct answer here"
                                                        allowMedia={false}
                                                    />
                                                </div>
                                            </div>
                                        ) : activeEditorTab === 'knowledge' ? (
                                                            <KnowledgeBaseEditor
                                                                knowledgeBaseBlocks={currentQuestionConfig.knowledgeBaseBlocks || []}
                                                                linkedMaterialIds={currentQuestionConfig.linkedMaterialIds || []}
                                                                courseId={courseId}
                                                                readOnly={readOnly}
                                                                onKnowledgeBaseChange={(knowledgeBaseBlocks) => {
                                                                    // Update the question config with the new knowledge base blocks
                                                                    const updatedQuestions = [...questions];
                                                                    updatedQuestions[currentQuestionIndex] = {
                                                                        ...updatedQuestions[currentQuestionIndex],
                                                                        config: {
                                                                            ...updatedQuestions[currentQuestionIndex].config,
                                                                            knowledgeBaseBlocks: knowledgeBaseBlocks
                                                                        }
                                                                    };
                                                                    setQuestions(updatedQuestions);
                                                                    if (onChange) {
                                                                        onChange(updatedQuestions);
                                                                    }
                                                                }}
                                                                onLinkedMaterialsChange={(linkedMaterialIds) => {
                                                                    // Update the question config with the new linked material IDs
                                                                    const updatedQuestions = [...questions];
                                                                    updatedQuestions[currentQuestionIndex] = {
                                                                        ...updatedQuestions[currentQuestionIndex],
                                                                        config: {
                                                                            ...updatedQuestions[currentQuestionIndex].config,
                                                                            linkedMaterialIds: linkedMaterialIds
                                                                        }
                                                                    };
                                                                    setQuestions(updatedQuestions);
                                                                    if (onChange) {
                                                                        onChange(updatedQuestions);
                                                                    }
                                                                }}
                                                                className="question"
                                                            />
                                        ) : (
                                            // Scorecard tab - use ScorecardManager component
                                            <div className="h-full w-full bg-white dark:bg-transparent">
                                                <ScorecardManager
                                                    key={`scorecard-manager-${questions[currentQuestionIndex]?.id || currentQuestionIndex}`}
                                                    ref={scorecardManagerRef}
                                                    schoolId={schoolId}
                                                    readOnly={readOnly}
                                                    initialScorecardData={currentQuestionConfig.scorecardData}
                                                    scorecardId={currentQuestionConfig.scorecardData?.id}
                                                    type="quiz"
                                                    allQuestions={questions}
                                                    currentQuestionIndex={currentQuestionIndex}
                                                    onScorecardChange={(scorecardData) => {
                                                        // Update the current question's scorecard
                                                        handleConfigChange({
                                                            scorecardData: scorecardData
                                                        });

                                                        // If scorecard data exists and is linked, sync all linked scorecards
                                                        if (scorecardData && !scorecardData.new) {
                                                            syncLinkedScorecards(scorecardData.id, scorecardData.name, scorecardData.criteria);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Toast for language combination validation */}
            <Toast
                show={showToast}
                title={toastTitle}
                description={toastMessage}
                emoji={toastEmoji}
                onClose={() => setShowToast(false)}
            />
        </div>
    );
});

QuizEditor.displayName = 'QuizEditor';
export default QuizEditor;