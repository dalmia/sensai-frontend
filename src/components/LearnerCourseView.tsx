import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { ModuleItem, Module } from "@/types/course";
import CourseModuleList from "./CourseModuleList";
import dynamic from "next/dynamic";
import { X, CheckCircle, BookOpen, HelpCircle, Clipboard, ChevronLeft, ChevronRight, Menu, FileText, Brain, ClipboardList, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import confetti from "canvas-confetti";
import SuccessSound from "./SuccessSound";
import ModuleCompletionSound from "./ModuleCompletionSound";
import ConfirmationDialog from "./ConfirmationDialog";

// Dynamically import viewer components to avoid SSR issues
const DynamicLearningMaterialViewer = dynamic(
    () => import("./LearningMaterialViewer"),
    { ssr: false }
);

// Dynamic import for LearnerQuizView
const DynamicLearnerQuizView = dynamic(
    () => import("./LearnerQuizView"),
    { ssr: false }
);

interface LearnerCourseViewProps {
    modules: Module[];
    completedTaskIds?: Record<string, boolean>;
    completedQuestionIds?: Record<string, Record<string, boolean>>;
    onTaskComplete?: (taskId: string, isComplete: boolean) => void;
    onQuestionComplete?: (taskId: string, questionId: string, isComplete: boolean) => void;
    onDialogClose?: () => void;
    viewOnly?: boolean;
    learnerId?: string;
    isTestMode?: boolean;
    isAdminView?: boolean;
}

export default function LearnerCourseView({
    modules,
    completedTaskIds = {},
    completedQuestionIds = {},
    onTaskComplete,
    onQuestionComplete,
    onDialogClose,
    isTestMode = false,
    viewOnly = false,
    learnerId = '',
    isAdminView = false,
}: LearnerCourseViewProps) {
    // Get user from auth context
    const { user } = useAuth();
    const userId = viewOnly ? learnerId : user?.id || '';

    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [activeItem, setActiveItem] = useState<any>(null);
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    // Track completed tasks - initialize with props
    const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(completedTaskIds);
    // Track completed questions within quizzes - initialize with structure that will be populated
    const [completedQuestions, setCompletedQuestions] = useState<Record<string, boolean>>({});
    // Add state to track when task is being marked as complete
    const [isMarkingComplete, setIsMarkingComplete] = useState(false);
    // Add state for completedQuestionIds to manage the nested structure
    const [localCompletedQuestionIds, setLocalCompletedQuestionIds] = useState<Record<string, Record<string, boolean>>>(completedQuestionIds);
    const dialogTitleRef = useRef<HTMLHeadingElement>(null);
    const dialogContentRef = useRef<HTMLDivElement>(null);
    // Add a ref to track if we've added a history entry
    const hasAddedHistoryEntryRef = useRef(false);

    // Add state for success message
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    // Add state for sound
    const [playSuccessSound, setPlaySuccessSound] = useState(false);
    // Add state for module completion sound
    const [playModuleCompletionSound, setPlayModuleCompletionSound] = useState(false);

    // Add state for AI responding status and confirmation dialog
    const [isAiResponding, setIsAiResponding] = useState(false);
    const [showNavigationConfirmation, setShowNavigationConfirmation] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<{ action: string; params?: any }>({ action: '' });

    // Add state for mobile sidebar visibility
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // List of encouragement messages
    const encouragementMessages = [
        "Great job! 🎯",
        "You're crushing it! 💪",
        "Keep it up! 🚀",
        "Excellent work! ⭐",
        "Knowledge gained! 📚",
        "You're making progress! 🌱",
        "Achievement unlocked! 🏆",
        "Learning mastered! 🧠",
        "Skill acquired! ✨"
    ];

    // Function to select a random encouragement message
    const getRandomMessage = () => {
        const randomIndex = Math.floor(Math.random() * encouragementMessages.length);
        return encouragementMessages[randomIndex];
    };

    // Update completedTasks when completedTaskIds prop changes
    useEffect(() => {
        setCompletedTasks(completedTaskIds);
    }, [completedTaskIds]);

    // Update localCompletedQuestionIds when completedQuestionIds prop changes
    useEffect(() => {
        setLocalCompletedQuestionIds(completedQuestionIds);
    }, [completedQuestionIds]);

    // Process completedQuestionIds into the format expected by this component
    useEffect(() => {
        // Convert the nested structure to a flat structure with keys like "questionId"
        const flatQuestionCompletions: Record<string, boolean> = {};

        Object.entries(localCompletedQuestionIds).forEach(([taskId, questions]) => {
            Object.entries(questions).forEach(([questionId, isComplete]) => {
                flatQuestionCompletions[questionId] = isComplete;
            });
        });

        setCompletedQuestions(flatQuestionCompletions);
    }, [localCompletedQuestionIds]);

    // Filter out draft items from modules in both preview and learner view
    const modulesWithFilteredItems = modules.map(module => ({
        ...module,
        items: module.items.filter(item => item.status !== 'draft')
    })) as Module[];

    // Filter out empty modules (those with no items after filtering)
    const filteredModules = modulesWithFilteredItems.filter(module => module.items.length > 0);

    // Calculate progress for each module based on completed tasks
    const modulesWithProgress = filteredModules.map(module => {
        // Get the total number of items in the module
        const totalItems = module.items.length;

        // If there are no items, progress is 0
        if (totalItems === 0) {
            return { ...module, progress: 0 };
        }

        // Count completed items in this module
        const completedItemsCount = module.items.filter(item =>
            completedTasks[item.id] === true
        ).length;

        // Calculate progress percentage
        const progress = Math.round((completedItemsCount / totalItems) * 100);

        return { ...module, progress };
    });

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev => ({
            ...prev,
            [moduleId]: !prev[moduleId]
        }));
    };

    // Handle browser history for dialog
    useEffect(() => {
        // Handler for back button
        const handlePopState = (event: PopStateEvent) => {
            // If dialog is open, close it
            if (isDialogOpen) {
                event.preventDefault();
                closeDialog();
            }
        };

        // If dialog is opened, add history entry
        if (isDialogOpen && !hasAddedHistoryEntryRef.current) {
            window.history.pushState({ dialog: true }, "");
            hasAddedHistoryEntryRef.current = true;
            window.addEventListener("popstate", handlePopState);
        }

        // Cleanup
        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [isDialogOpen]);

    // Function to close the dialog
    const closeDialog = () => {
        // If AI is responding, show confirmation dialog
        if (isAiResponding) {
            setPendingNavigation({ action: 'close' });
            setShowNavigationConfirmation(true);
            return;
        }

        // Proceed with closing
        setIsDialogOpen(false);
        setActiveItem(null);
        setActiveModuleId(null);
        setActiveQuestionId(null);
        // Reset sidebar state
        setIsSidebarOpen(false);

        // Reset history entry flag when dialog is closed
        hasAddedHistoryEntryRef.current = false;

        // Call the onDialogClose callback if provided
        if (onDialogClose) {
            onDialogClose();
        }
    };

    // Function to handle navigation confirmation
    const handleNavigationConfirm = () => {
        setShowNavigationConfirmation(false);

        // Execute the pending navigation action
        switch (pendingNavigation.action) {
            case 'close':
                setIsDialogOpen(false);
                setActiveItem(null);
                setActiveModuleId(null);
                setActiveQuestionId(null);
                hasAddedHistoryEntryRef.current = false;
                if (onDialogClose) {
                    onDialogClose();
                }
                break;
            case 'nextTask':
                executeGoToNextTask();
                break;
            case 'prevTask':
                executeGoToPreviousTask();
                break;
            case 'activateQuestion':
                if (pendingNavigation.params?.questionId) {
                    executeActivateQuestion(pendingNavigation.params.questionId);
                }
                break;
            case 'openTaskItem':
                if (pendingNavigation.params?.moduleId && pendingNavigation.params?.itemId) {
                    executeOpenTaskItem(
                        pendingNavigation.params.moduleId,
                        pendingNavigation.params.itemId,
                        pendingNavigation.params?.questionId
                    );
                }
                break;
            default:
                break;
        }
    };

    // Function to cancel navigation
    const handleNavigationCancel = () => {
        setShowNavigationConfirmation(false);
        setPendingNavigation({ action: '' });
    };

    // Function to activate a specific question in a quiz or exam
    const activateQuestion = (questionId: string) => {
        if (isAiResponding && questionId !== activeQuestionId) {
            setPendingNavigation({
                action: 'activateQuestion',
                params: { questionId }
            });
            setShowNavigationConfirmation(true);
            return;
        }

        executeActivateQuestion(questionId);
    };

    // Execute question activation (without checks)
    const executeActivateQuestion = (questionId: string) => {
        setActiveQuestionId(questionId);
    };

    // Function to open a task item and fetch its details
    const openTaskItem = async (moduleId: string, itemId: string, questionId?: string) => {
        // Check if AI is responding and we're trying to open a different item
        if (isAiResponding && (moduleId !== activeModuleId || itemId !== activeItem?.id || questionId !== activeQuestionId)) {
            setPendingNavigation({
                action: 'openTaskItem',
                params: { moduleId, itemId, questionId }
            });
            setShowNavigationConfirmation(true);
            return;
        }

        executeOpenTaskItem(moduleId, itemId, questionId);
    };

    // Execute open task item (without checks)
    const executeOpenTaskItem = async (moduleId: string, itemId: string, questionId?: string) => {
        // Reset sidebar state when opening a new task
        setIsSidebarOpen(false);
        setIsLoading(true);
        try {
            // Find the item in the modules
            const module = filteredModules.find(m => m.id === moduleId);
            if (!module) return;

            const item = module.items.find(i => i.id === itemId);
            if (!item) return;

            // Fetch item details from API
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${itemId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch task: ${response.status}`);
            }

            const data = await response.json();

            // Create an updated item with the fetched data
            let updatedItem;
            if (item.type === 'material') {
                updatedItem = {
                    ...item,
                    content: data.blocks || []
                };
            } else if (item.type === 'quiz') {
                // Ensure questions have the right format for the QuizEditor component
                const formattedQuestions = (data.questions || []).map((q: any) => {
                    // Create a properly formatted question object
                    return {
                        id: q.id || `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        blocks: q.blocks || [], // Keep the original blocks property
                        content: q.blocks || [], // Also add as content for compatibility
                        config: {
                            inputType: q.input_type,
                            responseType: q.response_type,
                            correctAnswer: q.answer,
                            questionType: q.type,
                            codingLanguages: q.coding_languages || [],
                            title: q.title,
                            scorecardData: {
                                id: q.scorecard_id,
                            }
                        }
                    };
                });

                updatedItem = {
                    ...item,
                    questions: formattedQuestions
                };

                // Set active question ID if provided, otherwise set to first question
                if (questionId) {
                    setActiveQuestionId(questionId);
                } else if (formattedQuestions.length > 0) {
                    setActiveQuestionId(formattedQuestions[0].id);
                }
            } else {
                updatedItem = item;
            }

            setActiveItem(updatedItem);
            setActiveModuleId(moduleId);
            setIsDialogOpen(true);
        } catch (error) {
            console.error("Error fetching task:", error);
            // Still open dialog with existing item data if fetch fails
            const module = filteredModules.find(m => m.id === moduleId);
            if (!module) return;

            const item = module.items.find(i => i.id === itemId);
            if (item) {
                setActiveItem(item);
                setActiveModuleId(moduleId);
                setIsDialogOpen(true);

                // Set first question as active if it's a quiz
                if ((item.type === 'quiz') &&
                    item.questions && item.questions.length > 0) {
                    setActiveQuestionId(questionId || item.questions[0].id);
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Function to navigate to the next task
    const goToNextTask = () => {
        if (!activeItem || !activeModuleId) return;

        // If AI is responding, show confirmation dialog
        if (isAiResponding) {
            setPendingNavigation({ action: 'nextTask' });
            setShowNavigationConfirmation(true);
            return;
        }

        executeGoToNextTask();
    };

    // Execute go to next task (without checks)
    const executeGoToNextTask = () => {
        if (!activeItem || !activeModuleId) return;

        // If this is a quiz with questions and not on the last question, go to next question
        if ((activeItem.type === 'quiz') &&
            activeItem.questions &&
            activeItem.questions.length > 1 &&
            activeQuestionId) {

            const currentIndex = activeItem.questions.findIndex((q: any) => q.id === activeQuestionId);
            if (currentIndex < activeItem.questions.length - 1) {
                // Go to next question
                const nextQuestion = activeItem.questions[currentIndex + 1];
                executeActivateQuestion(nextQuestion.id);
                return;
            }
        }

        // Otherwise, go to next task in module
        const currentModule = filteredModules.find(m => m.id === activeModuleId);
        if (!currentModule) return;

        // Find the index of the current task in the module
        const currentTaskIndex = currentModule.items.findIndex(item => item.id === activeItem.id);
        if (currentTaskIndex === -1) return;

        // Check if there's a next task in this module
        if (currentTaskIndex < currentModule.items.length - 1) {
            // Navigate to the next task in the same module
            const nextTask = currentModule.items[currentTaskIndex + 1];
            executeOpenTaskItem(activeModuleId, nextTask.id);
        }
    };

    // Function to navigate to the previous task
    const goToPreviousTask = () => {
        if (!activeItem || !activeModuleId) return;

        // If AI is responding, show confirmation dialog
        if (isAiResponding) {
            setPendingNavigation({ action: 'prevTask' });
            setShowNavigationConfirmation(true);
            return;
        }

        executeGoToPreviousTask();
    };

    // Execute go to previous task (without checks)
    const executeGoToPreviousTask = () => {
        if (!activeItem || !activeModuleId) return;

        // If this is a quiz with questions and not on the first question, go to previous question
        if ((activeItem.type === 'quiz') &&
            activeItem.questions &&
            activeItem.questions.length > 1 &&
            activeQuestionId) {

            const currentIndex = activeItem.questions.findIndex((q: any) => q.id === activeQuestionId);
            if (currentIndex > 0) {
                // Go to previous question
                const prevQuestion = activeItem.questions[currentIndex - 1];
                executeActivateQuestion(prevQuestion.id);
                return;
            }
        }

        // Otherwise, go to previous task in module
        const currentModule = filteredModules.find(m => m.id === activeModuleId);
        if (!currentModule) return;

        // Find the index of the current task in the module
        const currentTaskIndex = currentModule.items.findIndex(item => item.id === activeItem.id);
        if (currentTaskIndex === -1) return;

        // Check if there's a previous task in this module
        if (currentTaskIndex > 0) {
            // Navigate to the previous task in the same module
            const previousTask = currentModule.items[currentTaskIndex - 1];
            executeOpenTaskItem(activeModuleId, previousTask.id);
        }
    };

    // Function to check if a module is now fully completed
    const checkModuleCompletion = (moduleId: string, newCompletedTasks: Record<string, boolean>) => {
        const module = filteredModules.find(m => m.id === moduleId);
        if (!module) return false;

        // Check if all items in the module are now completed
        const allTasksCompleted = module.items.every(item => newCompletedTasks[item.id] === true);

        // If all tasks are completed and there's at least one task, this is a module completion
        return allTasksCompleted && module.items.length > 0;
    };

    // Function to handle quiz answer submission
    const handleQuizAnswerSubmit = useCallback((questionId: string, answer: string) => {
        // Mark the question as completed
        setCompletedQuestions(prev => ({
            ...prev,
            [questionId]: true
        }));

        // Check if all questions in the current quiz are now completed
        if (activeItem?.type === 'quiz') {
            const allQuestions = activeItem.questions || [];

            // Also update the nested completedQuestionIds structure to match our UI display
            setLocalCompletedQuestionIds(prev => {
                const updatedQuestionIds = { ...prev };

                // Initialize the object for this task if it doesn't exist
                if (!updatedQuestionIds[activeItem.id]) {
                    updatedQuestionIds[activeItem.id] = {};
                }

                // Mark this question as complete
                updatedQuestionIds[activeItem.id] = {
                    ...updatedQuestionIds[activeItem.id],
                    [questionId]: true
                };

                return updatedQuestionIds;
            });

            // Notify parent component about question completion
            if (onQuestionComplete) {
                onQuestionComplete(activeItem.id, questionId, true);
            }

            // If this is a single question quiz, mark the entire task as complete
            if (allQuestions.length <= 1) {
                const newCompletedTasks = {
                    ...completedTasks,
                    [activeItem.id]: true
                };

                setCompletedTasks(newCompletedTasks);

                // Notify parent component about task completion
                if (onTaskComplete) {
                    onTaskComplete(activeItem.id, true);
                }

                // Check if this task completion has completed the entire module
                if (activeModuleId && checkModuleCompletion(activeModuleId, newCompletedTasks)) {
                    // This completes the module - trigger the enhanced celebration
                    triggerModuleCompletionCelebration();
                } else {
                    // Standard celebration for task completion
                    triggerConfetti(true); // Full celebration for single question quiz completion
                }
            } else {
                // For multi-question quiz, check if all questions are now completed
                const areAllQuestionsCompleted = allQuestions.every(
                    (q: any) => completedQuestions[q.id] || q.id === questionId
                );

                if (areAllQuestionsCompleted) {
                    const newCompletedTasks = {
                        ...completedTasks,
                        [activeItem.id]: true
                    };

                    setCompletedTasks(newCompletedTasks);

                    // Notify parent component about task completion
                    if (onTaskComplete) {
                        onTaskComplete(activeItem.id, true);
                    }

                    // Check if this task completion has completed the entire module
                    if (activeModuleId && checkModuleCompletion(activeModuleId, newCompletedTasks)) {
                        // This completes the module - trigger the enhanced celebration
                        triggerModuleCompletionCelebration();
                    } else {
                        // Standard celebration for task completion
                        triggerConfetti(true); // Full celebration for completing entire quiz
                    }
                } else {
                    // Trigger light confetti for individual question completion
                    triggerConfetti(false); // Light celebration for single question completion
                }
            }
        }
    }, [activeItem, activeModuleId, completedTasks, completedQuestions, onTaskComplete, onQuestionComplete]);

    // Function to mark task as completed
    const markTaskComplete = async () => {
        if (viewOnly || !activeItem || !activeModuleId || !userId) return;

        // Set loading state to true to show spinner
        setIsMarkingComplete(true);

        try {
            // Store chat message for learning material completion
            // This is similar to the chat message storage in LearnerQuizView
            // but we only send a user message, not an AI response
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${activeItem.id}/complete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: parseInt(userId) })
                });

                if (!response.ok) {
                    throw new Error('Failed to store learning material completion');
                }
            } catch (error) {
                console.error('Error storing learning material completion:', error);
                // Continue execution even if this fails - don't block the UI update
            }

            // Create updated completed tasks state
            const newCompletedTasks = {
                ...completedTasks,
                [activeItem.id]: true
            };

            // Mark the task as completed in our local state
            setCompletedTasks(newCompletedTasks);

            // Call the onTaskComplete callback to notify parent component
            if (onTaskComplete) {
                onTaskComplete(activeItem.id, true);
            }

            // Check if this task completion has completed the entire module
            if (checkModuleCompletion(activeModuleId, newCompletedTasks)) {
                // This completes the module - trigger the enhanced celebration
                triggerModuleCompletionCelebration();
            } else {
                // Regular completion celebration
                triggerConfetti(true);
            }

            // Find the current module
            const currentModule = filteredModules.find(m => m.id === activeModuleId);
            if (!currentModule) return;

            // Find the index of the current task in the module
            const currentTaskIndex = currentModule.items.findIndex(item => item.id === activeItem.id);
            if (currentTaskIndex === -1) return;

            // Check if there's a next task in this module
            if (currentTaskIndex < currentModule.items.length - 1) {
                // Navigate to the next task in the same module
                const nextTask = currentModule.items[currentTaskIndex + 1];
                openTaskItem(activeModuleId, nextTask.id);
            }
        } catch (error) {
            console.error("Error marking task as complete:", error);
        } finally {
            // Reset loading state
            setIsMarkingComplete(false);
        }
    };

    // Function to check if we're at the first task in the module
    const isFirstTask = () => {
        if (!activeItem || !activeModuleId) return false;

        // If this is a quiz with questions, check if we're on the first question
        if ((activeItem.type === 'quiz') &&
            activeItem.questions &&
            activeItem.questions.length > 1 &&
            activeQuestionId) {

            const currentIndex = activeItem.questions.findIndex((q: any) => q.id === activeQuestionId);
            if (currentIndex > 0) {
                // Not the first question, so return false
                return false;
            }
        }

        const currentModule = filteredModules.find(m => m.id === activeModuleId);
        if (!currentModule) return false;

        const currentTaskIndex = currentModule.items.findIndex(item => item.id === activeItem.id);
        return currentTaskIndex === 0;
    };

    // Function to check if we're at the last task in the module
    const isLastTask = () => {
        if (!activeItem || !activeModuleId) return false;

        // If this is a quiz with questions, check if we're on the last question
        if ((activeItem.type === 'quiz') &&
            activeItem.questions &&
            activeItem.questions.length > 1 &&
            activeQuestionId) {

            const currentIndex = activeItem.questions.findIndex((q: any) => q.id === activeQuestionId);
            if (currentIndex < activeItem.questions.length - 1) {
                // Not the last question, so return false
                return false;
            }
        }

        const currentModule = filteredModules.find(m => m.id === activeModuleId);
        if (!currentModule) return false;

        const currentTaskIndex = currentModule.items.findIndex(item => item.id === activeItem.id);
        return currentTaskIndex === currentModule.items.length - 1;
    };

    // Handle Escape key to close dialog
    const handleKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
        if (e.key === 'Escape') {
            closeDialog();
        }
    };

    // Handle click outside dialog to close it
    const handleDialogBackdropClick = (e: React.MouseEvent) => {
        // Only close if clicking directly on the backdrop, not on the dialog content
        if (dialogContentRef.current && !dialogContentRef.current.contains(e.target as Node)) {
            closeDialog();
        }
    };

    // Function to get previous task info
    const getPreviousTaskInfo = () => {
        if (!activeItem || !activeModuleId) return null;

        // If this is a quiz with questions and not on the first question, get previous question info
        if ((activeItem.type === 'quiz') &&
            activeItem.questions &&
            activeItem.questions.length > 1 &&
            activeQuestionId) {

            const currentIndex = activeItem.questions.findIndex((q: any) => q.id === activeQuestionId);
            if (currentIndex > 0) {
                // Return previous question info
                return {
                    type: 'question',
                    title: `Question ${currentIndex}`
                };
            }
        }

        // Get previous task in module
        const currentModule = filteredModules.find(m => m.id === activeModuleId);
        if (!currentModule) return null;

        // Find the index of the current task in the module
        const currentTaskIndex = currentModule.items.findIndex(item => item.id === activeItem.id);
        if (currentTaskIndex <= 0) return null;

        // Return previous task info
        const previousTask = currentModule.items[currentTaskIndex - 1];
        return {
            type: 'task',
            title: previousTask.title
        };
    };

    // Function to get next task info
    const getNextTaskInfo = () => {
        if (!activeItem || !activeModuleId) return null;

        // If this is a quiz with questions and not on the last question, get next question info
        if ((activeItem.type === 'quiz') &&
            activeItem.questions &&
            activeItem.questions.length > 1 &&
            activeQuestionId) {

            const currentIndex = activeItem.questions.findIndex((q: any) => q.id === activeQuestionId);
            if (currentIndex < activeItem.questions.length - 1) {
                // Return next question info
                return {
                    type: 'question',
                    title: `Question ${currentIndex + 2}`
                };
            }
        }

        // Get next task in module
        const currentModule = filteredModules.find(m => m.id === activeModuleId);
        if (!currentModule) return null;

        // Find the index of the current task in the module
        const currentTaskIndex = currentModule.items.findIndex(item => item.id === activeItem.id);
        if (currentTaskIndex === -1 || currentTaskIndex >= currentModule.items.length - 1) return null;

        // Return next task info
        const nextTask = currentModule.items[currentTaskIndex + 1];
        return {
            type: 'task',
            title: nextTask.title
        };
    };

    // Handle AI responding state change from quiz view
    const handleAiRespondingChange = useCallback((isResponding: boolean) => {
        setIsAiResponding(isResponding);
    }, []);

    // Function to trigger confetti animation
    const triggerConfetti = (isFullCompletion = true) => {
        // Trigger confetti effect with different intensity based on completion type
        confetti({
            particleCount: isFullCompletion ? 100 : 50,
            spread: isFullCompletion ? 70 : 40,
            origin: { y: 0.6 },
            colors: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'],
            zIndex: 9999
        });

        // Play success sound
        setPlaySuccessSound(true);

        // Reset sound trigger after a short delay
        setTimeout(() => {
            setPlaySuccessSound(false);
        }, 300);
    };

    // Function to trigger a more extravagant confetti celebration for module completion
    const triggerModuleCompletionCelebration = () => {
        // Get random confetti origin points for a more dynamic effect
        const generateRandomOrigin = () => ({
            x: 0.2 + Math.random() * 0.6, // Random x value between 0.2 and 0.8
            y: 0.2 + Math.random() * 0.4  // Random y value between 0.2 and 0.6
        });

        // First wave - center burst (larger particles)
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'],
            zIndex: 9999,
            scalar: 1.5 // Larger particles
        });

        // Second wave - left side burst (with gravity)
        setTimeout(() => {
            confetti({
                particleCount: 80,
                angle: 60,
                spread: 70,
                origin: { x: 0, y: 0.5 },
                colors: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'],
                zIndex: 9999,
                gravity: 1.2,
                drift: 2
            });
        }, 200);

        // Third wave - right side burst (with gravity)
        setTimeout(() => {
            confetti({
                particleCount: 80,
                angle: 120,
                spread: 70,
                origin: { x: 1, y: 0.5 },
                colors: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'],
                zIndex: 9999,
                gravity: 1.2,
                drift: -2
            });
        }, 400);

        // Fourth wave - random bursts for 2 seconds
        let burstCount = 0;
        const maxBursts = 5;
        const burstInterval = setInterval(() => {
            if (burstCount >= maxBursts) {
                clearInterval(burstInterval);
                return;
            }

            confetti({
                particleCount: 30,
                spread: 80,
                origin: generateRandomOrigin(),
                colors: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'],
                zIndex: 9999
            });

            burstCount++;
        }, 300);

        // Play the more impressive module completion sound
        setPlayModuleCompletionSound(true);

        // Reset sound trigger after the sound duration
        setTimeout(() => {
            setPlayModuleCompletionSound(false);
        }, 2000); // Longer timeout for the longer sound
    };

    // Initialize expandedModules from the isExpanded property of modules
    useEffect(() => {
        if (modules && modules.length > 0) {
            const initialExpandedState: Record<string, boolean> = {};
            modules.forEach(module => {
                if (module.isExpanded && !module.unlockAt) {
                    initialExpandedState[module.id] = true;
                }
            });

            // Only set if there are any expanded modules to avoid unnecessary state updates
            if (Object.keys(initialExpandedState).length > 0) {
                setExpandedModules(initialExpandedState);
            }
        }
    }, [modules]);

    // Toggle sidebar visibility for mobile
    const toggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    return (
        <div className="bg-black">
            {filteredModules.length > 0 ? (
                <CourseModuleList
                    modules={modulesWithProgress}
                    mode="view"
                    expandedModules={expandedModules}
                    onToggleModule={toggleModule}
                    onOpenItem={openTaskItem}
                    completedTaskIds={completedTasks}
                    completedQuestionIds={localCompletedQuestionIds}
                />
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div>
                        <h2 className="text-4xl font-light mb-4 text-white">
                            Your learning adventure awaits!
                        </h2>
                        <p className="text-gray-400 mb-8">
                            This course is still being crafted with care. Check back soon to begin your journey.
                        </p>
                    </div>
                </div>
            )}

            {/* Success Sound */}
            <SuccessSound play={playSuccessSound} />

            {/* Module Completion Sound */}
            <ModuleCompletionSound play={playModuleCompletionSound} />

            {/* Navigation Confirmation Dialog */}
            <ConfirmationDialog
                open={showNavigationConfirmation}
                title="AI is still responding"
                message="The AI is still generating a response. If you navigate away now, you will not see the complete response. Are you sure you want to leave?"
                confirmButtonText="Leave anyway"
                cancelButtonText="Stay"
                onConfirm={handleNavigationConfirm}
                onCancel={handleNavigationCancel}
                type="custom"
            />

            {/* Task Viewer Dialog - Using the same pattern as the editor view */}
            {isDialogOpen && activeItem && (
                <div
                    className="fixed inset-0 bg-black z-50 overflow-hidden"
                    onClick={handleDialogBackdropClick}
                >
                    <div
                        ref={dialogContentRef}
                        className="w-full h-full flex flex-row"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Mobile overlay - only shown when sidebar is open on mobile */}
                        {isSidebarOpen && (
                            <div
                                className="fixed inset-0 z-10"
                                onClick={toggleSidebar}
                                style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
                                aria-label="Close sidebar overlay"
                            ></div>
                        )}

                        {/* Sidebar with module tasks - hidden on mobile by default */}
                        <div className={`${isSidebarOpen ? 'absolute inset-0' : 'hidden'} lg:relative lg:block w-64 h-full bg-[#121212] border-r border-gray-800 flex flex-col overflow-hidden z-10`}>
                            {/* Sidebar Header */}
                            <div className="p-4 border-b border-gray-800 bg-[#0A0A0A] flex items-center justify-between">
                                <h3 className="text-lg font-light text-white truncate">
                                    {filteredModules.find(m => m.id === activeModuleId)?.title || "Module"}
                                </h3>
                                {/* Close button for mobile sidebar */}
                                <button
                                    onClick={toggleSidebar}
                                    className={`lg:hidden mr-3 flex-shrink-0 mt-1 ${completedTasks[activeItem?.id]
                                        ? "text-white"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                    aria-label="Close sidebar"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                            </div>

                            {/* Task List */}
                            <div className="overflow-y-auto h-[calc(100vh-120px)]">
                                {activeModuleId && filteredModules.find(m => m.id === activeModuleId)?.items.map((item) => (
                                    <div key={item.id}>
                                        <div
                                            className={`px-4 py-2 cursor-pointer flex items-center ${item.id === activeItem.id &&
                                                (
                                                    (item.type !== 'quiz') ||
                                                    !activeItem?.questions ||
                                                    activeItem.questions.length <= 1
                                                )
                                                ? "bg-[#222222] border-l-2 border-green-500"
                                                : completedTasks[item.id]
                                                    ? "border-l-2 border-green-500 text-green-500"
                                                    : (item.type === 'quiz') &&
                                                        // Check if there are any completed questions for this quiz
                                                        localCompletedQuestionIds[item.id] &&
                                                        Object.keys(localCompletedQuestionIds[item.id]).some(qId => localCompletedQuestionIds[item.id][qId] === true)
                                                        ? "border-l-2 border-yellow-500"
                                                        : "hover:bg-[#1A1A1A] border-l-2 border-transparent"
                                                }`}
                                            onClick={() => openTaskItem(activeModuleId, item.id)}
                                        >
                                            <div className={`flex items-center mr-2}`}>
                                                {completedTasks[item.id] ? (
                                                    <div className="w-7 h-7 rounded-md flex items-center justify-center">
                                                        <CheckCircle size={16} className="text-green-500" />
                                                    </div>
                                                ) : item.type === 'material' ? (
                                                    <div className="w-7 h-7 rounded-md flex items-center justify-center">
                                                        <BookOpen size={16} className="text-blue-400" />
                                                    </div>
                                                ) : (
                                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center`}>
                                                        <ClipboardList size={16} className={
                                                            localCompletedQuestionIds[item.id] &&
                                                                Object.keys(localCompletedQuestionIds[item.id]).some(qId => localCompletedQuestionIds[item.id][qId] === true)
                                                                ? "text-yellow-500"
                                                                : "text-purple-500"
                                                        } />
                                                    </div>
                                                )}

                                                {/* Add a small generating indicator if the item is still being generated */}
                                                {item.isGenerating && (
                                                    <div className="ml-2 animate-pulse">
                                                        <Loader2 size={12} className="animate-spin text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`flex-1 text-sm ${completedTasks[item.id]
                                                ? "text-green-500"
                                                : (item.type === 'quiz') &&
                                                    // Match the same condition for the text color
                                                    localCompletedQuestionIds[item.id] &&
                                                    Object.keys(localCompletedQuestionIds[item.id]).some(qId => localCompletedQuestionIds[item.id][qId] === true)
                                                    ? "text-yellow-500"
                                                    : "text-gray-200"
                                                } truncate`}>
                                                {item.title}
                                            </div>
                                        </div>

                                        {/* Show questions as expanded items for active quiz */}
                                        {(item.type === 'quiz') &&
                                            item.id === activeItem?.id &&
                                            activeItem?.questions &&
                                            activeItem.questions.length > 1 && (
                                                <div className="pl-8 border-l border-gray-800">
                                                    {activeItem.questions.map((question: any, index: number) => (
                                                        <div
                                                            key={question.id}
                                                            className={`px-4 py-2 cursor-pointer flex items-center ${question.id === activeQuestionId
                                                                ? "bg-[#222222] border-l-2 border-green-500"
                                                                : completedQuestions[question.id]
                                                                    ? "border-l-2 border-green-500 text-green-500"
                                                                    : "hover:bg-[#1A1A1A] border-l-2 border-transparent"
                                                                }`}
                                                            onClick={() => activateQuestion(question.id)}
                                                        >
                                                            <div className={`flex items-center mr-2 ${completedQuestions[question.id] ? "text-green-500" : "text-gray-400"}`}>
                                                                {completedQuestions[question.id]
                                                                    && <CheckCircle size={14} />
                                                                }
                                                            </div>
                                                            <div className={`flex-1 text-sm ${completedQuestions[question.id] ? "text-green-500" : "text-gray-300"} break-words whitespace-normal min-w-0`}>
                                                                {question.config.title}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                    </div>
                                ))}
                            </div>

                            {/* Back to Course Button - hidden on mobile, fixed at bottom for laptop */}
                            <div className="hidden lg:block p-3 border-t border-gray-800 bg-[#121212] absolute bottom-0 left-0 right-0">
                                <button
                                    onClick={closeDialog}
                                    className="w-full flex items-center justify-center px-3 py-2 text-sm text-gray-300 hover:text-white bg-[#1A1A1A] hover:bg-[#222222] rounded transition-colors cursor-pointer"
                                >
                                    Back to course
                                </button>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 h-full flex flex-col bg-[#1A1A1A]">
                            {/* Dialog Header */}
                            <div
                                className={`flex items-start justify-between p-4 border-b border-gray-800 ${
                                    // Add background color for completed tasks on mobile
                                    (completedTasks[activeItem?.id])
                                        ? "lg:bg-[#111111] bg-green-700"
                                        : "bg-[#111111]"
                                    }`}
                            >
                                <div className="flex items-start">
                                    {/* Hamburger menu for mobile */}
                                    <button
                                        onClick={toggleSidebar}
                                        className={`lg:hidden mr-3 flex-shrink-0 mt-1 ${completedTasks[activeItem?.id]
                                            ? "text-white"
                                            : "text-gray-400 hover:text-white"
                                            }`}
                                        aria-label="Toggle sidebar"
                                    >
                                        <Menu size={20} />
                                    </button>
                                    <div className="flex flex-col min-w-0 pr-2">
                                        <div className="flex items-center mb-1">
                                            <h2
                                                ref={dialogTitleRef}
                                                contentEditable={false}
                                                suppressContentEditableWarning
                                                onKeyDown={handleKeyDown}
                                                className="text-xl sm:text-2xl lg:text-2xl font-light text-white outline-none break-words hyphens-auto"
                                            >
                                                {activeItem?.title}
                                            </h2>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                                    {/* Show completed status for learning material/quiz that has been completed */}
                                    {completedTasks[activeItem.id] && (
                                        <button
                                            className="hidden lg:flex items-center px-4 py-2 text-sm text-white bg-green-700 rounded-full transition-colors cursor-default"
                                            disabled
                                        >
                                            <CheckCircle size={16} className="mr-2" />
                                            Completed
                                        </button>
                                    )}

                                    {/* Mark Complete button for desktop */}
                                    {activeItem?.type === 'material' && !completedTasks[activeItem?.id] && !viewOnly && (
                                        <button
                                            onClick={markTaskComplete}
                                            className={`hidden lg:flex items-center px-4 py-2 text-sm text-white bg-transparent border !border-green-500 hover:bg-[#222222] focus:border-green-500 active:border-green-500 rounded-full transition-colors ${isMarkingComplete ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                                            aria-label="Mark complete"
                                            disabled={isMarkingComplete}
                                        >
                                            {isMarkingComplete ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle size={16} className="mr-2" />
                                                    Mark Complete
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={closeDialog}
                                        className={`transition-colors focus:outline-none cursor-pointer p-1 lg:hidden ${completedTasks[activeItem?.id]
                                            ? "text-white"
                                            : "text-gray-400 hover:text-white"
                                            }`}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Dialog Content */}
                            <div
                                className="flex-1 overflow-y-auto p-0 dialog-content-editor relative lg:pb-0 pb-[60px]"
                                style={{ height: 'calc(100vh - 140px)' }}
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                                    </div>
                                ) : (
                                    <>
                                        {activeItem?.type === 'material' && (
                                            <DynamicLearningMaterialViewer
                                                taskId={activeItem.id}
                                                userId={userId}
                                                readOnly={true}
                                                isDarkMode={true}
                                                onMarkComplete={!completedTasks[activeItem?.id] && !viewOnly ? markTaskComplete : undefined}
                                                viewOnly={viewOnly}
                                            />
                                        )}
                                        {(activeItem?.type === 'quiz') && (
                                            <>
                                                <DynamicLearnerQuizView
                                                    questions={activeItem.questions || []}
                                                    readOnly={true}
                                                    viewOnly={viewOnly}
                                                    currentQuestionId={activeQuestionId || undefined}
                                                    onQuestionChange={activateQuestion}
                                                    onSubmitAnswer={handleQuizAnswerSubmit}
                                                    userId={userId}
                                                    isTestMode={isTestMode}
                                                    taskId={activeItem.id}
                                                    completedQuestionIds={completedQuestions}
                                                    isDarkMode={true}
                                                    onAiRespondingChange={handleAiRespondingChange}
                                                    className={`${isSidebarOpen ? 'sidebar-visible' : ''}`}
                                                    isAdminView={isAdminView}
                                                />
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Navigation Footer - Hidden on mobile */}
                            <div className="hidden lg:flex items-center justify-between p-4 border-t border-gray-800 bg-[#111111]">
                                {!isFirstTask() && getPreviousTaskInfo() && (
                                    <button
                                        onClick={goToPreviousTask}
                                        className="flex items-center px-4 py-2 text-sm rounded-md transition-colors text-white hover:bg-gray-800 cursor-pointer"
                                    >
                                        <ChevronLeft size={16} className="mr-1" />
                                        {getPreviousTaskInfo()?.title}
                                    </button>
                                )}
                                {isFirstTask() && <div></div>}

                                {!isLastTask() && getNextTaskInfo() && (
                                    <button
                                        onClick={goToNextTask}
                                        className="flex items-center px-4 py-2 text-sm rounded-md transition-colors text-white hover:bg-gray-800 cursor-pointer"
                                    >
                                        {getNextTaskInfo()?.title}
                                        <ChevronRight size={16} className="ml-1" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Navigation Footer - Only visible on mobile */}
            {isDialogOpen && activeItem && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-gray-800 z-50 px-4 py-3 flex justify-between items-center max-h-[60px]">
                    {!isFirstTask() && getPreviousTaskInfo() ? (
                        <button
                            onClick={goToPreviousTask}
                            className="flex items-center px-4 py-2 text-sm rounded-md transition-colors text-white bg-[#222222] cursor-pointer"
                            aria-label="Previous task"
                        >
                            <ChevronLeft size={16} className="mr-1" />
                            <span className="max-w-[100px] truncate">{getPreviousTaskInfo()?.title}</span>
                        </button>
                    ) : (
                        <div></div>
                    )}

                    {!isLastTask() && getNextTaskInfo() ? (
                        <button
                            onClick={goToNextTask}
                            className="flex items-center px-4 py-2 text-sm rounded-md transition-colors text-white bg-[#222222] cursor-pointer"
                            aria-label="Next task"
                        >
                            <span className="max-w-[100px] truncate">{getNextTaskInfo()?.title}</span>
                            <ChevronRight size={16} className="ml-1" />
                        </button>
                    ) : (
                        <div></div>
                    )}
                </div>
            )}

            {/* Navigation Confirmation Dialog - Moved to end and z-index increased */}
            <ConfirmationDialog
                key="navigationConfirmationDialog"
                open={showNavigationConfirmation}
                title="What's the rush?"
                message="Our AI is still reviewing your answer and will be ready with a response soon. If you navigate away now, you will not see the complete response. Are you sure you want to leave?"
                confirmButtonText="Leave anyway"
                cancelButtonText="Stay"
                onConfirm={handleNavigationConfirm}
                onCancel={handleNavigationCancel}
                type="custom"
            />
        </div>
    );
} 