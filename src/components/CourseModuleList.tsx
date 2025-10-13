import { useState, useRef, useEffect } from "react";
import { ChevronUp, ChevronDown, ChevronRight, ChevronDown as ChevronDownExpand, Plus, HelpCircle, Trash, Clipboard, Check, Loader2, Copy, FileText, Brain, BookOpen, PenSquare, FileQuestion, ClipboardList, Lock, Ban } from "lucide-react";
import { Module, ModuleItem, Quiz } from "@/types/course";
import { QuizQuestion } from "@/types/quiz"; // Import from types instead
import CourseItemDialog from "@/components/CourseItemDialog";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import Tooltip from "@/components/Tooltip"; // Import the Tooltip component
import { formatScheduleDate } from "@/lib/utils/dateFormat"; // Import the utility function


interface CourseModuleListProps {
    modules: Module[];
    mode: 'edit' | 'view'; // 'edit' for teacher editing, 'view' for learner viewing
    onToggleModule: (moduleId: string) => void;
    onOpenItem?: (moduleId: string, itemId: string, questionId?: string) => void;
    onMoveItemUp?: (moduleId: string, itemId: string) => void;
    onMoveItemDown?: (moduleId: string, itemId: string) => void;
    onDeleteItem?: (moduleId: string, itemId: string) => void;
    onAddLearningMaterial?: (moduleId: string) => Promise<void>;
    onAddQuiz?: (moduleId: string) => Promise<void>;
    onAddAssignment?: (moduleId: string) => Promise<void>;
    onMoveModuleUp?: (moduleId: string) => void;
    onMoveModuleDown?: (moduleId: string) => void;
    onDeleteModule?: (moduleId: string) => void;
    onEditModuleTitle?: (moduleId: string) => void;
    expandedModules?: Record<string, boolean>; // For learner view
    saveModuleTitle?: (moduleId: string) => void; // Function to save module title
    cancelModuleEditing?: (moduleId: string) => void; // Function to cancel module title editing
    completedTaskIds?: Record<string, boolean>; // Added prop for completed task IDs
    completedQuestionIds?: Record<string, Record<string, boolean>>; // Add prop for partially completed quiz questions
    schoolId?: string; // Add school ID for fetching scorecards
    courseId?: string; // Add courseId for fetching learning materials

    // Dialog-related props
    isDialogOpen?: boolean;
    activeItem?: ModuleItem | null;
    activeModuleId?: string | null;
    activeQuestionId?: string | null;
    isEditMode?: boolean;
    isPreviewMode?: boolean;
    showPublishConfirmation?: boolean;
    handleConfirmPublish?: () => void;
    handleCancelPublish?: () => void;
    closeDialog?: () => void;
    saveItem?: () => void;
    cancelEditMode?: () => void;
    enableEditMode?: () => void;
    handleQuizContentChange?: (questions: QuizQuestion[]) => void;
    setShowPublishConfirmation?: (show: boolean) => void;
    onQuestionChange?: (questionId: string) => void;
    onDuplicateItem?: (moduleId: string, taskData: any, ordering: number) => Promise<void>;
}

export default function CourseModuleList({
    modules,
    mode,
    onToggleModule,
    onOpenItem,
    onMoveItemUp,
    onMoveItemDown,
    onDeleteItem,
    onAddLearningMaterial,
    onAddQuiz,
    onAddAssignment,
    onMoveModuleUp,
    onMoveModuleDown,
    onDeleteModule,
    onEditModuleTitle,
    expandedModules = {},
    saveModuleTitle = () => { }, // Default empty function
    cancelModuleEditing = () => { }, // Default empty function
    completedTaskIds = {}, // Default empty object for completed task IDs
    completedQuestionIds = {}, // Default empty object for completed question IDs
    schoolId,
    courseId,

    // Dialog-related props
    isDialogOpen = false,
    activeItem = null,
    activeModuleId = null,
    activeQuestionId = null,
    isEditMode = false,
    isPreviewMode = false,
    showPublishConfirmation = false,
    handleConfirmPublish = () => { },
    handleCancelPublish = () => { },
    closeDialog = () => { },
    saveItem = () => { },
    cancelEditMode = () => { },
    enableEditMode = () => { },
    handleQuizContentChange = () => { },
    setShowPublishConfirmation = () => { },
    onQuestionChange = () => { },
    onDuplicateItem,
}: CourseModuleListProps) {

    // Track completed items - initialize with completedTaskIds prop
    const [completedItems, setCompletedItems] = useState<Record<string, boolean>>(completedTaskIds);

    // State to track module deletion confirmation
    const [moduleToDelete, setModuleToDelete] = useState<string | null>(null);

    // State to track deletion in progress
    const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

    // State to track module deletion in progress
    const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);

    // State to track task deletion confirmation
    const [taskToDelete, setTaskToDelete] = useState<{ moduleId: string, itemId: string, itemType?: string } | null>(null);

    // States to track module swapping in progress
    const [swappingModuleUpId, setSwappingModuleUpId] = useState<string | null>(null);
    const [swappingModuleDownId, setSwappingModuleDownId] = useState<string | null>(null);

    // States to track task swapping in progress
    const [swappingTaskUpId, setSwappingTaskUpId] = useState<string | null>(null);
    const [swappingTaskDownId, setSwappingTaskDownId] = useState<string | null>(null);

    // State to track task duplication in progress
    const [duplicatingTaskId, setDuplicatingTaskId] = useState<string | null>(null);

    // Update completedItems when completedTaskIds changes
    useEffect(() => {
        // Only update the state if the values are actually different
        // This prevents an infinite update loop
        const hasChanged = JSON.stringify(completedItems) !== JSON.stringify(completedTaskIds);
        if (hasChanged) {
            setCompletedItems(completedTaskIds);
        }
    }, [completedTaskIds, completedItems]);

    // Refs for the dialog
    const dialogTitleRef = useRef<HTMLHeadingElement | null>(null);
    const dialogContentRef = useRef<HTMLDivElement | null>(null);

    // Function to focus the editor
    const focusEditor = () => {
        // First, blur the title element
        if (dialogTitleRef.current) {
            dialogTitleRef.current.blur();
        }

        // Then try to find and focus the editor
        setTimeout(() => {
            try {
                const selectors = [
                    '.bn-editor',
                    '.ProseMirror',
                    '.dialog-content-editor [contenteditable="true"]',
                    '.dialog-content-editor .bn-container',
                    '.dialog-content-editor [tabindex="0"]',
                    '.dialog-content-editor [role="textbox"]',
                    '.dialog-content-editor div[contenteditable]'
                ];

                for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el instanceof HTMLElement) {
                        el.focus();
                        return; // Exit once we've focused an element
                    }
                }
            } catch (err) {
                console.error('Error focusing editor:', err);
            }
        }, 200);
    };

    // Function to handle swapping modules via API
    const swapModules = async (moduleId1: string, moduleId2: string) => {
        if (!courseId) {
            console.error('Course ID is required for swapping modules');
            return;
        }

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${courseId}/milestones/swap`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    milestone_1_id: moduleId1,
                    milestone_2_id: moduleId2,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to swap modules: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error swapping modules:', error);
            throw error;
        }
    };

    // Function to handle swapping tasks via API
    const swapTasks = async (taskId1: string, taskId2: string) => {
        if (!courseId) {
            console.error('Course ID is required for swapping modules');
            return;
        }

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${courseId}/tasks/swap`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    task_1_id: taskId1,
                    task_2_id: taskId2,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to swap tasks: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error swapping tasks:', error);
            throw error;
        }
    };

    // Function to handle moving a module up (with API call)
    const handleMoveModuleUp = async (moduleId: string) => {
        // Find the module and its index
        const index = modules.findIndex(m => m.id === moduleId);
        if (index <= 0) return; // Can't move up if it's the first one

        // Get the previous module
        const previousModule = modules[index - 1];
        if (!previousModule) return;

        try {
            // Set loading state
            setSwappingModuleUpId(moduleId);

            // Call the API to swap modules
            await swapModules(moduleId, previousModule.id);

            // Update UI via the parent component's handler
            if (onMoveModuleUp) {
                onMoveModuleUp(moduleId);
            }
        } catch (error) {
            console.error('Failed to move module up:', error);
            // Could add a toast notification here
        } finally {
            // Clear loading state
            setSwappingModuleUpId(null);
        }
    };

    // Function to handle moving a module down (with API call)
    const handleMoveModuleDown = async (moduleId: string) => {
        // Find the module and its index
        const index = modules.findIndex(m => m.id === moduleId);
        if (index === -1 || index === modules.length - 1) return; // Can't move down if it's the last one

        // Get the next module
        const nextModule = modules[index + 1];
        if (!nextModule) return;

        try {
            // Set loading state
            setSwappingModuleDownId(moduleId);

            // Call the API to swap modules
            await swapModules(moduleId, nextModule.id);

            // Update UI via the parent component's handler
            if (onMoveModuleDown) {
                onMoveModuleDown(moduleId);
            }
        } catch (error) {
            console.error('Failed to move module down:', error);
            // Could add a toast notification here
        } finally {
            // Clear loading state
            setSwappingModuleDownId(null);
        }
    };

    // Function to handle moving a task up (with API call)
    const handleMoveTaskUp = async (moduleId: string, taskId: string) => {
        // Find the module
        const module = modules.find(m => m.id === moduleId);
        if (!module) return;

        // Find the task and its index
        const index = module.items.findIndex(item => item.id === taskId);
        if (index <= 0) return; // Can't move up if it's the first one

        // Get the previous task
        const previousTask = module.items[index - 1];
        if (!previousTask) return;

        try {
            // Set loading state
            setSwappingTaskUpId(taskId);

            // Call the API to swap tasks
            await swapTasks(taskId, previousTask.id);

            // Update UI via the parent component's handler
            if (onMoveItemUp) {
                onMoveItemUp(moduleId, taskId);
            }
        } catch (error) {
            console.error('Failed to move task up:', error);
            // Could add a toast notification here
        } finally {
            // Clear loading state
            setSwappingTaskUpId(null);
        }
    };

    // Function to handle moving a task down (with API call)
    const handleMoveTaskDown = async (moduleId: string, taskId: string) => {
        // Find the module
        const module = modules.find(m => m.id === moduleId);
        if (!module) return;

        // Find the task and its index
        const index = module.items.findIndex(item => item.id === taskId);
        if (index === -1 || index === module.items.length - 1) return; // Can't move down if it's the last one

        // Get the next task
        const nextTask = module.items[index + 1];
        if (!nextTask) return;

        try {
            // Set loading state
            setSwappingTaskDownId(taskId);

            // Call the API to swap tasks
            await swapTasks(taskId, nextTask.id);

            // Update UI via the parent component's handler
            if (onMoveItemDown) {
                onMoveItemDown(moduleId, taskId);
            }
        } catch (error) {
            console.error('Failed to move task down:', error);
            // Could add a toast notification here
        } finally {
            // Clear loading state
            setSwappingTaskDownId(null);
        }
    };

    // Get the appropriate expanded state based on mode
    const getIsExpanded = (moduleId: string) => {
        if (mode === 'edit') {
            return modules.find(m => m.id === moduleId)?.isExpanded || false;
        } else {
            return expandedModules[moduleId] || false;
        }
    };

    // Function to format unlock date for display
    const formatUnlockDate = (unlockAt: string) => {
        const date = new Date(unlockAt);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Handle module click based on mode
    const handleModuleClick = (e: React.MouseEvent, moduleId: string) => {
        // Find the module
        const module = modules.find(m => m.id === moduleId);
        if (!module) return;

        // Prevent clicking on locked modules
        if (module.unlockAt) {
            return;
        }

        // If in edit mode and module is in editing mode, don't toggle expansion
        if (mode === 'edit' && module.isEditing) {
            return;
        }

        // Prevent toggling if clicking on buttons
        if (
            (e.target as HTMLElement).tagName === 'BUTTON' ||
            (e.target as HTMLElement).closest('button')
        ) {
            return;
        }

        onToggleModule(moduleId);
    };

    // Function to handle task deletion with API call
    const handleDeleteTask = async (moduleId: string, itemId: string) => {
        try {
            setDeletingTaskId(itemId);

            // Make the API call to delete the task
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete task: ${response.statusText}`);
            }

            // If the API call was successful, update the UI
            if (onDeleteItem) {
                onDeleteItem(moduleId, itemId);
            }

        } catch (error) {
            console.error('Error deleting task:', error);
            // You could add a toast notification here for the error
        } finally {
            setDeletingTaskId(null);
        }
    };

    // Function to handle task delete confirmation
    const handleConfirmTaskDelete = () => {
        if (taskToDelete) {
            handleDeleteTask(taskToDelete.moduleId, taskToDelete.itemId);
        }
        setTaskToDelete(null);
    };

    // Function to cancel task deletion
    const handleCancelTaskDelete = () => {
        setTaskToDelete(null);
    };

    // Function to handle module delete confirmation
    const handleConfirmModuleDelete = async () => {
        if (moduleToDelete && onDeleteModule) {
            try {
                setDeletingModuleId(moduleToDelete);

                // Make the API call to delete the module (milestone)
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/milestones/${moduleToDelete}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to delete module: ${response.statusText}`);
                }

                // If the API call was successful, update the UI
                onDeleteModule(moduleToDelete);

            } catch (error) {
                console.error('Error deleting module:', error);
                // Could add a toast notification here for the error
            } finally {
                setDeletingModuleId(null);
            }
        }
        setModuleToDelete(null);
    };

    // Function to cancel module deletion
    const handleCancelModuleDelete = () => {
        setModuleToDelete(null);
    };

    // Function to get item type name for display
    const getItemTypeName = (type?: string) => {
        switch (type) {
            case 'material': return 'learning material';
            case 'quiz': return 'quiz';
            case 'assignment': return 'assignment';
            default: return 'item';
        }
    };

    // Function to handle task duplication with API call
    const handleDuplicateTask = async (moduleId: string, itemId: string) => {
        if (!courseId) {
            console.error('Course ID is required for cloning tasks');
            return;
        }

        try {
            setDuplicatingTaskId(itemId);

            // Make the API call to duplicate the task
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/duplicate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    task_id: parseInt(itemId),
                    milestone_id: parseInt(moduleId),
                    course_id: parseInt(courseId)
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to duplicate task: ${response.statusText}`);
            }

            const data = await response.json();

            // If the API call was successful, update the UI
            if (onDuplicateItem) {
                await onDuplicateItem(moduleId, data['task'], data['ordering']);
            }

        } catch (error) {
            console.error('Error duplicating task:', error);
            // You could add a toast notification here for the error
        } finally {
            setDuplicatingTaskId(null);
        }
    };

    return (
        <>
            <div className="space-y-2">
                {modules.map((module, index) => {
                    const moduleContent = (
                        <div
                            key={module.id}
                            className="border-none rounded-lg transition-colors"
                            style={{ backgroundColor: module.backgroundColor }}
                        >
                            <div className="flex flex-col">
                                {/* Module header with title and buttons */}
                                <div
                                    className={`flex items-center p-4 pb-3 ${module.unlockAt ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    onClick={(e) => handleModuleClick(e, module.id)}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Prevent toggling locked modules
                                            if (module.unlockAt) return;

                                            onToggleModule(module.id);
                                        }}
                                        className={`hidden sm:block mr-2 transition-colors ${module.unlockAt ? 'text-gray-500 cursor-not-allowed' : 'text-gray-400 hover:text-white cursor-pointer'}`}
                                        aria-label={getIsExpanded(module.id) ? "Collapse module" : "Expand module"}
                                        disabled={!!module.unlockAt}
                                    >
                                        {getIsExpanded(module.id) ? <ChevronDownExpand size={18} /> : <ChevronRight size={18} />}
                                    </button>
                                    <div className="flex-1 mr-2 sm:mr-4">
                                        {mode === 'edit' && module.isEditing ? (
                                            <h2
                                                contentEditable
                                                suppressContentEditableWarning
                                                className="text-lg sm:text-xl font-light text-white outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
                                                data-module-id={module.id}
                                                data-placeholder="New Module"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {module.title}
                                            </h2>
                                        ) : (
                                            <div className="flex items-center">
                                                <h2
                                                    className={`text-lg sm:text-xl font-light ${module.unlockAt ? 'text-gray-400' : 'text-white'}`}
                                                >
                                                    {module.title || "New Module"}
                                                </h2>
                                                {module.unlockAt && (
                                                    <Lock size={16} className="ml-2 text-gray-400" />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Module action buttons - only in edit mode */}
                                    {mode === 'edit' && (
                                        <div className="flex items-center space-x-2">
                                            {module.isEditing ? (
                                                <>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            saveModuleTitle(module.id);
                                                        }}
                                                        className="px-3 py-1 text-sm text-black bg-gray-300 hover:bg-gray-400 border border-black hover:border-gray-600 rounded-md transition-colors cursor-pointer flex items-center"
                                                        aria-label="Save module title"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                                            <polyline points="7 3 7 8 15 8"></polyline>
                                                        </svg>
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            cancelModuleEditing(module.id);
                                                        }}
                                                        className="px-3 py-1 text-sm text-gray-300 hover:text-white transition-colors focus:outline-none cursor-pointer flex items-center"
                                                        aria-label="Cancel editing"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                                        </svg>
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (onEditModuleTitle) {
                                                                onEditModuleTitle(module.id);
                                                            }
                                                        }}
                                                        className="px-3 py-1 text-sm text-black bg-gray-300 hover:bg-gray-400 border border-black hover:border-gray-600 rounded-md transition-colors cursor-pointer flex items-center"
                                                        aria-label="Edit module title"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMoveModuleUp(module.id);
                                                        }}
                                                        disabled={index === 0 || swappingModuleUpId === module.id}
                                                        className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                        aria-label="Move module up"
                                                    >
                                                        {swappingModuleUpId === module.id ? (
                                                            <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                                                        ) : (
                                                            <ChevronUp size={18} />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMoveModuleDown(module.id);
                                                        }}
                                                        disabled={index === modules.length - 1 || swappingModuleDownId === module.id}
                                                        className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                        aria-label="Move module down"
                                                    >
                                                        {swappingModuleDownId === module.id ? (
                                                            <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                                                        ) : (
                                                            <ChevronDown size={18} />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setModuleToDelete(module.id);
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                                        aria-label="Delete module"
                                                        disabled={deletingModuleId === module.id}
                                                    >
                                                        {deletingModuleId === module.id ? (
                                                            <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                                                        ) : (
                                                            <Trash size={18} />
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Add expand/collapse button on the right side for view mode */}
                                    {mode === 'view' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Prevent toggling locked modules
                                                if (module.unlockAt) return;

                                                onToggleModule(module.id);

                                            }}
                                            className={`flex items-center px-3 py-1 text-sm focus:outline-none focus:ring-0 focus:border-0 transition-colors rounded-full border ${module.unlockAt ? 'text-gray-500 border-gray-600 bg-gray-800 cursor-not-allowed' : 'text-gray-400 hover:text-white border-gray-700 bg-gray-900 cursor-pointer'}`}
                                            aria-label={getIsExpanded(module.id) ? "Collapse module" : "Expand module"}
                                            disabled={!!module.unlockAt}
                                        >
                                            {getIsExpanded(module.id) ? (
                                                <>
                                                    <ChevronUp size={16} className="mr-1" />
                                                    <span className="hidden sm:inline">Collapse</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown size={16} className="mr-1" />
                                                    <span className="hidden sm:inline">Expand</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Progress information and bar - shown differently based on expanded state */}
                                {mode === 'view' && module.progress !== undefined && (
                                    <div className={`${module.unlockAt ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                        {getIsExpanded(module.id) ? (
                                            <div className="px-4 pb-2">
                                                <div className="flex justify-end items-center mb-1">
                                                    <div className="text-sm text-gray-400">
                                                        {module.progress}%
                                                    </div>
                                                </div>
                                                <div className="w-full bg-gray-700 h-2 rounded-full">
                                                    <div
                                                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${module.progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="px-4 pb-4">
                                                <div className="flex justify-end items-center mb-1">
                                                    <div className="text-sm text-gray-400">
                                                        {module.progress}%
                                                    </div>
                                                </div>
                                                <div className="w-full bg-gray-700 h-2 rounded-full">
                                                    <div
                                                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${module.progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Module content - only visible when expanded */}
                            {getIsExpanded(module.id) && (
                                <div className="px-4 pb-4">
                                    <div className="pl-2 sm:pl-6 border-l border-gray-400 ml-2 space-y-2">
                                        {module.items.map((item, itemIndex) => (
                                            <div
                                                key={item.id}
                                                data-testid={`module-item-${item.id}`}
                                                className={`flex items-center group p-2 rounded-md cursor-pointer transition-all relative mt-2 hover:bg-gray-700/50 ${completedItems[item.id] ? "opacity-60" : ""
                                                    } ${item.isGenerating ? "opacity-40 pointer-events-none" : ""
                                                    }`}
                                                onClick={() => {
                                                    if (!onOpenItem || item.isGenerating) return;
                                                    let questionId: string | undefined = undefined;
                                                    if (item.type === 'quiz' && completedQuestionIds[item.id]) {
                                                        const questionIds = Object.keys(completedQuestionIds[item.id]);
                                                        if (questionIds.length > 0) {
                                                            questionId = questionIds[0];
                                                        }
                                                    }
                                                    onOpenItem(module.id, item.id, questionId);
                                                }}
                                            >
                                                <div className={`flex items-center justify-center mr-4 sm:mr-2 ${completedItems[item.id]
                                                    ? "opacity-50"
                                                    : "opacity-100"
                                                    }`}>
                                                    {/* Enhanced visual distinction with color and better icons */}
                                                    {item.type === 'material' ? (
                                                        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${completedItems[item.id]
                                                            ? "bg-green-500/15"
                                                            : "bg-blue-500/15"
                                                            }`}>
                                                            <BookOpen size={16} className={`${completedItems[item.id]
                                                                ? "text-green-500"
                                                                : "text-blue-400"
                                                                }`} />
                                                        </div>
                                                    ) : item.type === 'assignment' ? (
                                                        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${completedItems[item.id]
                                                            ? "bg-green-500/15"
                                                            : "bg-orange-500/15"
                                                            }`}>
                                                            <PenSquare size={16} className={`${completedItems[item.id]
                                                                ? "text-green-500"
                                                                : "text-orange-400"
                                                                }`} />
                                                        </div>
                                                    ) : (
                                                        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${completedItems[item.id]
                                                            ? "bg-green-500/15"
                                                            : (completedQuestionIds[item.id] &&
                                                                Object.keys(completedQuestionIds[item.id]).some(qId => completedQuestionIds[item.id][qId] === true)
                                                                ? "bg-yellow-500/15"
                                                                : "bg-purple-500/15")
                                                            }`}>
                                                            <ClipboardList size={16} className={completedItems[item.id]
                                                                ? "text-green-500"
                                                                : completedQuestionIds[item.id] &&
                                                                    Object.keys(completedQuestionIds[item.id]).some(qId => completedQuestionIds[item.id][qId] === true)
                                                                    ? "text-yellow-500"
                                                                    : "text-white"
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
                                                <div className="flex-1">
                                                    <div className={`text-base font-light ${completedItems[item.id]
                                                        ? "line-through text-white"
                                                        : (item.type === 'quiz') &&
                                                            completedQuestionIds[item.id] &&
                                                            Object.keys(completedQuestionIds[item.id]).some(qId => completedQuestionIds[item.id][qId] === true)
                                                            ? "text-yellow-500"
                                                            : "text-white"
                                                        } outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none mr-2`}>
                                                        {item.title}

                                                        {/* Always display question count for quizzes (except drafts) */}
                                                        {item.type === 'quiz' && item.status !== 'draft' && (
                                                            <span className={`inline-block ml-2 text-sm font-normal ${!completedItems[item.id] &&
                                                                completedQuestionIds[item.id] &&
                                                                Object.keys(completedQuestionIds[item.id]).some(qId => completedQuestionIds[item.id][qId] === true)
                                                                ? "text-yellow-500"
                                                                : "text-gray-400"
                                                                }`}>
                                                                ({completedQuestionIds[item.id]
                                                                    ? mode === 'view' && !completedItems[item.id] && Object.keys(completedQuestionIds[item.id]).some(qId => completedQuestionIds[item.id][qId] === true)
                                                                        ? `${Object.values(completedQuestionIds[item.id]).filter(Boolean).length} / ${(item as Quiz).numQuestions}`
                                                                        : `${Object.keys(completedQuestionIds[item.id]).length} question${Object.keys(completedQuestionIds[item.id]).length === 1 ? "" : "s"}`
                                                                    : `${(item as Quiz).numQuestions} question${(item as Quiz).numQuestions === 1 ? "" : "s"}`})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Item action buttons - only in edit mode */}
                                                {mode === 'edit' && (
                                                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                                                        {item.status === 'draft' && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500 text-white">
                                                                DRAFT
                                                            </span>
                                                        )}
                                                        {item.status === 'published' && item.scheduled_publish_at && (
                                                            <Tooltip content={`Scheduled for ${formatScheduleDate(new Date(item.scheduled_publish_at))}`} position="top">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-900 text-white">
                                                                    SCHEDULED
                                                                </span>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip content="Duplicate as draft" position="top">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDuplicateTask(module.id, item.id);
                                                                }}
                                                                disabled={duplicatingTaskId === item.id}
                                                                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                                aria-label="Duplicate task as draft"
                                                            >
                                                                {duplicatingTaskId === item.id ? (
                                                                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                                                                ) : (
                                                                    <Copy size={16} />
                                                                )}
                                                            </button>
                                                        </Tooltip>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMoveTaskUp(module.id, item.id);
                                                            }}
                                                            disabled={itemIndex === 0 || swappingTaskUpId === item.id}
                                                            className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                            aria-label="Move item up"
                                                        >
                                                            {swappingTaskUpId === item.id ? (
                                                                <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                                                            ) : (
                                                                <ChevronUp size={16} />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMoveTaskDown(module.id, item.id);
                                                            }}
                                                            disabled={itemIndex === module.items.length - 1 || swappingTaskDownId === item.id}
                                                            className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                            aria-label="Move item down"
                                                        >
                                                            {swappingTaskDownId === item.id ? (
                                                                <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                                                            ) : (
                                                                <ChevronDown size={16} />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (onDeleteItem) {
                                                                    setTaskToDelete({
                                                                        moduleId: module.id,
                                                                        itemId: item.id,
                                                                        itemType: item.type
                                                                    });
                                                                }
                                                            }}
                                                            className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                                            aria-label="Delete item"
                                                            disabled={deletingTaskId === item.id}
                                                        >
                                                            {deletingTaskId === item.id ? (
                                                                <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                                                            ) : (
                                                                <Trash size={16} />
                                                            )}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Completion checkbox - only in view mode */}
                                                {mode === 'view' && (
                                                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors cursor-pointer ${completedItems[item.id]
                                                                ? "bg-green-500 border-0"
                                                                : "border border-gray-500 hover:border-white"
                                                                }`}
                                                            aria-label={completedItems[item.id] ? "Mark as incomplete" : "Mark as completed"}
                                                        >
                                                            {completedItems[item.id] ? (
                                                                <Check size={12} className="text-white" />
                                                            ) : null}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Add item buttons - only in edit mode */}
                                        {mode === 'edit' && (
                                            <div className="flex space-x-2 mt-4">
                                                <Tooltip content="Add learning material to teach a topic in the module" position="top">
                                                    <button
                                                        onClick={async () => {
                                                            if (onAddLearningMaterial) {
                                                                try {
                                                                    await onAddLearningMaterial(module.id);
                                                                } catch (error) {
                                                                    console.error("Failed to add learning material:", error);
                                                                }
                                                            }
                                                        }}
                                                        className="flex items-center px-3 py-1.5 text-sm text-gray-300 hover:text-white border border-gray-400 rounded-full transition-colors cursor-pointer"
                                                    >
                                                        <Plus size={14} className="mr-1" />
                                                        Learning material
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Create a quiz for practice or assessment" position="top">
                                                    <button
                                                        onClick={async () => {
                                                            if (onAddQuiz) {
                                                                try {
                                                                    await onAddQuiz(module.id);
                                                                } catch (error) {
                                                                    console.error("Failed to add quiz:", error);
                                                                }
                                                            }
                                                        }}
                                                        className="flex items-center px-3 py-1.5 text-sm text-gray-300 hover:text-white border border-gray-400 rounded-full transition-colors cursor-pointer"
                                                    >
                                                        <Plus size={14} className="mr-1" />
                                                        Quiz
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Add a new project/assignment" position="top">
                                                    <button
                                                        onClick={async () => {
                                                            if (onAddAssignment) {
                                                                try {
                                                                    await onAddAssignment(module.id);
                                                                } catch (error) {
                                                                    console.error("Failed to add assignment:", error);
                                                                }
                                                            }
                                                        }}
                                                        className="flex items-center px-3 py-1.5 text-sm text-gray-300 hover:text-white border border-gray-400 rounded-full transition-colors cursor-pointer"
                                                    >
                                                        <Plus size={14} className="mr-1" />
                                                        Assignment
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );

                    return module.unlockAt ? (
                        <Tooltip key={module.id} content={`Unlocks on ${formatUnlockDate(module.unlockAt)}`} className="w-full block" position="top">
                            {moduleContent}
                        </Tooltip>
                    ) : (
                        moduleContent
                    );
                })}
            </div>

            {/* Add CourseItemDialog inside the CourseModuleList component */}
            < CourseItemDialog
                isOpen={isDialogOpen}
                activeItem={activeItem}
                activeModuleId={activeModuleId}
                activeQuestionId={activeQuestionId}
                isEditMode={isEditMode}
                isPreviewMode={isPreviewMode}
                showPublishConfirmation={showPublishConfirmation}
                dialogTitleRef={dialogTitleRef}
                dialogContentRef={dialogContentRef}
                onClose={closeDialog}
                onPublishConfirm={handleConfirmPublish}
                onPublishCancel={handleCancelPublish}
                onSetShowPublishConfirmation={setShowPublishConfirmation}
                onSaveItem={saveItem}
                onCancelEditMode={cancelEditMode}
                onEnableEditMode={enableEditMode}
                onQuizContentChange={handleQuizContentChange}
                onQuestionChange={onQuestionChange}
                focusEditor={focusEditor}
                schoolId={schoolId}
                courseId={courseId}
            />

            {/* Module deletion confirmation dialog */}
            < ConfirmationDialog
                open={moduleToDelete !== null
                }
                title="Are you sure you want to delete this module?"
                message="All tasks within this module will be permanently removed. This action cannot be undone."
                confirmButtonText="Delete"
                onConfirm={handleConfirmModuleDelete}
                onCancel={handleCancelModuleDelete}
                type="delete"
                data-testid="module-delete-dialog"
            />

            {/* Task deletion confirmation dialog */}
            {
                taskToDelete && (
                    <ConfirmationDialog
                        open={taskToDelete !== null}
                        title={`Are you sure you want to delete this ${getItemTypeName(taskToDelete.itemType)}?`}
                        message={`This ${getItemTypeName(taskToDelete.itemType)} will be permanently removed. This action cannot be undone.`}
                        confirmButtonText={`Delete`}
                        onConfirm={handleConfirmTaskDelete}
                        onCancel={handleCancelTaskDelete}
                        type="delete"
                        data-testid="task-delete-dialog"
                    />
                )
            }
        </>
    );
} 