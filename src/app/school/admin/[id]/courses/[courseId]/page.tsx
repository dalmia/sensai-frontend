"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown, X, ChevronRight, ChevronDown as ChevronDownExpand, Plus, BookOpen, HelpCircle, Trash, Zap, Eye, Check, FileEdit, Clipboard, ArrowLeft, Pencil, Users, UsersRound, ExternalLink, Sparkles, Loader2, Share, Settings } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import CourseModuleList from "@/components/CourseModuleList";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import Toast from "@/components/Toast";
import CoursePublishSuccessBanner from "@/components/CoursePublishSuccessBanner";
import { Module, ModuleItem, LearningMaterial, Quiz, DripConfig } from "@/types/course";
import { Milestone } from "@/types";
import { transformMilestonesToModules } from "@/lib/course";
import { CourseCohortSelectionDialog } from "@/components/CourseCohortSelectionDialog";
import { addModule } from "@/lib/api";
import Tooltip from "@/components/Tooltip";
import GenerateWithAIDialog, { GenerateWithAIFormData } from '@/components/GenerateWithAIDialog';
import SettingsDialog from "@/components/SettingsDialog";
import { updateTaskAndQuestionIdInUrl } from "@/lib/utils/urlUtils";
import { useThemePreference } from "@/lib/hooks/useThemePreference";

// Import the QuizQuestion type
import { QuizQuestion, QuizQuestionConfig } from "../../../../../../types/quiz";

// Import the CreateCohortDialog
import CreateCohortDialog from '@/components/CreateCohortDialog';

interface CourseDetails {
    id: number;
    name: string;
    milestones?: Milestone[];
}

// Default configuration for new questions
const defaultQuestionConfig: QuizQuestionConfig = {
    inputType: 'text',
    responseType: 'chat',
    questionType: 'objective',
    knowledgeBaseBlocks: [],
    linkedMaterialIds: [],
};


export default function CreateCourse() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const schoolId = params.id as string;
    const courseId = params.courseId as string;
    const [schoolSlug, setSchoolSlug] = useState<string>('');

    const [courseTitle, setCourseTitle] = useState("Loading course...");
    const [modules, setModules] = useState<Module[]>([]);
    const [activeItem, setActiveItem] = useState<ModuleItem | null>(null);
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { themePreference, setThemePreference, isDarkMode } = useThemePreference();
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const [lastUsedColorIndex, setLastUsedColorIndex] = useState<number>(-1);
    const [isCourseTitleEditing, setIsCourseTitleEditing] = useState(false);
    const [isEditMode, setIsEditMode] = useState<boolean>(false);
    const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const [cohorts, setCohorts] = useState<any[]>([]);
    const [isLoadingCohorts, setIsLoadingCohorts] = useState(false);
    const [cohortSearchQuery, setCohortSearchQuery] = useState('');
    const [filteredCohorts, setFilteredCohorts] = useState<any[]>([]);
    const [cohortError, setCohortError] = useState<string | null>(null);
    // Add state for course cohorts
    const [courseCohorts, setCourseCohorts] = useState<any[]>([]);
    const [isLoadingCourseCohorts, setIsLoadingCourseCohorts] = useState(false);
    // Add state to track total cohorts in the school
    const [totalSchoolCohorts, setTotalSchoolCohorts] = useState<number>(0);
    // Add refs for both buttons to position the dropdown
    const publishButtonRef = useRef<HTMLButtonElement>(null);
    const addCohortButtonRef = useRef<HTMLButtonElement>(null);
    // Add state to track which button opened the dialog
    const [dialogOrigin, setDialogOrigin] = useState<'publish' | 'add' | null>(null);
    // Add state for toast notifications
    const [toast, setToast] = useState({
        show: false,
        title: '',
        description: '',
        emoji: ''
    });
    // Add state for cohort removal confirmation
    const [cohortToRemove, setCohortToRemove] = useState<{ id: number, name: string } | null>(null);
    const [showRemoveCohortConfirmation, setShowRemoveCohortConfirmation] = useState(false);

    // Add state for celebratory banner
    const [showCelebratoryBanner, setShowCelebratoryBanner] = useState(false);
    const [celebrationDetails, setCelebrationDetails] = useState({
        cohortId: 0,
        cohortName: ''
    });

    // Add a new state for direct create cohort dialog
    const [showCreateCohortDialog, setShowCreateCohortDialog] = useState(false);

    // Add state for AI generation dialog
    const [showGenerateDialog, setShowGenerateDialog] = useState(false);

    // Add state for course generation loading state
    const [isGeneratingCourse, setIsGeneratingCourse] = useState(false);

    const [isCourseStructureGenerated, setIsCourseStructureGenerated] = useState(false);

    // Add state for generation progress messages
    const [generationProgress, setGenerationProgress] = useState<string[]>([]);

    // Add a ref to store the WebSocket connection
    const wsRef = useRef<WebSocket | null>(null);
    // Add a ref for the heartbeat interval
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Add these new state variables after the existing state declarations
    const [totalTasksToGenerate, setTotalTasksToGenerate] = useState(0);
    const [generatedTasksCount, setGeneratedTasksCount] = useState(0);

    // Add a new state variable to track generation completion
    const [isGenerationComplete, setIsGenerationComplete] = useState(false);

    // Add these refs after the existing refs declaration
    const isGeneratingCourseRef = useRef(false);
    const totalTasksToGenerateRef = useRef(0);
    const generatedTasksCountRef = useRef(0);

    // Add state for selected cohort
    const [selectedCohort, setSelectedCohort] = useState<any | null>(null);

    const [dripConfig, setDripConfig] = useState<DripConfig | undefined>(undefined);

    const [selectedCohortForSettings, setSelectedCohortForSettings] = useState<any | null>(null);

    const taskId = searchParams.get('taskId');
    const questionId = searchParams.get('questionId');

    // Update the refs whenever the state changes
    useEffect(() => {
        isGeneratingCourseRef.current = isGeneratingCourse;
    }, [isGeneratingCourse]);

    useEffect(() => {
        totalTasksToGenerateRef.current = totalTasksToGenerate;
    }, [totalTasksToGenerate]);

    useEffect(() => {
        generatedTasksCountRef.current = generatedTasksCount;
    }, [generatedTasksCount]);

    useEffect(() => {
        if (taskId && modules.length > 0) {
            // Find the module containing this item
            for (const module of modules) {
                const item = module.items.find(i => i.id === taskId);
                if (item) {
                    const preserveEdit = isDialogOpen && activeItem?.id === taskId;
                    openItemDialog(module.id, taskId, questionId, { preserveEditMode: preserveEdit });
                    break;
                }
            }
        } else if (!taskId) {
            setIsDialogOpen(false);
        }
    }, [taskId, questionId, modules.length]);

    // Extract fetchCourseDetails as a standalone function
    const fetchCourseDetails = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${courseId}?only_published=false`);

            if (!response.ok) {
                throw new Error(`Failed to fetch course details: ${response.status}`);
            }

            const data = await response.json();
            setCourseTitle(data.name);

            // Check if milestones are available in the response
            if (data.milestones && Array.isArray(data.milestones)) {
                // Use the shared utility function to transform the milestones to modules
                const transformedModules = transformMilestonesToModules(data.milestones);

                // Add isEditing property required by the admin view
                const modulesWithEditing = transformedModules.map(module => ({
                    ...module,
                    isEditing: false
                }));

                // Check if any task in the course has isGenerating = true
                const totalTasksToGenerate = modulesWithEditing.reduce((count, module) =>
                    count + (module.items?.filter(item => item.isGenerating !== null)?.length || 0), 0
                );
                const generatedTasksCount = modulesWithEditing.reduce((count, module) =>
                    count + (module.items?.filter(item => item.isGenerating === false)?.length || 0), 0
                );

                // Set up WebSocket connection if any task is being generated
                if (totalTasksToGenerate && totalTasksToGenerate != generatedTasksCount) {
                    const ws = setupGenerationWebSocket();

                    if (!ws) {
                        throw new Error('Failed to setup WebSocket connection');
                    }

                    wsRef.current = ws;
                    console.log('WebSocket connection established for active generation task');

                    setIsGeneratingCourse(true);
                    setIsCourseStructureGenerated(true);
                    setIsGenerationComplete(false);
                    setTotalTasksToGenerate(totalTasksToGenerate);
                    setGeneratedTasksCount(generatedTasksCount);
                    setGenerationProgress(["Uploaded reference material", 'Generating course plan', 'Course plan complete', 'Generating learning materials and quizzes']);
                }

                // Set the modules state
                setModules(modulesWithEditing);
            }

            setIsLoading(false);
        } catch (err) {
            console.error("Error fetching course details:", err);
            setError("Failed to load course details. Please try again later.");
            setIsLoading(false);
        }
    };

    // Fetch course details from the backend
    useEffect(() => {
        fetchCourseDetails();

        // Also fetch cohorts assigned to this course
        fetchCourseCohorts();

        // Fetch school details to get the slug
        const fetchSchoolDetails = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${schoolId}`);
                if (response.ok) {
                    const schoolData = await response.json();
                    setSchoolSlug(schoolData.slug);
                }
            } catch (error) {
                console.error("Error fetching school details:", error);
            }
        };

        fetchSchoolDetails();
    }, [courseId]);

    // Check for Integration OAuth callback and enable edit mode if coming from published content
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');

        if (accessToken) {
            const hasPublishedContent = modules.some(module =>
                module.items.some(item => item.status === 'published')
            );

            if (hasPublishedContent) {
                setIsEditMode(true);
            }
        }
    }, [modules]);

    // Set initial content and focus on newly added modules and items
    useEffect(() => {
        // Focus the newly added module
        if (activeModuleId) {
            const moduleElement = document.querySelector(`[data-module-id="${activeModuleId}"]`) as HTMLHeadingElement;

            if (moduleElement) {
                moduleElement.focus();
            }
        }

        // Focus the newly added item
        if (activeItem && activeItem.id) {
            const itemElement = document.querySelector(`[data-item-id="${activeItem.id}"]`) as HTMLHeadingElement;

            if (itemElement) {
                itemElement.focus();
            }
        }
    }, [modules, activeModuleId, activeItem]);

    // Handle Escape key to close dialog
    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDialogOpen) {
                closeDialog();
            }
        };

        window.addEventListener('keydown', handleEscKey);
        return () => {
            window.removeEventListener('keydown', handleEscKey);
        };
    }, [isDialogOpen]);

    // Handle clicks outside of the dropdown for the publish dialog

    // Add back the handleKeyDown function for module titles
    const handleKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
        // Prevent creating a new line when pressing Enter
        if (e.key === "Enter") {
            e.preventDefault();

            // Remove focus
            (e.currentTarget as HTMLHeadingElement).blur();
        }
    };

    const updateModuleTitle = (id: string, title: string) => {
        setModules(prevModules => prevModules.map(module =>
            module.id === id ? { ...module, title } : module
        ));
    };

    const toggleModuleEditing = (id: string, isEditing: boolean) => {
        setModules(prevModules => prevModules.map(module =>
            module.id === id ? { ...module, isEditing } : module
        ));
    };

    const deleteModule = (id: string) => {
        setModules(prevModules => {
            const filteredModules = prevModules.filter(module => module.id !== id);
            // Update positions after deletion
            return filteredModules.map((module, index) => ({
                ...module,
                position: index
            }));
        });
    };

    const moveModuleUp = (id: string) => {
        setModules(prevModules => {
            const index = prevModules.findIndex(module => module.id === id);
            if (index <= 0) return prevModules;

            const newModules = [...prevModules];
            // Swap with previous module
            [newModules[index - 1], newModules[index]] = [newModules[index], newModules[index - 1]];

            // Update positions
            return newModules.map((module, idx) => ({
                ...module,
                position: idx
            }));
        });
    };

    const moveModuleDown = (id: string) => {
        setModules(prevModules => {
            const index = prevModules.findIndex(module => module.id === id);
            if (index === -1 || index === prevModules.length - 1) return prevModules;

            const newModules = [...prevModules];
            // Swap with next module
            [newModules[index], newModules[index + 1]] = [newModules[index + 1], newModules[index]];

            // Update positions
            return newModules.map((module, idx) => ({
                ...module,
                position: idx
            }));
        });
    };

    const toggleModule = (id: string) => {
        setModules(prevModules => prevModules.map(module =>
            module.id === id ? { ...module, isExpanded: !module.isExpanded } : module
        ));
    };

    // Add these new helper functions after the toggleModule function and before the addLearningMaterial function
    // Helper function to add an item to a module's items array at a specific position
    const addItemToState = (moduleId: string, newItem: ModuleItem, position: number) => {
        setActiveItem(newItem);
        setActiveModuleId(moduleId);
        setIsDialogOpen(true); // Open the dialog for the new item
        updateTaskAndQuestionIdInUrl(router, newItem.id, null);

        setModules(prevModules => prevModules.map(module => {
            if (module.id === moduleId) {
                // Insert the new item at the correct position and update positions of items below
                const items = [
                    ...module.items.slice(0, position),
                    newItem,
                    ...module.items.slice(position).map(item => ({
                        ...item,
                        position: item.position + 1
                    }))
                ];
                return {
                    ...module,
                    items: items
                };
            }
            return module;
        }));

        return newItem;
    };

    const addLearningMaterialToState = (moduleId: string, taskData: any, position: number) => {
        const newItem: LearningMaterial = {
            id: taskData.id.toString(),
            title: taskData.title || "New learning material",
            position: position,
            type: 'material',
            content: [], // Empty content, the editor will initialize with default content
            status: 'draft',
            scheduled_publish_at: null
        };

        return addItemToState(moduleId, newItem, position);
    };

    const addQuizToState = (moduleId: string, taskData: any, position: number) => {
        const newItem: Quiz = {
            id: taskData.id.toString(),
            title: taskData.title || "New quiz",
            position: position,
            type: 'quiz',
            questions: taskData.questions || [],
            status: 'draft',
            scheduled_publish_at: null
        };

        return addItemToState(moduleId, newItem, position);
    };

    const addAssignmentToState = (moduleId: string, taskData: any, position: number) => {
        const newItem = {
            id: taskData.id.toString(),
            title: taskData.title || "New assignment",
            position: position,
            type: 'assignment',
            status: 'draft',
            scheduled_publish_at: null
        } as ModuleItem;

        return addItemToState(moduleId, newItem, position);
    };

    // Add handleDuplicateItem function to handle task duplication
    const handleDuplicateItem = async (moduleId: string, taskData: any, position: number) => {
        try {
            // Find the original module for placement
            const module = modules.find(m => m.id === moduleId);
            if (!module) return;

            // Update the UI based on the task type
            if (taskData.type === "learning_material") {
                addLearningMaterialToState(moduleId, taskData, position);
            } else if (taskData.type === "quiz") {
                addQuizToState(moduleId, taskData, position);
            } else if (taskData.type === "assignment") {
                addAssignmentToState(moduleId, taskData, position);
            }

            // Auto-hide toast after 3 seconds
            setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 3000);

        } catch (error) {
            console.error("Error handling duplicated item:", error);

            // Show error toast
            setToast({
                show: true,
                title: 'Cloning Failed',
                description: 'There was an error duplicating the task',
                emoji: '❌'
            });

            // Auto-hide toast after 3 seconds
            setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 3000);
        }
    };

    // Modify the existing addLearningMaterial function to use the new helper
    const addLearningMaterial = async (moduleId: string) => {
        try {
            // Make API request to create a new learning material
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    course_id: parseInt(courseId),
                    milestone_id: parseInt(moduleId),
                    type: "learning_material",
                    title: "New learning material",
                    status: "draft",
                    scheduled_publish_at: null
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to create learning material: ${response.status}`);
            }

            // Get the learning material ID from the response
            const data = await response.json();

            // Update the UI using the abstracted helper function
            addLearningMaterialToState(moduleId, data, modules.find(m => m.id === moduleId)?.items.length || 0);
        } catch (error) {
            console.error("Error creating learning material:", error);
            // You might want to show an error message to the user here
        }
    };

    // Modify the existing addQuiz function to use the new helper
    const addQuiz = async (moduleId: string) => {
        try {
            // Make API request to create a new quiz
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    course_id: parseInt(courseId),
                    milestone_id: parseInt(moduleId),
                    type: "quiz",
                    title: "New quiz",
                    status: "draft"
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to create quiz: ${response.status}`);
            }

            // Get the quiz ID from the response
            const data = await response.json();

            // Update the UI using the abstracted helper function
            addQuizToState(moduleId, data, modules.find(m => m.id === moduleId)?.items.length || 0);
        } catch (error) {
            console.error("Error creating quiz:", error);
            // You might want to show an error message to the user here
        }
    };

    const addAssignment = async (moduleId: string) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    course_id: parseInt(courseId),
                    milestone_id: parseInt(moduleId),
                    type: "assignment",
                    title: "New assignment",
                    status: "draft"
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to create assignment: ${response.status}`);
            }

            const data = await response.json();

            addAssignmentToState(moduleId, data, modules.find(m => m.id === moduleId)?.items.length || 0);
        } catch (error) {
            console.error("Error creating assignment:", error);
        }
    };

    const deleteItem = (moduleId: string, itemId: string) => {
        setModules(prevModules => prevModules.map(module => {
            if (module.id === moduleId) {
                const filteredItems = module.items.filter(item => item.id !== itemId);
                return {
                    ...module,
                    items: filteredItems.map((item, index) => ({
                        ...item,
                        position: index
                    }))
                };
            }
            return module;
        }));
    };

    const moveItemUp = (moduleId: string, itemId: string) => {
        setModules(prevModules => prevModules.map(module => {
            if (module.id === moduleId) {
                const index = module.items.findIndex(item => item.id === itemId);
                if (index <= 0) return module;

                const newItems = [...module.items];
                [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];

                return {
                    ...module,
                    items: newItems.map((item, idx) => ({
                        ...item,
                        position: idx
                    }))
                };
            }
            return module;
        }));
    };

    const moveItemDown = (moduleId: string, itemId: string) => {
        setModules(prevModules => prevModules.map(module => {
            if (module.id === moduleId) {
                const index = module.items.findIndex(item => item.id === itemId);
                if (index === -1 || index === module.items.length - 1) return module;

                const newItems = [...module.items];
                [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];

                return {
                    ...module,
                    items: newItems.map((item, idx) => ({
                        ...item,
                        position: idx
                    }))
                };
            }
            return module;
        }));
    };

    // Open the dialog for editing a learning material or quiz
    const openItemDialog = (
        moduleId: string,
        itemId: string,
        questionId?: string | null,
        options?: { preserveEditMode?: boolean }
    ) => {
        const module = modules.find(m => m.id === moduleId);
        if (!module) return;

        const item = module.items.find(i => i.id === itemId);
        if (!item) return;

        // When navigating between questions for a published quiz, preserve current edit mode
        if (!options?.preserveEditMode) {
            setIsEditMode(false);
        }
        setActiveQuestionId(questionId || null);

        updateTaskAndQuestionIdInUrl(router, itemId, questionId);

        // Ensure quiz items have questions property initialized
        if (item.type === 'quiz' && !item.questions) {
            const updatedItem = {
                ...item,
                questions: [{ id: `question-${Date.now()}`, content: [], config: { ...defaultQuestionConfig } }]
            } as Quiz;

            // Update the module with the fixed item
            setModules(prevModules =>
                prevModules.map(m =>
                    m.id === moduleId
                        ? {
                            ...m,
                            items: m.items.map(i => i.id === itemId ? updatedItem : i)
                        }
                        : m
                ) as Module[]
            );

            setActiveItem(updatedItem);
            setActiveModuleId(moduleId);
            setIsPreviewMode(false);
            setIsDialogOpen(true);
        } else if (item.type === 'material') {
            // For learning materials, we don't need to fetch content here
            // The LearningMaterialEditor will fetch its own data using the taskId
            setActiveItem(item);
            setActiveModuleId(moduleId);
            setIsPreviewMode(false);
            setIsDialogOpen(true);
        } else {
            // For other types like exams, just open the dialog
            setActiveItem(item);
            setActiveModuleId(moduleId);
            setIsPreviewMode(false);
            setIsDialogOpen(true);
        }
    };

    // Handle question change in quiz editor
    const handleQuestionChange = (questionId: string) => {
        setActiveQuestionId(questionId);

        // Only update URL if the questionId is different from current URL
        const currentQuestionId = searchParams.get('questionId');
        if (currentQuestionId !== questionId) {
            updateTaskAndQuestionIdInUrl(router, activeItem?.id, questionId);
        }
    };

    // Close the dialog
    const closeDialog = () => {
        // Clean up the URL (remove taskId and questionId)
        updateTaskAndQuestionIdInUrl(router, null, null);

        setIsDialogOpen(false);
        setActiveItem(null);
        setActiveModuleId(null);
        setActiveQuestionId(null);
        setIsEditMode(false);
    };

    // Cancel edit mode and revert to original state
    const cancelEditMode = () => {
        // For learning materials, the LearningMaterialEditor has already reverted the changes
        // We need to revert the activeItem object to reflect the original state
        if (activeItem && activeModuleId && activeItem.type === 'material') {
            // Find the original module item from modules state
            const module = modules.find(m => m.id === activeModuleId);
            if (module) {
                const originalItem = module.items.find(i => i.id === activeItem.id);
                if (originalItem) {
                    // Reset activeItem to match the original state
                    setActiveItem({
                        ...originalItem
                    });
                }
            }
        }

        // Exit edit mode without saving changes
        setIsEditMode(false);
    };

    // Add a function to update quiz questions
    const updateQuizQuestions = (moduleId: string, itemId: string, questions: QuizQuestion[]) => {
        setModules(prevModules =>
            prevModules.map(module => {
                if (module.id === moduleId) {
                    return {
                        ...module,
                        items: module.items.map(item => {
                            if (item.id === itemId && item.type === 'quiz') {
                                return {
                                    ...item,
                                    questions
                                } as Quiz;
                            }
                            return item;
                        })
                    };
                }
                return module;
            })
        );
    };

    // Handle quiz content changes
    const handleQuizContentChange = (questions: QuizQuestion[]) => {
        if (activeItem && activeModuleId && activeItem.type === 'quiz') {
            updateQuizQuestions(activeModuleId, activeItem.id, questions);
        }
    };

    // Add a new function to handle the actual publishing after confirmation
    const handleConfirmPublish = async () => {
        if (!activeItem || !activeModuleId) {
            console.error("Cannot publish: activeItem or activeModuleId is missing");
            setShowPublishConfirmation(false);
            return;
        }

        // For learning materials and quizzes, the API call is now handled in their respective components
        // We need to update the modules list to reflect the status change
        // The title update is handled in the CourseItemDialog's onPublishSuccess callback

        // Update the module item in the modules list with the updated status and title
        updateModuleItemAfterPublish(activeModuleId, activeItem.id, 'published', activeItem.title, activeItem.scheduled_publish_at);

        // Hide the confirmation dialog
        setShowPublishConfirmation(false);
    };

    // Add a function to update a module item's status and title
    const updateModuleItemAfterPublish = (moduleId: string, itemId: string, status: string, title: string, scheduled_publish_at: string | null) => {
        setModules(prevModules =>
            prevModules.map(module => {
                if (module.id === moduleId) {
                    return {
                        ...module,
                        items: module.items.map(item => {
                            if (item.id === itemId) {
                                // Get numQuestions from activeItem if available (for quizzes)
                                const numQuestions = activeItem &&
                                    activeItem.type === 'quiz' &&
                                    activeItem.questions ?
                                    activeItem.questions.length : undefined;

                                return {
                                    ...item,
                                    status,
                                    title,
                                    scheduled_publish_at,
                                    ...(numQuestions !== undefined && item.type === 'quiz' ? { numQuestions } : {})
                                };
                            }
                            return item;
                        })
                    };
                }
                return module;
            })
        );
    };

    // Add a function to handle canceling the publish action
    const handleCancelPublish = () => {
        setShowPublishConfirmation(false);
    };

    const saveModuleTitle = async (moduleId: string) => {
        // Find the heading element by data attribute
        const headingElement = document.querySelector(`[data-module-id="${moduleId}"]`) as HTMLHeadingElement;
        if (headingElement) {
            // Get the current content
            const newTitle = headingElement.textContent || "";

            try {
                // Make API call to update the milestone on the server
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/milestones/${moduleId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: newTitle
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Failed to update module title: ${response.status}`);
                }

                // If successful, update the state
                updateModuleTitle(moduleId, newTitle);
                console.log("Module title updated successfully");

                // Show toast notification
                setToast({
                    show: true,
                    title: 'A makeover',
                    description: `Module name updated successfully`,
                    emoji: '✨'
                });

                // Auto-hide toast after 3 seconds
                setTimeout(() => {
                    setToast(prev => ({ ...prev, show: false }));
                }, 3000);
            } catch (error) {
                console.error("Error updating module title:", error);

                // Still update the local state even if the API call fails
                // This provides a better user experience while allowing for retry later
                updateModuleTitle(moduleId, newTitle);

                // Show error toast
                setToast({
                    show: true,
                    title: 'Update Failed',
                    description: 'Failed to update module title, but changes were saved locally',
                    emoji: '⚠️'
                });

                // Auto-hide toast after 3 seconds
                setTimeout(() => {
                    setToast(prev => ({ ...prev, show: false }));
                }, 3000);
            }
        }

        // Turn off editing mode
        toggleModuleEditing(moduleId, false);
    };

    const cancelModuleEditing = (moduleId: string) => {
        // Find the heading element
        const headingElement = document.querySelector(`[data-module-id="${moduleId}"]`) as HTMLHeadingElement;
        if (headingElement) {
            // Reset the content to the original title from state
            const module = modules.find(m => m.id === moduleId);
            if (module) {
                headingElement.textContent = module.title;
            }
        }
        // Turn off editing mode
        toggleModuleEditing(moduleId, false);
    };

    // Add this helper function before the return statement
    const hasAnyItems = () => {
        return modules.some(module =>
            module.items.some(item => item.status !== 'draft')
        );
    };

    // Add these functions for course title editing
    const handleCourseTitleInput = (e: React.FormEvent<HTMLHeadingElement>) => {
        // Just store the current text content, but don't update the state yet
        // This prevents React from re-rendering and resetting the cursor
        const newTitle = e.currentTarget.textContent || "";

        // We'll update the state when the user finishes editing
    };

    const saveCourseTitle = () => {
        if (titleRef.current) {
            const newTitle = titleRef.current.textContent || "";

            // Make a PUT request to update the course name
            fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${courseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newTitle
                })
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to update course: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Update the course title in the UI
                    setCourseTitle(newTitle);
                })
                .catch(err => {
                    console.error("Error updating course:", err);
                    // Revert to the original title in case of error
                    if (titleRef.current) {
                        titleRef.current.textContent = courseTitle;
                    }
                });

            setIsCourseTitleEditing(false);
        }
    };

    const cancelCourseTitleEditing = () => {
        if (titleRef.current) {
            titleRef.current.textContent = courseTitle;
        }
        setIsCourseTitleEditing(false);
    };

    // Helper function to set cursor at the end of a contentEditable element
    const setCursorToEnd = (element: HTMLElement) => {
        if (!element) return;

        const range = document.createRange();
        const selection = window.getSelection();

        // Clear any existing selection first
        selection?.removeAllRanges();

        // Set range to end of content
        range.selectNodeContents(element);
        range.collapse(false); // false means collapse to end

        // Apply the selection
        selection?.addRange(range);
        element.focus();
    };

    // For course title editing
    const enableCourseTitleEditing = () => {
        setIsCourseTitleEditing(true);

        // Need to use setTimeout to ensure the element is editable before focusing
        setTimeout(() => {
            if (titleRef.current) {
                setCursorToEnd(titleRef.current);
            }
        }, 0);
    };

    // For module title editing
    const enableModuleEditing = (moduleId: string) => {
        toggleModuleEditing(moduleId, true);

        // More reliable method to set cursor at end with a sufficient delay
        setTimeout(() => {
            const moduleElement = document.querySelector(`h2[contenteditable="true"]`) as HTMLElement;
            if (moduleElement && moduleElement.textContent) {
                // Create a text node at the end for more reliable cursor placement
                const textNode = moduleElement.firstChild;
                if (textNode) {
                    const selection = window.getSelection();
                    const range = document.createRange();

                    // Place cursor at the end of the text
                    range.setStart(textNode, textNode.textContent?.length || 0);
                    range.setEnd(textNode, textNode.textContent?.length || 0);

                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
                moduleElement.focus();
            }
        }, 100); // Increased delay for better reliability
    };

    // Modified function to enable edit mode
    const enableEditMode = () => {
        setIsEditMode(true);

        // Focus the title for editing is now handled in CourseModuleList
    };

    // Save the current item
    const saveItem = async () => {
        if (!activeItem || !activeModuleId) return;

        // Update the modules state to reflect any changes in the UI
        setModules(prevModules =>
            prevModules.map(module => {
                if (module.id === activeModuleId) {
                    return {
                        ...module,
                        items: module.items.map(item => {
                            if (item.id === activeItem.id) {
                                // Common properties to update for all item types
                                const commonUpdates = {
                                    title: activeItem.title,
                                    scheduled_publish_at: activeItem.scheduled_publish_at
                                };

                                // Create updated items based on type with proper type assertions
                                if (item.type === 'material' && activeItem.type === 'material') {
                                    return {
                                        ...item,
                                        ...commonUpdates,
                                        content: activeItem.content
                                    };
                                } else if (item.type === 'quiz' && activeItem.type === 'quiz') {
                                    return {
                                        ...item,
                                        ...commonUpdates,
                                        questions: activeItem.questions
                                    };
                                }

                                // Default case - update common properties
                                return {
                                    ...item,
                                    ...commonUpdates
                                };
                            }
                            return item;
                        })
                    };
                }
                return module;
            })
        );

        // Exit edit mode
        setIsEditMode(false);
    };

    const handleCohortSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setCohortSearchQuery(query);

        // Always filter the existing cohorts client-side
        if (cohorts.length > 0) {
            if (query.trim() === '') {
                // Show all available cohorts
                setFilteredCohorts(cohorts);
            } else {
                // Filter by search query
                const filtered = cohorts.filter(cohort =>
                    cohort.name.toLowerCase().includes(query.toLowerCase())
                );
                setFilteredCohorts(filtered);
            }
        }
    };

    // Update fetchCohorts to only be called once when dialog opens
    const fetchCohorts = async () => {
        try {
            setIsLoadingCohorts(true);
            setCohortError(null);

            // First, fetch cohorts that are already assigned to this course
            const courseCohortResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${courseId}/cohorts`);
            let assignedCohortIds: number[] = [];

            if (courseCohortResponse.ok) {
                const courseCohortData = await courseCohortResponse.json();
                assignedCohortIds = courseCohortData.map((cohort: { id: number }) => cohort.id);
                setCourseCohorts(courseCohortData);
            }

            // Then, fetch all cohorts for the organization
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/?org_id=${schoolId}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch cohorts: ${response.status}`);
            }

            const data = await response.json();

            // Store the total number of cohorts in the school
            setTotalSchoolCohorts(data.length);

            // Filter out cohorts that are already assigned to the course
            const availableCohorts = data.filter((cohort: { id: number }) =>
                !assignedCohortIds.includes(cohort.id)
            );

            setCohorts(availableCohorts);

            // Set all available cohorts as filtered cohorts initially
            setFilteredCohorts(availableCohorts);

            setIsLoadingCohorts(false);
        } catch (error) {
            console.error("Error fetching cohorts:", error);
            setCohortError("Failed to load cohorts. Please try again later.");
            setIsLoadingCohorts(false);
        }
    };

    // Function to select a cohort
    const selectCohort = (cohort: any) => {
        // Set the selected cohort (replacing any previous selection)
        setSelectedCohort(cohort);
    };

    // Update to publish to selected cohort
    const publishCourseToSelectedCohort = async () => {
        if (!selectedCohort) {
            setShowPublishDialog(false);
            return;
        }

        try {
            setCohortError(null);

            // Show loading state
            setIsLoadingCohorts(true);

            // Link the course to the selected cohort
            await linkCourseToCohort(selectedCohort.id, selectedCohort.name, dripConfig);
            setDripConfig(undefined);
        } catch (error) {
            console.error("Error publishing course:", error);
            setCohortError("Failed to publish course. Please try again later.");
        } finally {
            setIsLoadingCohorts(false);
        }
    };

    // Create a reusable function for linking a course to cohorts
    const linkCourseToCohort = async (
        cohortId: number,
        cohortName: string,
        dripConfig?: DripConfig
    ) => {
        // Make a single API call with all cohort IDs and drip config
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${courseId}/cohorts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cohort_ids: [cohortId],
                drip_config: dripConfig
            }),
        });

        // Check if the request failed
        if (!response.ok) {
            throw new Error(`Failed to link course to cohorts: ${response.status}`);
        }

        // Update cohort details for the celebration - use the first cohort for single cohort display
        setCelebrationDetails({
            cohortId: cohortId,
            cohortName: cohortName
        });

        if (showPublishDialog) {
            setShowPublishDialog(false);
        }

        // Show the celebratory banner
        setShowCelebratoryBanner(true);

        // Reset selection
        setSelectedCohort(null);

        // Refresh the displayed cohorts
        fetchCourseCohorts();
    };

    // Function to fetch cohorts assigned to this course
    const fetchCourseCohorts = async () => {
        try {
            setIsLoadingCourseCohorts(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${courseId}/cohorts`);

            if (!response.ok) {
                throw new Error(`Failed to fetch course cohorts: ${response.status}`);
            }

            const data = await response.json();
            setCourseCohorts(data);
        } catch (error) {
            console.error("Error fetching course cohorts:", error);
            // Silently fail - don't show an error message to the user
        } finally {
            setIsLoadingCourseCohorts(false);
        }
    };

    // Add a new function to initiate cohort removal with confirmation
    const initiateCohortRemoval = (cohortId: number, cohortName: string) => {
        setCohortToRemove({ id: cohortId, name: cohortName });
        setShowRemoveCohortConfirmation(true);
    };

    // Modify the existing removeCohortFromCourse function to handle the actual removal
    const removeCohortFromCourse = async (cohortId: number) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${courseId}/cohorts`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cohort_ids: [cohortId]
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to remove cohort from course: ${response.status}`);
            }

            // Show success toast
            setToast({
                show: true,
                title: 'Cohort unlinked',
                description: `This course has been removed from "${cohortToRemove?.name}"`,
                emoji: '🔓'
            });

            // Auto-hide toast after 5 seconds
            setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 5000);

            // Refresh the displayed cohorts
            fetchCourseCohorts();

            // Reset the confirmation state
            setShowRemoveCohortConfirmation(false);
            setCohortToRemove(null);
        } catch (error) {
            console.error("Error removing cohort from course:", error);

            // Show error toast
            setToast({
                show: true,
                title: 'Error',
                description: 'Failed to unlink cohort. Please try again.',
                emoji: '❌'
            });

            // Auto-hide toast after 5 seconds
            setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 5000);

            // Reset the confirmation state even on error
            setShowRemoveCohortConfirmation(false);
            setCohortToRemove(null);
        }
    };

    // Add toast close handler
    const handleCloseToast = () => {
        setToast(prev => ({ ...prev, show: false }));
    };

    // Add handler for closing the celebratory banner
    const closeCelebratoryBanner = () => {
        setShowCelebratoryBanner(false);
    };

    // Update to handle dialog opening from either button
    const openCohortSelectionDialog = async (origin: 'publish' | 'add') => {
        // For publish action, check if we need to auto-create a cohort
        if (origin === 'publish') {
            try {
                // First, fetch all cohorts for the organization to check if any exist
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/?org_id=${schoolId}`);

                if (response.ok) {
                    const allCohorts = await response.json();

                    // If no cohorts exist at all, auto-create one and publish
                    if (allCohorts.length === 0) {
                        openCreateCohortDialog();
                        return;
                    }

                    // Check cohorts already assigned to this course
                    const courseCohortResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${courseId}/cohorts`);
                    let assignedCohortIds: number[] = [];

                    if (courseCohortResponse.ok) {
                        const courseCohortData = await courseCohortResponse.json();
                        assignedCohortIds = courseCohortData.map((cohort: { id: number }) => cohort.id);
                    }

                    // Filter out cohorts that are already assigned to the course
                    const availableCohorts = allCohorts.filter((cohort: { id: number }) =>
                        !assignedCohortIds.includes(cohort.id)
                    );

                    // If all cohorts are already assigned, show the dialog (don't auto-create)
                    // The dialog will handle showing the appropriate message and create button
                }
            } catch (error) {
                console.error("Error checking cohorts:", error);
                // Fall back to showing the dialog if there's an error
            }
        }

        // Toggle dialog if clicking the same button that opened it
        if (showPublishDialog && dialogOrigin === origin) {
            // Close the dialog if it's already open with the same origin
            setShowPublishDialog(false);
            setDialogOrigin(null);
        } else {
            // Open the dialog with the new origin
            setDialogOrigin(origin);
            setShowPublishDialog(true);
            setSelectedCohort(null); // Reset selected cohort
            fetchCohorts();
        }
    };

    // Update to handle dialog closing
    const closeCohortDialog = () => {
        setShowPublishDialog(false);
        setDialogOrigin(null);
        setCohortSearchQuery('');
        setFilteredCohorts([]);
        setCohortError(null);
        setDripConfig(undefined);
    };

    // Add handler for opening the create cohort dialog directly
    const openCreateCohortDialog = () => {
        // Close the cohort selection dialog first
        setShowPublishDialog(false);

        // Then open the create cohort dialog
        setShowCreateCohortDialog(true);
    };

    // Add handler for closing the create cohort dialog
    const closeCreateCohortDialog = () => {
        setShowCreateCohortDialog(false);
    };

    // Add handler for cohort creation and linking
    const handleCohortCreated = async (cohort: any, dripConfig?: DripConfig) => {
        try {
            // Close the create cohort dialog first
            setShowCreateCohortDialog(false);

            // Link the course to the newly created cohort using the reusable function
            await linkCourseToCohort(cohort.id, cohort.name, dripConfig);


        } catch (error) {
            console.error("Error linking course to cohort:", error);
            // Show error toast
            setToast({
                show: true,
                title: 'Error',
                description: 'Failed to link course to cohort. Please try again.',
                emoji: '❌'
            });

            // Auto-hide toast after 5 seconds
            setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 5000);
        }
    };

    // Add useEffect for WebSocket cleanup
    useEffect(() => {
        // Cleanup function
        return () => {
            // Close WebSocket when component unmounts
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }

            // Clear heartbeat interval
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }
        };
    }, []);

    // Add a useEffect to watch for completion of task generation
    useEffect(() => {
        if (isGenerationComplete) {
            return;
        }

        // Check if all tasks have been generated
        if (totalTasksToGenerate > 0 && generatedTasksCount === totalTasksToGenerate) {
            // Add final completion message
            setGenerationProgress(["Course generation complete"]);

            // Set generation as complete
            setIsGenerationComplete(true);

            // Close WebSocket connection when all tasks are completed
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
                wsRef.current = null;
            }
        }
    }, [generatedTasksCount, totalTasksToGenerate]);

    // Update the handleGenerationDone function to reset the isGenerationComplete state
    const handleGenerationDone = () => {
        setIsGeneratingCourse(false);
        setIsCourseStructureGenerated(false);
        setGenerationProgress([]);
        setGeneratedTasksCount(0);
        setTotalTasksToGenerate(0);
        setIsGenerationComplete(false);
    };

    const setupGenerationWebSocket = () => {
        // Set up WebSocket connection for real-time updates
        try {
            const websocketUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/^http/, 'ws')}/ws/course/${courseId}/generation`;

            // Create new WebSocket and store in ref
            wsRef.current = new WebSocket(websocketUrl);

            wsRef.current.onopen = () => {
                console.log('WebSocket connection established for course generation');

                // Set up heartbeat to keep connection alive
                // Typically sending a ping every 30 seconds prevents timeout
                heartbeatIntervalRef.current = setInterval(() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        // Send a simple ping message to keep the connection alive
                        wsRef.current.send(JSON.stringify({ type: 'ping' }));
                        console.log('Sent WebSocket heartbeat ping');
                    } else {
                        // Clear the interval if the WebSocket is closed
                        if (heartbeatIntervalRef.current) {
                            clearInterval(heartbeatIntervalRef.current);
                            heartbeatIntervalRef.current = null;
                        }
                    }
                }, 30000); // 30 seconds interval
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.event === 'module_created') {
                        // Add the new module to the list of modules
                        const newModule: Module = {
                            id: data.module.id.toString(),
                            title: data.module.name,
                            position: data.module.ordering,
                            backgroundColor: data.module.color,
                            isExpanded: true,
                            isEditing: false,
                            items: []
                        };

                        setModules(prevModules => [...prevModules, newModule]);
                    } else if (data.event === 'course_structure_completed') {
                        // Course structure generation is complete
                        const jobId = data.job_id;

                        setGenerationProgress(prev => [...prev, "Course plan complete", "Generating learning materials and quizzes"]);
                        setIsCourseStructureGenerated(true);
                        setGeneratedTasksCount(0); // Reset counter when starting task generation

                        // Now we can start the task generation
                        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ai/generate/course/${courseId}/tasks`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                job_uuid: jobId
                            }),
                        }).then(response => {
                            if (!response.ok) {
                                throw new Error(`Failed to generate tasks: ${response.status}`);
                            }
                            return response.json();
                        }).catch(error => {
                            console.error('Error generating tasks:', error);
                            // Handle error appropriately
                            if (wsRef.current) {
                                wsRef.current.close();
                                wsRef.current = null;
                            }
                            setGenerationProgress(prev => [...prev, "Error generating tasks. Please try again."]);
                        });
                    } else if (data.event === 'task_created') {
                        // Increment the generated tasks counter
                        setTotalTasksToGenerate(prev => prev + 1);

                        // Add the new task to the appropriate module
                        setModules(prevModules => {
                            return prevModules.map(module => {
                                if (module.id === data.task.module_id.toString()) {
                                    // Create appropriate item based on type
                                    let newItem: ModuleItem;

                                    if (data.task.type === 'learning_material') {
                                        newItem = {
                                            id: data.task.id.toString(),
                                            title: data.task.name,
                                            position: data.task.ordering,
                                            type: 'material',
                                            content: [],
                                            status: 'draft',
                                            scheduled_publish_at: null,
                                            isGenerating: true
                                        } as LearningMaterial;
                                    } else {
                                        newItem = {
                                            id: data.task.id.toString(),
                                            title: data.task.name,
                                            position: data.task.ordering,
                                            type: 'quiz',
                                            questions: [],
                                            status: 'draft',
                                            scheduled_publish_at: null,
                                            isGenerating: true
                                        } as Quiz;
                                    }

                                    return {
                                        ...module,
                                        items: [...module.items, newItem]
                                    };
                                }
                                return module;
                            });
                        });
                    } else if (data.event === 'task_completed') {
                        setGeneratedTasksCount(data.total_completed);

                        // Mark this specific task as no longer generating
                        const taskId = data.task.id.toString();

                        // Update the module item to remove the isGenerating flag
                        setModules(prevModules => {
                            return prevModules.map(module => {
                                // Update items in this module
                                const updatedItems = module.items.map(item => {
                                    if (item.id === taskId) {
                                        return {
                                            ...item,
                                            isGenerating: false
                                        };
                                    }
                                    return item;
                                });

                                return {
                                    ...module,
                                    items: updatedItems
                                };
                            });
                        });
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setGenerationProgress(prev => [...prev, "There was an error generating your course. Please try again."]);
            };

            wsRef.current.onclose = () => {
                console.log('WebSocket connection closed');

                // Clear heartbeat interval
                if (heartbeatIntervalRef.current) {
                    clearInterval(heartbeatIntervalRef.current);
                    heartbeatIntervalRef.current = null;
                }

                // Attempt to reconnect if generation is still in progress
                if (isGeneratingCourseRef.current &&
                    totalTasksToGenerateRef.current > 0 &&
                    generatedTasksCountRef.current < totalTasksToGenerateRef.current) {

                    console.log('Generation still in progress. Attempting to reconnect...');
                    // Add a small delay before attempting to reconnect
                    setTimeout(() => {
                        // Try to setup a new WebSocket connection
                        const ws = setupGenerationWebSocket();
                        if (ws) {
                            wsRef.current = ws;
                            console.log('WebSocket reconnection successful');
                        } else {
                            console.error('WebSocket reconnection failed');
                        }
                    }, 500); // small delay before reconnection attempt
                }
            };

            return wsRef.current;
        } catch (wsError) {
            console.error('Error setting up WebSocket:', wsError);
        }
    }

    // Add handler for AI course generation
    const handleGenerateCourse = async (data: GenerateWithAIFormData) => {
        if (!data.referencePdf) {
            throw new Error('Reference material is required');
        }

        try {
            // Close the dialog first
            setShowGenerateDialog(false);

            // Set generating state and initialize with first progress message
            setIsGeneratingCourse(true);
            setIsCourseStructureGenerated(false);
            setIsGenerationComplete(false); // Reset completion state

            // Clear any existing WebSocket connection
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            // Clear any existing heartbeat interval
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }

            // For now, we'll just log the data
            // In a real implementation, this would be an API call to start the generation process
            let presigned_url = '';
            let file_key = '';

            setGenerationProgress(["Uploading reference material"]);

            try {
                // First, get a presigned URL for the file
                const presignedUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/create`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        content_type: 'application/pdf'
                    })
                });

                if (!presignedUrlResponse.ok) {
                    throw new Error('Failed to get presigned URL');
                }

                const presignedData = await presignedUrlResponse.json();

                console.log('Presigned url generated');
                presigned_url = presignedData.presigned_url;
                file_key = presignedData.file_key;

            } catch (error) {
                console.error("Error getting presigned URL for file:", error);
            }

            if (!presigned_url) {
                // If we couldn't get a presigned URL, try direct upload to the backend
                try {
                    console.log("Attempting direct upload to backend");

                    // Create FormData for the file upload
                    const formData = new FormData();
                    formData.append('file', data.referencePdf, 'reference_material.pdf');
                    formData.append('content_type', 'application/pdf');

                    // Upload directly to the backend
                    const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/upload-local`, {
                        method: 'POST',
                        body: formData
                    });

                    if (!uploadResponse.ok) {
                        throw new Error(`Failed to upload audio to backend: ${uploadResponse.status}`);
                    }

                    const uploadData = await uploadResponse.json();
                    file_key = uploadData.file_key;

                    console.log('Reference material uploaded successfully to backend');
                } catch (error) {
                    console.error('Error with direct upload to backend:', error);
                    throw error;
                }
            } else {

                // Upload the file to S3 using the presigned URL
                try {
                    // Use data.referencePdf instead of undefined 'file' variable
                    const pdfFile = data.referencePdf;

                    // Upload to S3 using the presigned URL
                    const uploadResponse = await fetch(presigned_url, {
                        method: 'PUT',
                        body: pdfFile, // Use the file directly, no need to create a Blob
                        headers: {
                            'Content-Type': 'application/pdf'
                        }
                    });

                    if (!uploadResponse.ok) {
                        throw new Error(`Failed to upload file to S3: ${uploadResponse.status}`);
                    }

                    console.log('File uploaded successfully to S3');
                } catch (error) {
                    console.error('Error uploading file to S3:', error);
                    throw error;
                }
            }

            setGenerationProgress(["Uploaded reference material", 'Generating course plan']);

            // Set up WebSocket connection for real-time updates
            const ws = setupGenerationWebSocket()

            if (!ws) {
                throw new Error('Failed to setup WebSocket connection');
            }

            wsRef.current = ws;

            let jobId = '';

            // Make API request to generate course structure
            try {
                let response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ai/generate/course/${courseId}/structure`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        course_description: data.courseDescription,
                        intended_audience: data.intendedAudience,
                        instructions: data.instructionsForAI || undefined,
                        reference_material_s3_key: file_key
                    }),
                });

                if (!response.ok) {
                    // Close WebSocket on API error
                    if (wsRef.current) {
                        wsRef.current.close();
                        wsRef.current = null;
                    }
                    throw new Error(`Failed to generate course: ${response.status}`);
                }

                const result = await response.json();

                // We'll set a listener for the course structure completion
                // instead of immediately setting it as complete

                // Wait for the WebSocket to notify that the course structure is complete
                // Instead of immediately calling the tasks endpoint
            } catch (error) {
                console.error('Error making course generation API request:', error);
                // Close WebSocket on API error
                if (wsRef.current) {
                    wsRef.current.close();
                    wsRef.current = null;
                }
                throw error;
            }
        } catch (error) {
            console.error('Error generating course:', error);

            // Clean up WebSocket
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            // Clear heartbeat interval
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }

            // Add error message to progress
            setGenerationProgress(prev => [...prev, "There was an error generating your course. Please try again."]);

            // Reset generating state after delay
            setTimeout(() => {
                setIsGeneratingCourse(false);
                setIsCourseStructureGenerated(false);
                setGenerationProgress([]);
            }, 3000);

            return Promise.reject(error);
        }
    };

    // Add handler for copying cohort invite link
    const handleCopyCohortInviteLink = async (cohortId: number, cohortName: string) => {
        try {
            const inviteLink = `${window.location.origin}/school/${schoolSlug}/join?cohortId=${cohortId}`;
            await navigator.clipboard.writeText(inviteLink);

            // Show success toast
            setToast({
                show: true,
                title: 'Link copied',
                description: `Share this link with your learners to let them join this cohort`,
                emoji: '📋'
            });

            // Auto-hide toast after 3 seconds
            setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 3000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);

            // Show error toast
            setToast({
                show: true,
                title: 'Copy failed',
                description: 'Unable to copy invite link to clipboard',
                emoji: '❌'
            });

            // Auto-hide toast after 3 seconds
            setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 3000);
        }
    };

    // Function to handle opening settings dialog
    const handleOpenSettingsDialog = (cohort: any) => {
        setSelectedCohortForSettings(cohort);
    };

    // Function to close settings dialog
    const handleCloseSettingsDialog = () => {
        setSelectedCohortForSettings(null);
    };

    return (
        <div className="min-h-screen bg-black">
            {/* Use the reusable Header component with showCreateCourseButton set to false */}
            <Header
                showCreateCourseButton={false}
                isDarkMode={isDarkMode}
                themePreference={themePreference}
                onThemePreferenceChange={setThemePreference}
            />

            {/* Add overlay when course is being generated */}
            {isGeneratingCourse && !isCourseStructureGenerated && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-[1px] z-40 flex items-center justify-center pointer-events-auto">

                </div>
            )}

            {/* Show spinner when loading, or when taskId is present and dialog is not open */}
            {(isLoading || (taskId && !isDialogOpen)) ? (
                <div className="flex justify-center items-center h-[calc(100vh-80px)]">
                    <div className="w-16 h-16 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                </div>
            ) : (
                /* Main content area - only shown after loading */
                <div className="py-12 grid grid-cols-5 gap-6">
                    <div className="max-w-5xl ml-24 col-span-4 relative">
                        {/* Back to Courses button */}
                        <Link
                            href={`/school/admin/${schoolId}#courses`}
                            className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-4"
                        >
                            <ArrowLeft size={16} className="mr-2 text-sm" />
                            Back to courses
                        </Link>

                        <div className="flex items-center justify-between mb-8">
                            {error ? (
                                <h1 className="text-4xl font-light text-red-400 w-3/4 mr-8">
                                    {error}
                                </h1>
                            ) : (
                                <div className="flex items-center w-3/4 mr-8">
                                    <h1
                                        ref={titleRef}
                                        contentEditable={isCourseTitleEditing}
                                        suppressContentEditableWarning
                                        onInput={handleCourseTitleInput}
                                        onKeyDown={handleKeyDown}
                                        className={`text-4xl font-light text-white outline-none ${isCourseTitleEditing ? 'border-b border-gray-700 pb-1' : ''}`}
                                        autoFocus={isCourseTitleEditing}
                                    >
                                        {courseTitle}
                                    </h1>

                                    {/* Add published pill when course is in at least one cohort */}
                                    {!isCourseTitleEditing && courseCohorts.length > 0 && (
                                        <div className="ml-4 px-3 py-1 bg-green-800/70 text-white text-xs rounded-full">
                                            Published
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center space-x-3 ml-auto">
                                {isCourseTitleEditing ? (
                                    <>
                                        <button
                                            className="flex items-center px-6 py-2 text-sm font-medium text-white bg-transparent border-2 !border-[#4F46E5] hover:bg-[#222222] outline-none rounded-full transition-all cursor-pointer shadow-md"
                                            onClick={saveCourseTitle}
                                        >
                                            <span className="mr-2 text-base">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                                    <polyline points="7 3 7 8 15 8"></polyline>
                                                </svg>
                                            </span>
                                            <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">Save</span>
                                        </button>
                                        <button
                                            className="flex items-center px-6 py-2 text-sm font-medium text-white bg-transparent border-2 !border-[#6B7280] hover:bg-[#222222] outline-none rounded-full transition-all cursor-pointer shadow-md"
                                            onClick={cancelCourseTitleEditing}
                                        >
                                            <span className="mr-2 text-base">
                                                <X size={16} />
                                            </span>
                                            <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">Cancel</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className="flex items-center px-6 py-2 text-sm font-medium text-white bg-transparent border-2 !border-[#4F46E5] hover:bg-[#222222] outline-none rounded-full transition-all cursor-pointer shadow-md"
                                            onClick={enableCourseTitleEditing}
                                        >
                                            <span className="mr-2 text-base">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                            </span>
                                            <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">Edit</span>
                                        </button>
                                        <button
                                            className="flex items-center px-6 py-2 text-sm font-medium text-white bg-transparent border-2 !border-[#EF4444] hover:bg-[#222222] outline-none rounded-full transition-all cursor-pointer shadow-md"
                                            onClick={() => {
                                                // Open preview in a new tab
                                                window.open(`/school/admin/${schoolId}/courses/${courseId}/preview`, '_blank');
                                            }}
                                        >
                                            <span className="mr-2 text-base">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                    <circle cx="12" cy="12" r="3"></circle>
                                                </svg>
                                            </span>
                                            <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">Preview</span>
                                        </button>

                                    </>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => addModule(courseId, schoolId, modules, setModules, setActiveModuleId, lastUsedColorIndex, setLastUsedColorIndex)}
                            className="mb-6 px-6 py-2 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-100 cursor-pointer"
                        >
                            Add module
                        </button>

                        <CourseModuleList
                            data-testid="course-module-list"
                            modules={modules}
                            mode="edit"
                            onToggleModule={toggleModule}
                            onOpenItem={openItemDialog}
                            onMoveItemUp={moveItemUp}
                            onMoveItemDown={moveItemDown}
                            onDeleteItem={deleteItem}
                            onAddLearningMaterial={addLearningMaterial}
                            onAddQuiz={addQuiz}
                            onAddAssignment={addAssignment}
                            onMoveModuleUp={moveModuleUp}
                            onMoveModuleDown={moveModuleDown}
                            onDeleteModule={deleteModule}
                            onEditModuleTitle={enableModuleEditing}
                            saveModuleTitle={saveModuleTitle}
                            cancelModuleEditing={cancelModuleEditing}
                            isDialogOpen={isDialogOpen}
                            activeItem={activeItem}
                            activeModuleId={activeModuleId}
                            activeQuestionId={activeQuestionId}
                            isEditMode={isEditMode}
                            isPreviewMode={isPreviewMode}
                            showPublishConfirmation={showPublishConfirmation}
                            handleConfirmPublish={handleConfirmPublish}
                            handleCancelPublish={handleCancelPublish}
                            closeDialog={closeDialog}
                            saveItem={saveItem}
                            cancelEditMode={cancelEditMode}
                            enableEditMode={enableEditMode}
                            handleQuizContentChange={handleQuizContentChange}
                            setShowPublishConfirmation={setShowPublishConfirmation}
                            onQuestionChange={handleQuestionChange}
                            schoolId={schoolId}
                            courseId={courseId}
                            onDuplicateItem={handleDuplicateItem}
                        />
                    </div>

                    {/* Display cohorts assigned to this course */}
                    {hasAnyItems() && (
                        <div className="mt-10">
                            <div className="relative">
                                <button
                                    ref={publishButtonRef}
                                    data-dropdown-toggle="true"
                                    className="flex items-center px-6 py-2 text-sm font-medium text-white bg-[#016037] border-0 hover:bg-[#017045] outline-none rounded-full transition-all cursor-pointer shadow-md"
                                    onClick={() => openCohortSelectionDialog('publish')}
                                >
                                    <span className="mr-2 text-base">🚀</span>
                                    <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">Share with learners</span>
                                </button>
                            </div>

                            {!isLoadingCourseCohorts && courseCohorts.length > 0 && (
                                <div className="mt-10">
                                    <h2 className="text-sm font-light text-gray-400 mb-1">Cohorts</h2>
                                    <p className="text-xs text-gray-500 mb-3 mr-4">
                                        View the course settings for each cohort and add learners to it using an invite link from the settings
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        {courseCohorts.map((cohort: { id: number; name: string }) => (
                                            <div
                                                key={cohort.id}
                                                className="flex items-center bg-[#222] px-4 py-2 rounded-full group hover:bg-[#333] transition-colors"
                                            >
                                                <Tooltip content="Settings" position="top">
                                                    <button
                                                        onClick={() => handleOpenSettingsDialog(cohort)}
                                                        className="text-gray-400 hover:text-white cursor-pointer flex items-center mr-2"
                                                        aria-label="View settings"
                                                    >
                                                        <Settings size={16} />
                                                    </button>
                                                </Tooltip>
                                                <span className="text-white text-sm font-light">{cohort.name}</span>
                                                <Tooltip content="Remove" position="top">
                                                    <button
                                                        onClick={() => initiateCohortRemoval(cohort.id, cohort.name)}
                                                        className="text-gray-400 hover:text-white cursor-pointer flex items-center ml-2"
                                                        aria-label="Remove cohort from course"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Generation Progress Window */}
            {isGeneratingCourse && (
                <div className="fixed bottom-4 right-4 z-50 w-72 bg-black border border-gray-800 rounded-xl shadow-lg overflow-hidden">
                    <div className="px-5 py-3 bg-[#111111] border-b border-gray-800 flex justify-between items-center">
                        <div className="flex items-center">
                            <Sparkles size={16} className="text-white mr-2" />
                            <h3 className="text-white text-sm font-light">AI Course Generation</h3>
                        </div>
                    </div>
                    <div className="p-5 max-h-60 overflow-y-auto space-y-4">
                        {generationProgress.map((message, index) => {
                            const isLatest = index === generationProgress.length - 1;

                            // Show spinner only for latest message when generation is not complete
                            const showSpinner = isLatest && !isGenerationComplete;

                            return (
                                <div key={index} className="flex items-center text-sm">
                                    <div className="flex-shrink-0 mr-3">
                                        {showSpinner ? (
                                            <div className="h-5 w-5 flex items-center justify-center">
                                                <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            </div>
                                        ) : (
                                            <div className="h-5 w-5 flex items-center justify-center">
                                                <Check className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className={`text-${isLatest ? 'white' : 'gray-400'} font-light`}>
                                        {message}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Task generation progress bar - only shown after course structure is generated */}
                        {isCourseStructureGenerated && totalTasksToGenerate > 0 && !isGenerationComplete && (
                            <div className="mt-2">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>{generatedTasksCount} / {totalTasksToGenerate}</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2.5">
                                    <div
                                        className="bg-green-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                                        style={{ width: `${Math.min(100, (generatedTasksCount / totalTasksToGenerate) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}


                    </div>
                    {/* Done button - only shown when generation is complete */}
                    {isGenerationComplete && (
                        <div className="mb-4 flex justify-center">
                            <button
                                onClick={handleGenerationDone}
                                className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Floating Action Button - Generate with AI - only shown when not generating */}
            {/* <div className="fixed bottom-10 right-10 z-50">
                {!isGeneratingCourse && !toast.show && !isDialogOpen && (
                    <button
                        className="flex items-center px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
                        onClick={() => setShowGenerateDialog(true)}
                        disabled={isGeneratingCourse}
                    >
                        <span className="mr-2">
                            <Sparkles size={18} />
                        </span>
                        <span>Generate with AI</span>
                    </button>
                )}
            </div> */}

            {/* Render the CourseCohortSelectionDialog */}
            <CourseCohortSelectionDialog
                data-testid="cohort-selection-dialog"
                isOpen={showPublishDialog}
                onClose={closeCohortDialog}
                originButtonRef={dialogOrigin === 'publish' ? publishButtonRef : addCohortButtonRef}
                isPublishing={dialogOrigin === 'publish'}
                onConfirm={publishCourseToSelectedCohort}
                showLoading={isLoadingCohorts}
                hasError={!!cohortError}
                errorMessage={cohortError || ''}
                onRetry={fetchCohorts}
                cohorts={cohorts}
                selectedCohort={selectedCohort}
                onSelectCohort={selectCohort}
                onSearchChange={handleCohortSearch}
                searchQuery={cohortSearchQuery}
                filteredCohorts={filteredCohorts}
                totalSchoolCohorts={totalSchoolCohorts}
                schoolId={schoolId}
                courseId={courseId}
                onCohortCreated={handleCohortCreated}
                onOpenCreateCohortDialog={openCreateCohortDialog}
                onAutoCreateAndPublish={openCreateCohortDialog}
                onDripConfigChange={setDripConfig}
            />

            {/* Confirmation Dialog for Cohort Removal */}
            <ConfirmationDialog
                data-testid="confirmation-dialog"
                open={showRemoveCohortConfirmation}
                title="Remove course from cohort"
                message={`Are you sure you want to remove this course from "${cohortToRemove?.name}"? Learners in that cohort will no longer have access to this course`}
                onConfirm={() => cohortToRemove && removeCohortFromCourse(cohortToRemove.id)}
                onCancel={() => {
                    setShowRemoveCohortConfirmation(false);
                    setCohortToRemove(null);
                }}
                confirmButtonText="Remove"
                type="delete"
                isDarkMode={isDarkMode}
            />

            {/* Toast notification */}
            <Toast
                data-testid="toast"
                show={toast.show}
                title={toast.title}
                description={toast.description}
                emoji={toast.emoji}
                onClose={handleCloseToast}
            />

            {/* Celebratory Banner for course publication */}
            <CoursePublishSuccessBanner
                data-testid="success-banner"
                isOpen={showCelebratoryBanner}
                onClose={closeCelebratoryBanner}
                cohortId={celebrationDetails.cohortId}
                cohortName={celebrationDetails.cohortName}
                schoolSlug={schoolSlug}
                schoolId={params.id as string}
            />

            {/* Add the standalone CreateCohortDialog */}
            <CreateCohortDialog
                data-testid="create-cohort-dialog"
                open={showCreateCohortDialog}
                onClose={closeCreateCohortDialog}
                onCreateCohort={handleCohortCreated}
                schoolId={schoolId}
                showDripPublishSettings={true}
            />

            {/* Generate with AI Dialog */}
            <GenerateWithAIDialog
                data-testid="generate-ai-dialog"
                open={showGenerateDialog}
                onClose={() => setShowGenerateDialog(false)}
                onSubmit={handleGenerateCourse}
            />

            {/* Add SettingsDialog component */}
            <SettingsDialog
                data-testid="settings-dialog"
                isOpen={!!selectedCohortForSettings}
                onClose={handleCloseSettingsDialog}
                courseName={selectedCohortForSettings?.name}
                dripConfig={{
                    is_drip_enabled: selectedCohortForSettings?.drip_config?.is_drip_enabled,
                    frequency_value: selectedCohortForSettings?.drip_config?.frequency_value,
                    frequency_unit: selectedCohortForSettings?.drip_config?.frequency_unit,
                    publish_at: selectedCohortForSettings?.drip_config?.publish_at
                }}
                schoolId={schoolId}
                courseId={undefined}
                cohortId={selectedCohortForSettings?.id}
                onCopyCohortInviteLink={handleCopyCohortInviteLink}
            />
        </div>
    );
}