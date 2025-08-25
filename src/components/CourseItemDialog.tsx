"use client";

import { useRef, useEffect, useState } from "react";
import { Sparkles, Check, X, Pencil, Eye, Edit2, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { QuizQuestion } from "../types";
import type { LearningMaterialEditorHandle } from "./LearningMaterialEditor";
import type { QuizEditorHandle } from "../types";
import Toast from "./Toast";
import ConfirmationDialog from "./ConfirmationDialog";
import { TaskData } from "@/types";
import Tooltip from "./Tooltip";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatScheduleDate } from "@/lib/utils/dateFormat";
import { useAuth } from "@/lib/auth";

// Dynamically import the editor components
const DynamicLearningMaterialEditor = dynamic(
    () => import("./LearningMaterialEditor"),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-full w-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            </div>
        )
    }
);

// Dynamically import the QuizEditor component
const DynamicQuizEditor = dynamic(
    () => import("./QuizEditor"),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-full w-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            </div>
        )
    }
);

// Define props interface for the component
interface CourseItemDialogProps {
    isOpen: boolean;
    activeItem: any; // Using any for now, should be properly typed
    activeModuleId: string | null;
    isEditMode: boolean;
    isPreviewMode: boolean;
    showPublishConfirmation: boolean;
    dialogTitleRef: React.RefObject<HTMLHeadingElement | null>;
    dialogContentRef: React.RefObject<HTMLDivElement | null>;
    onClose: () => void;
    onPublishConfirm: () => void;
    onPublishCancel: () => void;
    onSetShowPublishConfirmation: (show: boolean) => void;
    onSaveItem: () => void;
    onCancelEditMode: () => void;
    onEnableEditMode: () => void;
    onQuizContentChange: (questions: QuizQuestion[]) => void;
    focusEditor: () => void;
    schoolId?: string; // School ID for fetching scorecards
    courseId?: string; // Add courseId prop for learning materials
}

const CourseItemDialog: React.FC<CourseItemDialogProps> = ({
    isOpen,
    activeItem,
    activeModuleId,
    isEditMode,
    isPreviewMode,
    showPublishConfirmation,
    dialogTitleRef,
    dialogContentRef,
    onClose,
    onPublishConfirm,
    onPublishCancel,
    onSetShowPublishConfirmation,
    onSaveItem,
    onCancelEditMode,
    onEnableEditMode,
    onQuizContentChange,
    focusEditor,
    schoolId,
    courseId,
}) => {
    // Add refs for the editor components
    const learningMaterialEditorRef = useRef<LearningMaterialEditorHandle>(null);
    const quizEditorRef = useRef<QuizEditorHandle>(null);

    // Ref to store toast timeout ID
    const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // State to track preview mode for quizzes
    const [quizPreviewMode, setQuizPreviewMode] = useState(false);

    // State for scheduled date
    const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
    const [showSchedulePicker, setShowSchedulePicker] = useState(false);

    // Toast state
    const [showToast, setShowToast] = useState(false);
    const [toastTitle, setToastTitle] = useState("Published");
    const [toastDescription, setToastDescription] = useState("");
    const [toastEmoji, setToastEmoji] = useState("🚀");

    // Add state for close confirmation dialog
    const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

    // Add a new state variable to track which type of confirmation is being shown
    const [confirmationType, setConfirmationType] = useState<'exit_edit_publish' | 'close' | 'exit_draft'>('exit_draft');

    // Add state for save confirmation dialog
    const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

    // State to track if quiz has questions (for publish/preview button visibility)
    const [hasQuizQuestions, setHasQuizQuestions] = useState(false);

    // Add state for unsaved scorecard confirmation dialog
    const [showUnsavedScorecardConfirmation, setShowUnsavedScorecardConfirmation] = useState(false);

    const [showUnsavedScorecardChangesInfo, setShowUnsavedScorecardChangesInfo] = useState(false);

    // Use useRef instead of useState for storing the pending action
    const pendingActionRef = useRef<(() => void) | null>(null);

    // Add a ref for the date picker container
    const datePickerRef = useRef<HTMLDivElement>(null);

    // Initialize scheduledDate when activeItem changes
    useEffect(() => {
        if (activeItem && activeItem.scheduled_publish_at) {
            setScheduledDate(new Date(activeItem.scheduled_publish_at));
        } else {
            setScheduledDate(null);
        }
    }, [activeItem]);

    // Function to validate scheduled date
    const verifyScheduledDateAndSchedule = (date: Date | null) => {
        if (!date) {
            return;
        }

        if (date < new Date()) {
            // Show error toast for dates in the past
            displayToast("Invalid Date", "Scheduled date cannot be in the past", "⚠️");
            return;
        }

        setScheduledDate(date);
    }

    // Reset quiz preview mode when dialog is closed
    useEffect(() => {
        if (!isOpen) {
            setQuizPreviewMode(false);

            // Clear any active toast timeout when dialog closes
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
                toastTimeoutRef.current = null;
            }

            // Reset toast state when dialog closes to prevent stuck toasts
            setShowToast(false);

            // Make sure to clear questions from active item when the dialog closes for draft quizzes
            if (activeItem &&
                activeItem.type === 'quiz' &&
                activeItem.status === 'draft') {

                console.log('Cleaning up draft quiz questions on dialog close');
                activeItem.questions = [];
            }
        } else if (isOpen) {
            // Add a new history entry when dialog opens to intercept back button
            const hasChanges = activeItem.type === 'material'
                ? learningMaterialEditorRef.current?.hasChanges() || false
                : quizEditorRef.current?.hasChanges() || false;
            
            setTimeout(() => {
                if (isEditMode || activeItem?.status === 'draft' || hasChanges) {
                    window.history.pushState({ dialogOpen: true }, '', window.location.href);
                }
            }, 100);

            // Reset toast state when dialog opens to prevent lingering toasts
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
                toastTimeoutRef.current = null;
            }
            setShowToast(false);

            // When dialog opens, ensure hasQuizQuestions is correctly initialized
            // For draft quizzes, always start with false (no questions)
            if (activeItem &&
                activeItem.type === 'quiz' &&
                activeItem.status === 'draft') {

                // Reset to false when dialog opens for draft quizzes
                setHasQuizQuestions(false);

                // Also ensure activeItem.questions is cleared
                console.log('Clearing questions for draft quiz on dialog open');
                activeItem.questions = [];
            } else if (activeItem &&
                activeItem.type === 'quiz' &&
                activeItem.status === 'published') {

                // For published quizzes, initialize based on actual data
                // Will be updated when data is loaded by the QuizEditor
                setHasQuizQuestions(activeItem.questions && activeItem.questions.length > 0);
            } else {
                // For materials, always true
                setHasQuizQuestions(true);
            }
        }
    }, [isOpen, activeItem]);

    // Add a capture phase event listener for Escape key
    useEffect(() => {
        // Handler function for keydown events in the capture phase
        const handleKeyDown = (e: KeyboardEvent) => {
            // If Escape key is pressed
            if (e.key === 'Escape') {
                // Check for active dialog element to ensure dialog is actually open
                const dialogElement = dialogContentRef.current;
                if (!dialogElement) return;

                // If close confirmation is already showing, don't do anything
                if (showCloseConfirmation) {
                    return;
                }

                // For published items in view mode, close directly
                if (activeItem?.status === 'published' && !isEditMode) {
                    onClose();
                    return;
                }

                // Prevent the default behavior and stop propagation
                e.preventDefault();
                e.stopPropagation();

                // Check if there are actual changes
                const hasChanges = activeItem.type === 'material'
                    ? learningMaterialEditorRef.current?.hasChanges() || false
                    : quizEditorRef.current?.hasChanges() || false;

                // If we're in edit mode for a published item
                if (activeItem?.status === 'published') {
                    // Only show confirmation if there are changes
                    if (hasChanges) {
                        setConfirmationType('exit_edit_publish');
                        setShowCloseConfirmation(true);
                    } else {
                        // No changes, just exit edit mode
                        onCancelEditMode();
                    }
                } else {
                    // For draft items
                    // Check if the editor/quiz has any content using the appropriate ref
                    const hasContent = activeItem.type === 'material'
                        ? learningMaterialEditorRef.current?.hasContent() || false
                        : quizEditorRef.current?.hasContent() || false;

                    // Check if the title has been changed from default
                    const titleElement = dialogTitleRef.current;
                    const currentTitle = titleElement?.textContent || '';

                    // Set default title based on item type
                    let defaultTitle = "New learning material";
                    if (activeItem.type === 'quiz') defaultTitle = "New quiz";

                    const isTitleChanged = currentTitle !== defaultTitle && currentTitle.trim() !== '';

                    // If there's no content and title hasn't changed, close without confirmation   
                    if (!hasContent && !isTitleChanged) {
                        onClose();
                        return;
                    }

                    // Only show confirmation if there are changes
                    if (hasChanges) {
                        setConfirmationType('exit_draft');
                        setShowCloseConfirmation(true);
                    } else {
                        // No changes, just close
                        onClose();
                    }
                    return;
                }
            }
        };

        // Add the event listener in the capture phase to intercept before other handlers
        document.addEventListener('keydown', handleKeyDown, true);

        // Clean up the event listener when the component unmounts or when dependencies change
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [activeItem, isEditMode, showCloseConfirmation, onClose, onCancelEditMode, dialogContentRef, dialogTitleRef]);

    // Add a cleanup effect for the toast timeout when the component unmounts
    useEffect(() => {
        return () => {
            // Clean up toast timeout on unmount
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
                toastTimeoutRef.current = null;
            }
        };
    }, []);

    // Add beforeunload event listener to prevent page reload/close with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const hasChanges = activeItem.type === 'material'
                ? learningMaterialEditorRef.current?.hasChanges() || false
                : quizEditorRef.current?.hasChanges() || false;
            // Only show warning if user is in edit mode or if there are actual unsaved changes
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return 'You have unsaved changes. Are you sure you want to leave?';
            }
        };

        // Add the event listener
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Clean up the event listener
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [activeItem, dialogTitleRef, isEditMode]);

    // Handle browser back/forward navigation
    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            const hasChanges = activeItem.type === 'material'
                ? learningMaterialEditorRef.current?.hasChanges() || false
                : quizEditorRef.current?.hasChanges() || false;
            // Prevent navigation if user is in edit mode, the item is a draft, or if there are unsaved changes
            if (isEditMode || activeItem?.status === 'draft' || hasChanges) {
                // Prevent the navigation by pushing the current state back
                window.history.pushState(null, '', window.location.href);

                // Show the close confirmation dialog with appropriate type
                if (activeItem?.status === 'published' && isEditMode) {
                    setConfirmationType('exit_edit_publish');
                } else {
                    setConfirmationType('exit_draft');
                }
                setShowCloseConfirmation(true);

                // Prevent the default navigation
                e.preventDefault();
                return;
            }
        };

        // Add the event listener
        window.addEventListener('popstate', handlePopState);

        // Clean up the event listener
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [activeItem, isEditMode, dialogTitleRef]);

    // Handle clicking outside of the date picker
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setShowSchedulePicker(false);
            }
        };

        if (showSchedulePicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSchedulePicker]);

    // Bail early if dialog isn't open or there's no active item
    if (!isOpen || !activeItem) return null;

    // Check if the quiz has questions using the local state variable
    // For non-quiz items, this is always true

    // Function to handle closing the dialog
    const handleCloseRequest = () => {
        // Check if there are actual changes
        const hasChanges = activeItem.type === 'material'
            ? learningMaterialEditorRef.current?.hasChanges() || false
            : quizEditorRef.current?.hasChanges() || false;

        // Case 1: Published learning material in edit mode 
        if (activeItem?.status === 'published' && isEditMode) {
            // Only show confirmation if there are changes
            if (hasChanges) {
                // For X button and backdrop click, we want to close the entire dialog after confirmation
                // Use a different confirmation type to differentiate from the Cancel button
                setConfirmationType('close');
                setShowCloseConfirmation(true);
            } else {
                // No changes, just close
                onClose();
            }
            return;
        }

        // Case 2: Draft items (check for content)
        if (activeItem?.status === 'draft') {
            // Check if the editor/quiz has any content using the appropriate ref
            const hasContent = activeItem.type === 'material'
                ? learningMaterialEditorRef.current?.hasContent() || false
                : quizEditorRef.current?.hasContent() || false;

            // Check if the title has been changed from default
            const titleElement = dialogTitleRef.current;
            const currentTitle = titleElement?.textContent || '';

            // Set default title based on item type
            let defaultTitle = "New learning material";
            if (activeItem.type === 'quiz') defaultTitle = "New quiz";

            const isTitleChanged = currentTitle !== defaultTitle && currentTitle.trim() !== '';

            // If there's no content and title hasn't changed, close without confirmation
            if (!hasContent && !isTitleChanged) {
                onClose();
                return;
            }

            // Only show confirmation if there are changes
            if (hasChanges) {
                // Set confirmation type for draft items
                setConfirmationType('exit_draft');
                setShowCloseConfirmation(true);
            } else {
                // No changes, just close
                onClose();
            }
            return;
        }
        onClose();
    };

    // Add a handler for the Cancel button in published items' edit mode
    const handleCancelEditClick = () => {
        // Check if there are actual changes
        const hasChanges = activeItem.type === 'material'
            ? learningMaterialEditorRef.current?.hasChanges() || false
            : quizEditorRef.current?.hasChanges() || false;

        // Only show confirmation if there are changes
        if (hasChanges) {
            // Show confirmation for published items in edit mode
            setConfirmationType('exit_edit_publish');
            setShowCloseConfirmation(true);
        } else {
            // No changes, just exit edit mode
            onCancelEditMode();
        }
    };

    const handleConfirmSaveDraft = () => {
        setShowCloseConfirmation(false);

        // Save logic for draft: call save and then close dialog
        if (activeItem?.type === 'material') {
            learningMaterialEditorRef.current?.save();
        } else if (activeItem?.type === 'quiz') {
            quizEditorRef.current?.saveDraft();
        }
        onClose();
    }

    // Handle confirmed close action
    const handleConfirmDiscardChanges = () => {
        setShowCloseConfirmation(false);

        if (confirmationType === 'exit_edit_publish') {
            // For published items in edit mode, just exit edit mode without closing the dialog
            if (activeItem?.type === 'material') {
                // Use the ref to call cancel directly to revert any changes
                learningMaterialEditorRef.current?.cancel();
            } else if (activeItem?.type === 'quiz') {
                // Use the ref to call cancel directly to revert any changes
                quizEditorRef.current?.cancel();
            }

            // Exit edit mode but keep the dialog open
            onCancelEditMode();
        } else {
            // For other confirmation types (draft items or X button click), close the entire dialog
            onClose();
        }
    };

    // Handle cancel close action
    const handleCancelClosingDialog = () => {
        setShowCloseConfirmation(false);
    };

    // Handle backdrop click to close dialog
    const handleDialogBackdropClick = (e: React.MouseEvent) => {
        // Only close if clicking directly on the backdrop, not on the dialog content
        if (dialogContentRef.current && !dialogContentRef.current.contains(e.target as Node)) {
            handleCloseRequest();
        }
    };

    // Toggle quiz preview mode
    const toggleQuizPreviewMode = () => {
        // If we're not already in preview mode and trying to enter it
        if (!quizPreviewMode && quizEditorRef.current) {
            // Check if current question has content
            const hasContent = quizEditorRef.current.hasQuestionContent();

            if (!hasContent) {
                // Show toast notification
                displayToast("Empty question", "Please add details to the question before previewing", "🚫");
                return; // Prevent entering preview mode
            }

            // Get the current question type and check for empty correct answer or missing scorecard
            const currentQuestionType = quizEditorRef.current.getCurrentQuestionType();
            const currentQuestionInputType = quizEditorRef.current.getCurrentQuestionInputType();

            if (currentQuestionInputType === 'code') {
                const hasCodingLanguages = quizEditorRef.current.hasCodingLanguages();
                if (!hasCodingLanguages) {
                    // Show toast notification for missing coding languages
                    displayToast("Missing Coding Languages", "Please select at least one programming language", "🚫");
                    return; // Prevent entering preview mode
                }
            }

            if (currentQuestionType === 'objective') {
                // For objective questions, check if correct answer is empty
                const hasCorrectAnswer = quizEditorRef.current.hasCorrectAnswer();
                if (!hasCorrectAnswer) {
                    // Show toast notification for empty correct answer
                    displayToast("Empty correct answer", "Please set a correct answer for this question before previewing", "🚫");
                    // Switch to answer tab
                    quizEditorRef.current.setActiveTab('answer');
                    return; // Prevent entering preview mode
                }
            } else if (currentQuestionType === 'subjective') {
                // For subjective questions, check if scorecard is set
                const hasScorecard = quizEditorRef.current.hasScorecard();
                if (!hasScorecard) {
                    // Show toast notification for missing scorecard
                    displayToast("Missing scorecard", "Please set a scorecard for evaluating this question before previewing", "🚫");
                    // Switch to scorecard tab
                    quizEditorRef.current.setActiveTab('scorecard');
                    return; // Prevent entering preview mode
                }

                // Validate the scorecard criteria for subjective questions
                // Get the current question's scorecard data
                const currentQuestionConfig = quizEditorRef.current.getCurrentQuestionConfig?.();

                if (currentQuestionConfig?.scorecardData) {
                    // Use the shared validation function to validate the scorecard criteria
                    const isValid = quizEditorRef.current.validateScorecardCriteria(
                        currentQuestionConfig.scorecardData,
                        {
                            setActiveTab: quizEditorRef.current.setActiveTab,
                            showErrorMessage: displayToast
                        }
                    );

                    if (!isValid) {
                        return; // Prevent entering preview mode if validation fails
                    }
                }
            }
        }

        // Toggle preview mode if content exists or we're exiting preview mode
        setQuizPreviewMode(!quizPreviewMode);
    };

    // Handle showing and hiding toast
    const displayToast = (title: string, description: string, emoji: string = "🚀") => {
        // Clear any existing timeout to prevent premature closing of new toast
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
            toastTimeoutRef.current = null;
        }

        // Set toast content
        setToastTitle(title);
        setToastDescription(description);
        setToastEmoji(emoji);
        setShowToast(true);

        // Set new timeout and store the ID for future reference
        toastTimeoutRef.current = setTimeout(() => {
            setShowToast(false);
            toastTimeoutRef.current = null;
        }, 5000); // Auto-hide after 5 seconds
    };

    // Handle save button click - show confirmation
    const handleSaveClick = () => {
        checkUnsavedScorecardChangesBeforeAction(() => {
            // For quizzes, validate before showing save confirmation
            if (activeItem?.type === 'quiz' && quizEditorRef.current) {
                // Run validation before opening the save confirmation
                const isValid = quizEditorRef.current.validateBeforePublish();
                if (!isValid) {
                    return; // Don't show confirmation if validation fails
                }
            }

            // For learning materials, validate content exists
            if (activeItem?.type === 'material' && learningMaterialEditorRef.current) {
                const hasContent = learningMaterialEditorRef.current.hasContent();
                if (!hasContent) {
                    // Show error message
                    displayToast(
                        "Empty learning material",
                        "Please add content before saving",
                        "🚫"
                    );
                    return; // Don't show confirmation if validation fails
                }
            }

            // If validation passes, show save confirmation
            setShowSaveConfirmation(true);
        });
    };

    // Function to check for unsaved scorecard changes and handle appropriately
    const checkUnsavedScorecardChangesBeforeAction = (action: () => void) => {
        // For quizzes, check for unsaved scorecard changes first
        if (activeItem?.type === 'quiz' && quizEditorRef.current) {
            if (quizEditorRef.current.hasUnsavedScorecardChanges()) {
                pendingActionRef.current = action;
                setShowUnsavedScorecardConfirmation(true);
                return;
            }
        }

        // If no unsaved scorecard changes, proceed with the action
        action();
    };

    // Handle unsaved scorecard confirmation - navigate to question
    const handleGoBackToScorecard = () => {
        setShowUnsavedScorecardConfirmation(false);

        // Clear the pending action
        pendingActionRef.current = null;
    };

    // Handle discard unsaved scorecard changes
    const handleDiscardScorecardChanges = () => {
        setShowUnsavedScorecardConfirmation(false);

        // Execute the appropriate action based on what was being attempted
        if (pendingActionRef.current) {
            pendingActionRef.current();
        }

        // Clear the pending action
        pendingActionRef.current = null;
    };

    // Handle confirmed save action
    const handleConfirmSavePublished = () => {
        setShowSaveConfirmation(false);

        // Execute the actual save action based on item type
        if (activeItem?.type === 'material') {
            // Use the ref to call save directly
            learningMaterialEditorRef.current?.save();
        } else if (activeItem?.type === 'quiz') {
            // Use the ref to call save directly
            quizEditorRef.current?.savePublished();
        }
    };

    // Handle cancel save action
    const handleCancelSave = () => {
        setShowSaveConfirmation(false);
    };

    const isClosingDraft = confirmationType === 'exit_draft';

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-[#111111] flex flex-col"
                onClick={handleDialogBackdropClick}
            >
                <div
                    ref={dialogContentRef}
                    style={{
                        backgroundColor: '#1A1A1A',
                        border: 'none'
                    }}
                    className="w-full h-full flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Dialog Header */}
                    <div
                        className="flex items-center justify-between p-4 border-b"
                        style={{ backgroundColor: '#111111' }}
                    >
                        <div className="flex-1 flex items-center">
                            <h2
                                ref={dialogTitleRef}
                                contentEditable={(activeItem?.status !== 'published' || isEditMode)}
                                suppressContentEditableWarning
                                onInput={(e) => {
                                    // For both learning materials and quizzes, allow editing title 
                                    // but don't propagate changes upward yet (will be handled during save)
                                    // The current title will be stored in the DOM element
                                    // and will be sent to the API during save/publish
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        // Blur the element to trigger save
                                        (e.target as HTMLElement).blur();
                                    }
                                }}
                                onClick={(e) => {
                                    // Prevent click from bubbling up
                                    e.stopPropagation();

                                    // If not editable, don't continue
                                    if ((activeItem?.status === 'published' && !isEditMode)) {
                                        return;
                                    }

                                    // Set a flag to indicate the title is being edited
                                    const titleElement = e.currentTarget as HTMLElement;
                                    titleElement.dataset.editing = "true";

                                    // Only set cursor at the end on first click (not on double-click)
                                    // This allows double-click to select text as expected
                                    if (!titleElement.dataset.clicked) {
                                        titleElement.dataset.clicked = "true";

                                        // Set cursor position at the end of text
                                        const range = document.createRange();
                                        const selection = window.getSelection();
                                        const textNode = titleElement.firstChild || titleElement;

                                        if (textNode) {
                                            const textLength = textNode.textContent?.length || 0;
                                            range.setStart(textNode, textLength);
                                            range.setEnd(textNode, textLength);
                                            selection?.removeAllRanges();
                                            selection?.addRange(range);
                                        }

                                        // Reset the clicked flag after a short delay
                                        setTimeout(() => {
                                            titleElement.dataset.clicked = "";
                                        }, 300);
                                    }
                                }}
                                className={`text-2xl font-light text-white outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none cursor-text mr-4 ${(activeItem?.status !== 'published' || isEditMode) ? 'w-full min-w-[300px]' : ''}`}
                                data-placeholder={activeItem?.type === 'material' ? 'New learning material' : 'New quiz'}
                            >
                                {activeItem?.title}
                            </h2>
                        </div>
                        <div className="flex items-center space-x-3">
                            {/* Preview Mode Toggle for Quizzes/Exams */}
                            {activeItem?.type === 'quiz' && hasQuizQuestions && (
                                <button
                                    onClick={toggleQuizPreviewMode}
                                    className="flex items-center px-4 py-2 text-sm text-white bg-transparent border !border-blue-500 hover:bg-[#222222] focus:border-blue-500 active:border-blue-500 rounded-full transition-colors cursor-pointer"
                                    aria-label={quizPreviewMode ? "Exit preview" : "Preview quiz"}
                                >
                                    {quizPreviewMode ? (
                                        <>
                                            <Edit2 size={16} className="mr-2" />
                                            Exit preview
                                        </>
                                    ) : (
                                        <>
                                            <Eye size={16} className="mr-2" />
                                            Preview
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Publish button for all item types */}
                            {activeItem?.status === 'draft' &&
                                ((activeItem?.type === 'quiz' && hasQuizQuestions) ||
                                    activeItem?.type === 'material') && (
                                    <>
                                        {/* Save Draft button */}
                                        <button
                                            onClick={() => {
                                                checkUnsavedScorecardChangesBeforeAction(() => {
                                                    handleConfirmSaveDraft();
                                                });
                                            }}
                                            className="flex items-center px-4 py-2 text-sm text-white bg-transparent border !border-yellow-500 hover:bg-[#222222] focus:border-gray-500 active:border-gray-500 rounded-full transition-colors cursor-pointer mr-3"
                                            aria-label={`Save ${activeItem?.type} draft`}
                                        >
                                            <Check size={16} className="mr-2" />
                                            Save draft
                                        </button>
                                        {/* Existing Publish button */}
                                        <button
                                            onClick={() => {
                                                checkUnsavedScorecardChangesBeforeAction(() => {
                                                    // For quizzes, validate before showing publish confirmation
                                                    if (activeItem?.type === 'quiz' && quizEditorRef.current) {
                                                        // Run validation before opening the publish confirmation
                                                        const isValid = quizEditorRef.current.validateBeforePublish();
                                                        if (!isValid) {
                                                            return; // Don't show confirmation if validation fails
                                                        }
                                                    }

                                                    // For learning materials, validate content exists
                                                    if (activeItem?.type === 'material' && learningMaterialEditorRef.current) {
                                                        const hasContent = learningMaterialEditorRef.current.hasContent();
                                                        if (!hasContent) {
                                                            // Show error message
                                                            displayToast(
                                                                "Empty learning material",
                                                                "Please add content before publishing",
                                                                "🚫"
                                                            );
                                                            return; // Don't show confirmation if validation fails
                                                        }
                                                    }

                                                    // If validation passes, show publish confirmation
                                                    onSetShowPublishConfirmation(true);
                                                });
                                            }}
                                            className="flex items-center px-4 py-2 text-sm text-white bg-transparent border !border-green-500 hover:bg-[#222222] focus:border-green-500 active:border-green-500 rounded-full transition-colors cursor-pointer"
                                            aria-label={`Publish ${activeItem?.type}`}
                                        >
                                            <Zap size={16} className="mr-2" />
                                            Publish
                                        </button>
                                    </>
                                )}

                            {activeItem?.status === 'published' && isEditMode && !quizPreviewMode ? (
                                <>
                                    {scheduledDate && (
                                        <div className="flex items-center mr-3">
                                            <button
                                                onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                                                className="flex items-center px-4 py-2 text-sm text-white bg-transparent border !border-yellow-600 hover:bg-[#222222] focus:border-yellow-600 active:border-yellow-600 rounded-full transition-colors cursor-pointer"
                                                aria-label="Set scheduled publication date"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <polyline points="12 6 12 12 16 14"></polyline>
                                                </svg>
                                                {formatScheduleDate(scheduledDate)}
                                            </button>
                                            {showSchedulePicker && (
                                                <div ref={datePickerRef} className="absolute mt-2 top-16 z-50 bg-[#242424] p-3 border border-gray-700 rounded-lg shadow-lg">
                                                    <DatePicker
                                                        selected={scheduledDate}
                                                        onChange={(date) => verifyScheduledDateAndSchedule(date)}
                                                        showTimeSelect
                                                        timeFormat="HH:mm"
                                                        timeIntervals={15}
                                                        dateFormat="MMMM d, yyyy h:mm aa"
                                                        timeCaption="Time"
                                                        minDate={new Date()} // Can't schedule in the past
                                                        className="bg-[#333333] rounded-md p-2 px-4 w-full text-white cursor-pointer"
                                                        wrapperClassName="w-full"
                                                        calendarClassName="bg-[#242424] text-white border border-gray-700 rounded-lg shadow-lg cursor-pointer"
                                                        inline
                                                    />
                                                    <div className="mt-2 flex justify-end">
                                                        <button
                                                            onClick={() => setShowSchedulePicker(false)}
                                                            className="px-3 py-1 text-xs text-white bg-[#444444] hover:bg-[#555555] rounded-md"
                                                        >
                                                            Close
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleSaveClick}
                                        className="flex items-center px-4 py-2 text-sm text-white bg-transparent border !border-green-500 hover:bg-[#222222] focus:border-green-500 active:border-green-500 rounded-full transition-colors cursor-pointer"
                                        aria-label="Save changes"
                                    >
                                        <Check size={16} className="mr-2" />
                                        Save
                                    </button>
                                    <button
                                        onClick={handleCancelEditClick}
                                        className="flex items-center px-4 py-2 text-sm text-white bg-transparent border !border-gray-500 hover:bg-[#222222] focus:border-gray-500 active:border-gray-500 rounded-full transition-colors cursor-pointer"
                                        aria-label="Cancel editing"
                                    >
                                        <X size={16} className="mr-2" />
                                        Cancel
                                    </button>
                                </>
                            ) : activeItem?.status === 'published' && !isEditMode && !quizPreviewMode && (
                                <>
                                    {activeItem.scheduled_publish_at && (
                                        <Tooltip content={`Scheduled for ${formatScheduleDate(new Date(activeItem.scheduled_publish_at))}`} position="top">
                                            <button
                                                className="flex items-center px-4 py-2 text-sm text-white bg-transparent border !border-yellow-600 hover:bg-[#222222] focus:border-yellow-600 active:border-yellow-600 rounded-full transition-colors"
                                                aria-label="Scheduled publishing information"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <polyline points="12 6 12 12 16 14"></polyline>
                                                </svg>
                                                Scheduled
                                            </button>
                                        </Tooltip>
                                    )}
                                    <button
                                        onClick={onEnableEditMode}
                                        className="flex items-center px-4 py-2 text-sm text-white bg-transparent border !border-violet-600 hover:bg-[#222222] focus:border-violet-600 active:border-violet-600 rounded-full transition-colors cursor-pointer"
                                        aria-label="Edit item"
                                    >
                                        <Pencil size={16} className="mr-2" />
                                        Edit
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Close button */}
                        <button
                            onClick={handleCloseRequest}
                            className="ml-2 p-2 text-white hover:text-white rounded-full hover:bg-[#333333] transition-colors cursor-pointer"
                            aria-label="Close dialog"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Dialog Content */}
                    <div
                        className="flex-1 overflow-y-auto dialog-content-editor"
                        style={{ height: 'calc(100vh - 65px)' }} // Adjust height to account for header
                        onClick={(e) => {
                            // Ensure the click event doesn't bubble up
                            e.stopPropagation();

                            // Only focus the editor if in editable mode
                            if (activeItem?.status !== 'published' || isEditMode) {
                                // Focus the editor
                                focusEditor();
                            }
                        }}
                    >
                        {activeItem?.type === 'material' ? (
                            <DynamicLearningMaterialEditor
                                ref={learningMaterialEditorRef}
                                key={`material-${activeItem.id}-${isEditMode}`}
                                readOnly={activeItem.status === 'published' && !isEditMode}
                                showPublishConfirmation={showPublishConfirmation}
                                onPublishConfirm={onPublishConfirm}
                                onPublishCancel={onPublishCancel}
                                taskId={activeItem.id}
                                isDarkMode={true}
                                scheduledPublishAt={scheduledDate ? scheduledDate.toISOString() : null}
                                onPublishSuccess={(updatedData?: TaskData) => {
                                    // Handle publish success
                                    if (updatedData) {
                                        // Properly update the UI state first
                                        // This will transform the publish button to edit button
                                        if (activeItem && updatedData.status === 'published') {
                                            activeItem.status = 'published';
                                            activeItem.title = updatedData.title;
                                            // Add the scheduled_publish_at value from updatedData to activeItem
                                            activeItem.scheduled_publish_at = updatedData.scheduled_publish_at;

                                            if (updatedData.scheduled_publish_at) {
                                                setScheduledDate(new Date(updatedData.scheduled_publish_at));
                                            } else {
                                                setScheduledDate(null);
                                            }

                                            if (updatedData.blocks) {
                                                // @ts-ignore - types may not perfectly match
                                                activeItem.content = updatedData.blocks;
                                            }
                                        }

                                        // Update will be handled by the parent component
                                        onPublishConfirm();

                                        // Show toast notification
                                        const publishMessage = updatedData.scheduled_publish_at ? "Your learning material has been scheduled for publishing" : "Your learning material has been published";
                                        displayToast("Published", publishMessage);
                                    }
                                    // Hide the publish confirmation dialog
                                    onSetShowPublishConfirmation(false);
                                }}
                                onSaveSuccess={(updatedData?: TaskData) => {
                                    // Handle save success - similar to publish success but without status change
                                    if (updatedData) {
                                        // Update the activeItem with new title and content
                                        if (activeItem) {
                                            activeItem.title = updatedData.title;
                                            // Add the scheduled_publish_at value when saving
                                            activeItem.scheduled_publish_at = updatedData.scheduled_publish_at;

                                            if (updatedData.blocks) {
                                                // @ts-ignore - types may not perfectly match
                                                activeItem.content = updatedData.blocks;
                                            }
                                        }

                                        // Call the parent's save function
                                        onSaveItem();

                                        // Show toast notification for save success
                                        displayToast("Saved", `Your learning material has been updated`);
                                    }
                                }}
                            />
                        ) : activeItem?.type === 'quiz' ? (
                            <DynamicQuizEditor
                                ref={quizEditorRef}
                                key={`quiz-${activeItem.id}-${isEditMode}`}
                                scheduledPublishAt={scheduledDate ? scheduledDate.toISOString() : null}
                                onChange={(questions) => {
                                    // Track if there are questions for publish/preview button visibility
                                    setHasQuizQuestions(questions.length > 0);

                                    // Keep activeItem.questions updated for component state consistency
                                    if (activeItem) {
                                        activeItem.questions = questions;
                                    }

                                    // Notify parent component
                                    onQuizContentChange(questions);
                                }}
                                isPreviewMode={quizPreviewMode}
                                isDarkMode={true}
                                readOnly={activeItem.status === 'published' && !isEditMode}
                                taskId={activeItem.id}
                                status={activeItem.status}
                                taskType={activeItem.type}
                                showPublishConfirmation={showPublishConfirmation}
                                onPublishCancel={onPublishCancel}
                                onValidationError={(message, description) => {
                                    // Display toast notification for validation errors during publishing
                                    displayToast(message, description, "🚫");
                                }}
                                courseId={courseId}
                                onSaveSuccess={(updatedData) => {
                                    // Handle save success
                                    if (updatedData) {
                                        // Update the activeItem with the updated title and questions
                                        if (activeItem) {
                                            activeItem.title = updatedData.title;
                                            // Add the scheduled_publish_at value when saving
                                            activeItem.scheduled_publish_at = updatedData.scheduled_publish_at;

                                            if (updatedData.questions) {
                                                activeItem.questions = updatedData.questions;
                                            }
                                        }

                                        // Call onSaveItem to exit edit mode
                                        onSaveItem();

                                        // Show toast notification for save success
                                        displayToast("Saved", `Your ${activeItem.type} has been updated`);
                                    }
                                }}
                                onPublishSuccess={(updatedData) => {
                                    // Handle publish success
                                    if (updatedData) {
                                        // Properly update the UI state first
                                        // Properly update the UI state first
                                        // This will transform the publish button to edit button
                                        if (activeItem && updatedData.status === 'published') {
                                            activeItem.status = 'published';
                                            activeItem.title = updatedData.title;
                                            // Add the scheduled_publish_at value from updatedData to activeItem
                                            activeItem.scheduled_publish_at = updatedData.scheduled_publish_at;

                                            if (updatedData.scheduled_publish_at) {
                                                setScheduledDate(new Date(updatedData.scheduled_publish_at));
                                            } else {
                                                setScheduledDate(null);
                                            }

                                            if (updatedData.questions) {
                                                activeItem.questions = updatedData.questions;
                                            }
                                        }

                                        // Update will be handled by the parent component
                                        // Pass the updated data to the parent component
                                        onPublishConfirm();

                                        // Show toast notification
                                        const publishMessage = updatedData.scheduled_publish_at ? `Your quiz has been scheduled for publishing` : `Your quiz has been published`;
                                        displayToast("Published", publishMessage);
                                    }

                                    // Hide the publish confirmation dialog
                                    onSetShowPublishConfirmation(false);
                                }}
                                schoolId={schoolId}
                                onQuestionChangeWithUnsavedScorecardChanges={() => {
                                    setShowUnsavedScorecardChangesInfo(true);
                                }}
                            />
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Close confirmation dialog */}
            <ConfirmationDialog
                open={showCloseConfirmation}
                title={isClosingDraft ? "Save Your Progress" : "Unsaved Changes"}
                message={
                    isClosingDraft
                        ?
                        "Would you like to save your progress before leaving? If you don't save, all your progress will be lost." : "All your unsaved changes will be lost if you leave without saving. Are you sure you want to leave?"
                }
                confirmButtonText={isClosingDraft ? "Save" : "Discard changes"}
                cancelButtonText={isClosingDraft ? "Discard" : "Continue editing"}
                onConfirm={isClosingDraft ? handleConfirmSaveDraft : handleConfirmDiscardChanges}
                onCancel={isClosingDraft ? handleConfirmDiscardChanges : handleCancelClosingDialog}
                onClickOutside={isClosingDraft ? () => setShowCloseConfirmation(false) : handleCancelClosingDialog}
                type={isClosingDraft ? 'save' : 'delete'}
                showCloseButton={isClosingDraft}
                onClose={() => setShowCloseConfirmation(false)}
            />

            {/* Save confirmation dialog */}
            <ConfirmationDialog
                open={showSaveConfirmation}
                title="Ready to save changes"
                message="These changes will be reflected to learners immediately after saving. Are you sure you want to proceed?"
                confirmButtonText="Save"
                cancelButtonText="Continue editing"
                onConfirm={handleConfirmSavePublished}
                onCancel={handleCancelSave}
                type="publish"
            />

            {/* Unsaved scorecard confirmation dialog */}
            <ConfirmationDialog
                open={showUnsavedScorecardConfirmation}
                title="Unsaved Scorecard Changes"
                message={`The scorecard for this question has unsaved changes. Do you want to discard them and continue, or go back to save them?`}
                confirmButtonText="Discard changes"
                cancelButtonText="Go Back"
                onConfirm={handleDiscardScorecardChanges}
                onCancel={handleGoBackToScorecard}
                type="delete"
            />

            <ConfirmationDialog
                open={showUnsavedScorecardChangesInfo}
                title="You have unsaved changes"
                message={`Your scorecard has unsaved changes. Either save them or discard them.`}
                confirmButtonText="Go back"
                cancelButtonText=""
                onConfirm={() => {
                    setShowUnsavedScorecardChangesInfo(false);
                }}
                onCancel={() => {
                    setShowUnsavedScorecardChangesInfo(false);
                }}
                type="custom"
            />

            {/* Toast notification */}
            <Toast
                show={showToast}
                title={toastTitle}
                description={toastDescription}
                emoji={toastEmoji}
                onClose={() => setShowToast(false)}
            />
        </>
    );
};

export default CourseItemDialog; 