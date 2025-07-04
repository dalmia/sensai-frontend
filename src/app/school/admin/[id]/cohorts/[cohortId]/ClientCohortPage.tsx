"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Users, BookOpen, Layers, ArrowLeft, UsersRound, X, Plus, Trash2, Upload, Mail, ChevronDown, Check, FileText, ChevronRight, GraduationCap, School, HelpCircle, Pencil, ExternalLink, Settings, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import Toast from "@/components/Toast";
import CoursePublishSuccessBanner from "@/components/CoursePublishSuccessBanner";
import ClientLeaderboardView from "@/app/school/[id]/cohort/[cohortId]/leaderboard/ClientLeaderboardView";
import Tooltip from "@/components/Tooltip";
import CohortMemberManagement from "@/components/CohortMemberManagement";
import CohortDashboard from "@/components/CohortDashboard";
import CohortCoursesLinkerDropdown from "@/components/CohortCoursesLinkerDropdown";
import SettingsDialog from "@/components/SettingsDialog";
import CreateBatchDialog from "@/components/CreateBatchDialog";
import { CohortWithDetails as Cohort } from "@/types";
import { DripConfig } from "@/types/course";

interface Course {
    id: number;
    name: string;
    description?: string;
    moduleCount?: number;
    drip_config?: DripConfig;
}

type TabType = 'dashboard' | 'learners' | 'mentors' | 'batches';

interface ClientCohortPageProps {
    schoolId: string;
    cohortId: string;
}

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (emails: string[]) => Promise<void>;
    submitButtonText: string;
    isSubmitting: boolean;
    role: 'learner' | 'mentor';
}

// Add new interface for course metrics
interface CourseMetrics {
    average_completion: number;
    num_tasks: number;
    num_active_learners: number;
    task_type_metrics: {
        quiz?: {
            completion_rate: number;
            count: number;
        };
        learning_material?: {
            completion_rate: number;
            count: number;
        };
        exam?: {
            completion_rate: number;
            count: number;
        };
    };
}

interface Batch {
    id: number;
    name: string;
    cohort_id: number;
    members: {
        id: number;
        email: string;
        role: string;
    }[];
}

export default function ClientCohortPage({ schoolId, cohortId }: ClientCohortPageProps) {
    const [tab, setTab] = useState<TabType>('dashboard');
    const [cohort, setCohort] = useState<Cohort | null>(null);
    const [loading, setLoading] = useState(true);

    const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLoadingCourses, setIsLoadingCourses] = useState(true);
    const [courseError, setCourseError] = useState<string | null>(null);
    const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);

    // Add state to track total courses in the school
    const [totalSchoolCourses, setTotalSchoolCourses] = useState<number>(0);

    // Toast state
    const [showToast, setShowToast] = useState(false);
    const [toastTitle, setToastTitle] = useState('');
    const [toastDescription, setToastDescription] = useState('');
    const [toastEmoji, setToastEmoji] = useState('');

    // Add state for controlling the invite dialog
    const [openLearnerInviteDialog, setOpenLearnerInviteDialog] = useState(false);

    // Add two new state variables, below existing state variables like isDeleteConfirmOpen
    const [isCourseUnlinkConfirmOpen, setIsCourseUnlinkConfirmOpen] = useState(false);
    const [courseToUnlink, setCourseToUnlink] = useState<Course | null>(null);

    // Add state for course publish success banner
    const [showCoursePublishBanner, setShowCoursePublishBanner] = useState(false);
    const [courseLinkDetails, setCourseLinkDetails] = useState({
        courseCount: 0,
        courseNames: [] as string[]
    });

    // Add state for cohort name editing
    const [isEditingCohortName, setIsEditingCohortName] = useState(false);
    const [editedCohortName, setEditedCohortName] = useState('');
    const cohortNameRef = useRef<HTMLHeadingElement>(null);

    // Add state for school slug
    const [schoolSlug, setSchoolSlug] = useState<string>('');

    const [selectedCourseForSettings, setSelectedCourseForSettings] = useState<any | null>(null);

    // Add state for batch creation dialog
    const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);

    // Add state for batches
    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [isLoadingBatches, setIsLoadingBatches] = useState(false);

    // Add state for batch search
    const [batchSearchQuery, setBatchSearchQuery] = useState("");

    // Add state for delete dialog
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Function to switch to learners tab and open invite dialog
    const handleOpenLearnerInviteDialog = () => {
        setTab('learners');
        setOpenLearnerInviteDialog(true);
    };

    // Function to close the learner invite dialog
    const handleCloseLearnerInviteDialog = () => {
        setOpenLearnerInviteDialog(false);
    };

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

    const fetchAvailableCourses = async () => {
        setIsLoadingCourses(true);
        setCourseError(null);
        try {
            const coursesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/?org_id=${schoolId}`);
            if (!coursesResponse.ok) {
                throw new Error(`Failed to fetch courses: ${coursesResponse.status}`);
            }
            const coursesData: Course[] = await coursesResponse.json();

            // Store the total number of courses in the school
            setTotalSchoolCourses(coursesData.length);

            const cohortCoursesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/courses`);
            if (!cohortCoursesResponse.ok) {
                setAvailableCourses(coursesData);
                setIsLoadingCourses(false);
                return;
            }

            const cohortCoursesData: Course[] = await cohortCoursesResponse.json();
            const cohortCourseIds = cohortCoursesData.map(course => course.id);

            const availableCoursesData = coursesData.filter(course => !cohortCourseIds.includes(course.id));

            setAvailableCourses(availableCoursesData);

            if (cohort) {
                setCohort(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        courses: cohortCoursesData || []
                    };
                });
                setSelectedCourseIds(cohortCoursesData.map(course => course.id));
            }
        } catch (error) {
            console.error("Error fetching courses:", error);
            setCourseError("Failed to load courses. Please try again.");
        } finally {
            setIsLoadingCourses(false);
        }
    };

    // Function to handle removing a course from the cohort
    const removeCourseFromCohort = async (courseId: number) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/courses`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    course_ids: [courseId]
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to remove course from cohort: ${response.status}`);
            }

            setSelectedCourseIds(prev => prev.filter(id => id !== courseId));

            const currentCourses = Array.isArray(cohort?.courses) ? cohort.courses : [];
            if (currentCourses.length > 0) {
                const removedCourse = currentCourses.find(course => course.id === courseId);
                const updatedCourses = currentCourses.filter(course => course.id !== courseId);

                if (!removedCourse) {
                    return;
                }

                // Check if this was the last course and set tab to 'learners' if so
                if (updatedCourses.length === 0) {
                    setTab('learners');
                }

                setCohort(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        courses: updatedCourses
                    };
                });

                if (removedCourse) {
                    setAvailableCourses(prev => [...prev, removedCourse]);
                }

                // Show success toast
                setToastTitle('Course unlinked');
                setToastDescription(`${removedCourse?.name} has been removed from this cohort`);
                setToastEmoji('⛓️‍💥');
                setShowToast(true);
            }
        } catch (error) {
            console.error("Error removing course from cohort:", error);

            // Show error toast
            setToastTitle('Error');
            let errorMessage = 'Failed to unlink course. Please try again.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            setToastDescription(errorMessage);
            setToastEmoji('❌');
            setShowToast(true);
        } finally {
            // Reset state
            setCourseToUnlink(null);
            setIsCourseUnlinkConfirmOpen(false);
        }
    };

    // New function to initiate the course unlinking process with confirmation
    const initiateCourseUnlink = (course: Course) => {
        setCourseToUnlink(course);
        setIsCourseUnlinkConfirmOpen(true);
    };

    // Add a function to handle the course linking from the dropdown component
    const handleCoursesLinked = async (selectedCourses: Course[], dripConfig?: DripConfig) => {
        setIsDropdownOpen(false);
        setIsLoadingCourses(true);

        try {
            const courseIds = selectedCourses.map(course => course.id);

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/courses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    course_ids: courseIds,
                    drip_config: dripConfig
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to link courses to cohort: ${response.status}`);
            }

            // Update the cohort with added courses
            setCohort(prev => {
                if (!prev) return prev;

                // Get existing course IDs to avoid duplicates - ensure courses is always an array
                const existingCourses = Array.isArray(prev.courses) ? prev.courses : [];
                const existingCourseIds = existingCourses.map(c => c.id);

                // Filter out any courses that are already in the cohort
                const newCourses = selectedCourses.filter(c => !existingCourseIds.includes(c.id));

                // Add course settings to the new courses if provided
                const updatedCourses = newCourses.map(course => ({
                    ...course,
                    drip_config: dripConfig
                }));

                return {
                    ...prev,
                    courses: [...existingCourses, ...updatedCourses]
                };
            });

            // Update selected course IDs
            setSelectedCourseIds(prev => {
                return [...prev, ...courseIds];
            });

            // Remove added courses from available courses
            setAvailableCourses(prev =>
                prev.filter(c => !selectedCourses.some(tc => tc.id === c.id))
            );

            // Set course link details for success banner
            setCourseLinkDetails({
                courseCount: selectedCourses.length,
                courseNames: selectedCourses.map(course => course.name)
            });

            // Show success banner
            setShowCoursePublishBanner(true);

            // Set tab to dashboard after successfully linking courses
            setTab('dashboard');

        } catch (error) {
            console.error("Error linking courses to cohort:", error);
            setCourseError("Failed to link courses. Please try again.");
        } finally {
            setIsLoadingCourses(false);
        }
    };

    // Add a function to close the course publish banner
    const closeCoursePublishBanner = () => {
        setShowCoursePublishBanner(false);
    };

    // Function to enable cohort name editing
    const enableCohortNameEditing = () => {
        if (cohort && cohort.name) {
            setEditedCohortName(cohort.name);
            setIsEditingCohortName(true);
            setTimeout(() => {
                if (cohortNameRef.current) {
                    cohortNameRef.current.focus();
                    // Place cursor at the end of the text
                    const range = document.createRange();
                    const selection = window.getSelection();
                    range.selectNodeContents(cohortNameRef.current);
                    range.collapse(false);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
            }, 0);
        }
    };

    // Function to save edited cohort name
    const saveCohortName = async () => {
        const trimmedName = (editedCohortName || '').trim();

        // Check if name is empty and show toast
        if (!trimmedName) {
            setToastTitle('Invalid name');
            setToastDescription('Cohort name cannot be empty');
            setToastEmoji('❌');
            setShowToast(true);
            return;
        }

        if (!cohort) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: trimmedName
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to update cohort name: ${response.status}`);
            }

            // Update local state with new name
            setCohort(prev => prev ? {
                ...prev,
                name: trimmedName
            } : null);

            // Show success toast
            setToastTitle('Success');
            setToastDescription(`Cohort name has been updated`);
            setToastEmoji('✅');
            setShowToast(true);
        } catch (error) {
            console.error("Error updating cohort name:", error);

            // Show error toast
            setToastTitle('Error');
            setToastDescription('Failed to update cohort name. Please try again.');
            setToastEmoji('❌');
            setShowToast(true);
        } finally {
            setIsEditingCohortName(false);
        }
    };

    // Function to cancel cohort name editing
    const cancelCohortNameEditing = () => {
        setIsEditingCohortName(false);
        setEditedCohortName('');

        // Restore the original cohort name in the contentEditable element
        if (cohortNameRef.current && cohort?.name) {
            cohortNameRef.current.textContent = cohort.name;
        }
    };

    // Function to handle cohort name input
    const handleCohortNameInput = (e: React.FormEvent<HTMLHeadingElement>) => {
        setEditedCohortName(e.currentTarget.textContent || '');
    };

    // Function to handle keydown events on cohort name input
    const handleCohortNameKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveCohortName();
        } else if (e.key === 'Escape') {
            cancelCohortNameEditing();
        }
    };

    // Function to copy invite link and show toast
    const handleInviteLearners = async () => {
        if (!schoolSlug) return;
        const inviteLink = `${window.location.origin}/school/${schoolSlug}/join?cohortId=${cohortId}`;

        try {
            await navigator.clipboard.writeText(inviteLink);
            setToastTitle('Invite link copied');
            setToastDescription('Share this link with your learners to let them join this cohort');
            setToastEmoji('🔗');
            setShowToast(true);
        } catch (error) {
            console.error('Failed to copy invite link:', error);
            setToastTitle('Error');
            setToastDescription('Failed to copy invite link. Please try again.');
            setToastEmoji('❌');
            setShowToast(true);
        }
    };

    // Function to handle opening settings dialog
    const handleOpenSettingsDialog = (course: Course) => {
        setSelectedCourseForSettings(course);
    };

    // Function to close settings dialog
    const handleCloseSettingsDialog = () => {
        setSelectedCourseForSettings(null);
    };

    // Function to fetch batches
    const fetchBatches = async () => {
        setIsLoadingBatches(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/batches?cohort_id=${cohortId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch batches: ${response.status}`);
            }
            const batchesData = await response.json();
            setBatches(batchesData);
        } catch (error) {
            console.error("Error fetching batches:", error);
        } finally {
            setIsLoadingBatches(false);
        }
    };

    // Function to handle batch creation
    const handleCreateBatch = async (batchName: string, selectedLearners: any[], selectedMentors: any[]) => {
        // Close the dialog immediately
        setIsBatchDialogOpen(false);

        // Refresh the batches list
        await fetchBatches();

        // Show success toast
        setToastTitle('Success');
        setToastDescription(`${batchName} has been created successfully`);
        setToastEmoji('✅');
        setShowToast(true);
    };

    // Function to open batch creation dialog
    const handleOpenBatchDialog = () => {
        setIsBatchDialogOpen(true);
    };

    // Function to close batch creation dialog
    const handleCloseBatchDialog = () => {
        setIsBatchDialogOpen(false);
    };

    // Get learners and mentors from cohort
    const learners = cohort?.members?.filter(member => member.role === 'learner') || [];
    const mentors = cohort?.members?.filter(member => member.role === 'mentor') || [];

    // Effect to fetch batches when batch tab is selected
    useEffect(() => {
        if (tab === 'batches') {
            fetchBatches();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, cohortId]);

    useEffect(() => {
        const fetchCohort = async () => {
            if (!cohortId || cohortId === 'undefined') {
                console.error("Invalid cohortId:", cohortId);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}`;

                const cohortResponse = await fetch(url);
                if (!cohortResponse.ok) {
                    throw new Error(`API error: ${cohortResponse.status}`);
                }

                const cohortData = await cohortResponse.json();

                setCohort(cohortData);
                setLoading(false);

                // Fetch school details to get the slug
                try {
                    const schoolResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${schoolId}`);
                    if (schoolResponse.ok) {
                        const schoolData = await schoolResponse.json();
                        setSchoolSlug(schoolData.slug);
                    }
                } catch (error) {
                    console.error("Error fetching school details:", error);
                }

                // Fetch courses in cohort
                try {
                    const cohortCoursesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/courses`);
                    if (cohortCoursesResponse.ok) {
                        const cohortCoursesData = await cohortCoursesResponse.json();
                        const courses = Array.isArray(cohortCoursesData) ? cohortCoursesData : [];
                        setCohort(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                courses: courses
                            };
                        });
                        setSelectedCourseIds(courses.map((course: Course) => course.id));

                        // Set default tab to dashboard if courses exist
                        if (courses.length > 0) {
                            setTab('dashboard');
                        } else {
                            // Set default tab to learners if no courses exist
                            setTab('learners');
                        }
                    } else {
                        // If cohort courses fetch fails, set empty array
                        setCohort(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                courses: []
                            };
                        });
                        setTab('learners');
                    }

                    // Fetch available courses
                    fetchAvailableCourses();
                } catch (error) {
                    console.error("Error fetching cohort courses:", error);
                    // Ensure cohort has empty courses array on error
                    setCohort(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            courses: []
                        };
                    });
                    setTab('learners');
                }
            } catch (error) {
                console.error("Error fetching cohort:", error);
                setCohort({
                    id: parseInt(cohortId),
                    name: "Cohort (Data Unavailable)",
                    org_id: 0,
                    members: [],
                    groups: [],
                    joined_at: undefined
                });
                setLoading(false);
            }
        };

        fetchCohort();
    }, [cohortId, schoolId]);

    const handleRequestDelete = (batch: Batch) => {
        setBatchToDelete(batch);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (!batchToDelete) return;
        setIsDeleting(true);
        setDeleteError(null);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/batches/${batchToDelete.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(`Failed to delete batch: ${response.status}`);
            }
            setBatches(prev => prev.filter(b => b.id !== batchToDelete.id));
            setSelectedBatch(null);
            setShowDeleteDialog(false);
            setIsDeleting(false);
        } catch (error) {
            setIsDeleting(false);
            setDeleteError(error instanceof Error ? error.message : 'Failed to delete batch');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white">
                <Header showCreateCourseButton={false} />
                <div className="flex justify-center items-center py-12">
                    <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!cohort) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p>Cohort not found</p>
            </div>
        );
    }

    return (
        <>
            <style jsx global>{`
                button:focus, 
                input:focus, 
                a:focus,
                div:focus,
                *:focus {
                    outline: none !important;
                    box-shadow: none !important;
                }
                
                input::placeholder {
                    color: #666666 !important;
                }
            `}</style>
            <Header showCreateCourseButton={false} />
            <div className="min-h-screen bg-black text-white">
                <div className="container mx-auto px-4 py-8">
                    <main>
                        <div className="mb-4">
                            <div className="flex flex-col">
                                <Link
                                    href={`/school/admin/${schoolId}#cohorts`}
                                    className="flex items-center text-gray-400 hover:text-white transition-colors mb-4"
                                >
                                    <ArrowLeft size={16} className="mr-2" />
                                    Back to cohorts
                                </Link>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center flex-1">
                                        <div className="w-12 h-12 bg-purple-700 rounded-lg flex items-center justify-center mr-4">
                                            <Layers size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <h1
                                                className="text-3xl font-light outline-none"
                                                ref={cohortNameRef}
                                                contentEditable={isEditingCohortName}
                                                onInput={handleCohortNameInput}
                                                onKeyDown={handleCohortNameKeyDown}
                                                suppressContentEditableWarning={true}
                                            >
                                                {cohort.name}
                                            </h1>
                                        </div>
                                    </div>

                                    {/* Buttons container */}
                                    <div className="flex items-center space-x-3">
                                        {/* Edit/Save/Cancel buttons */}
                                        {isEditingCohortName ? (
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={saveCohortName}
                                                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white text-sm font-medium rounded-full hover:bg-green-700 transition-colors cursor-pointer"
                                                    data-testid="save-cohort-name-button"
                                                >
                                                    <Check size={16} />
                                                    <span>Save</span>
                                                </button>
                                                <button
                                                    onClick={cancelCohortNameEditing}
                                                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-[#333] text-white text-sm font-medium rounded-full hover:bg-[#444] transition-colors cursor-pointer"
                                                    data-testid="cancel-cohort-name-button"
                                                >
                                                    <X size={16} />
                                                    <span>Cancel</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={enableCohortNameEditing}
                                                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-[#333] text-white text-sm font-medium rounded-full hover:bg-[#444] transition-colors cursor-pointer"
                                                    data-testid="edit-cohort-name-button"
                                                >
                                                    <Pencil size={16} />
                                                    <span>Edit</span>
                                                </button>

                                                <button
                                                    onClick={handleInviteLearners}
                                                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors cursor-pointer"
                                                >
                                                    <Mail size={16} />
                                                    <span>Invite learners</span>
                                                </button>

                                                {/* Link Course button and dropdown */}
                                                <div className="relative">
                                                    <button
                                                        data-dropdown-toggle="true"
                                                        className="flex items-center justify-center space-x-2 px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity cursor-pointer"
                                                        onClick={() => {
                                                            setIsDropdownOpen(!isDropdownOpen);
                                                            if (!isDropdownOpen) {
                                                                fetchAvailableCourses();
                                                            }
                                                        }}
                                                    >
                                                        <Plus size={16} />
                                                        <span>Link course</span>
                                                    </button>

                                                    {/* Use the new dropdown component */}
                                                    <CohortCoursesLinkerDropdown
                                                        isOpen={isDropdownOpen}
                                                        onClose={() => setIsDropdownOpen(false)}
                                                        availableCourses={availableCourses}
                                                        totalSchoolCourses={totalSchoolCourses}
                                                        isLoadingCourses={isLoadingCourses}
                                                        courseError={courseError}
                                                        schoolId={schoolId}
                                                        cohortId={cohortId}
                                                        onCoursesLinked={handleCoursesLinked}
                                                        onFetchAvailableCourses={fetchAvailableCourses}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Display linked courses below cohort name */}
                                {cohort?.courses && cohort.courses.length > 0 && (
                                    <div className="mt-6">
                                        <h2 className="mb-3 text-sm font-light">Courses</h2>
                                        <div className="flex flex-wrap gap-3">
                                            {cohort.courses.map(course => (
                                                <div
                                                    key={course.id}
                                                    className="flex items-center bg-[#222] px-4 py-2 rounded-full group hover:bg-[#333] transition-colors"
                                                >
                                                    <Tooltip content="Settings" position="top">
                                                        <button
                                                            onClick={() => handleOpenSettingsDialog(course)}
                                                            className="text-gray-400 hover:text-white cursor-pointer flex items-center mr-2"
                                                            aria-label="View settings"
                                                        >
                                                            <Settings size={16} />
                                                        </button>
                                                    </Tooltip>
                                                    <span className="text-white text-sm font-light">{course.name}</span>
                                                    <Tooltip content="Remove" position="top">
                                                        <button
                                                            onClick={() => initiateCourseUnlink(course)}
                                                            className="text-gray-400 hover:text-white cursor-pointer flex items-center ml-2"
                                                            aria-label="Remove course from cohort"
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
                        </div>

                        {/* Full-width tabs */}
                        <div className="mb-8">
                            <div className="flex border-b border-gray-800">
                                {/* Show Dashboard tab only when courses exist */}
                                {cohort?.courses && cohort.courses.length > 0 && (
                                    <button
                                        className={`flex-1 px-4 py-2 font-light cursor-pointer ${tab === 'dashboard' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}
                                        onClick={() => setTab('dashboard')}
                                    >
                                        <div className="flex items-center justify-center">
                                            <FileText size={16} className="mr-2" />
                                            Dashboard
                                        </div>
                                    </button>
                                )}
                                <button
                                    className={`flex-1 px-4 py-2 font-light cursor-pointer ${tab === 'learners' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}
                                    onClick={() => setTab('learners')}
                                >
                                    <div className="flex items-center justify-center">
                                        <GraduationCap size={16} className="mr-2" />
                                        Learners
                                    </div>
                                </button>
                                <button
                                    className={`flex-1 px-4 py-2 font-light cursor-pointer ${tab === 'mentors' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}
                                    onClick={() => setTab('mentors')}
                                >
                                    <div className="flex items-center justify-center">
                                        <School size={16} className="mr-2" />
                                        Mentors
                                    </div>
                                </button>
                                <button
                                    className={`flex-1 px-4 py-2 font-light cursor-pointer ${tab === 'batches' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}
                                    onClick={() => setTab('batches')}
                                >
                                    <div className="flex items-center justify-center">
                                        <UsersRound size={16} className="mr-2" />
                                        Batches
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Content sections with full width */}
                        {tab === 'dashboard' && (
                            <CohortDashboard
                                cohort={cohort}
                                cohortId={cohortId}
                                schoolId={schoolId}
                                onAddLearners={handleOpenLearnerInviteDialog}
                            />
                        )}

                        {tab === 'learners' && (
                            <CohortMemberManagement
                                cohort={cohort}
                                role="learner"
                                cohortId={cohortId}
                                schoolId={schoolId}
                                openInviteDialog={openLearnerInviteDialog}
                                onInviteDialogClose={handleCloseLearnerInviteDialog}
                                onShowToast={(title, description, emoji) => {
                                    setToastTitle(title);
                                    setToastDescription(description);
                                    setToastEmoji(emoji);
                                    setShowToast(true);
                                }}
                                updateCohort={(updatedMembers) => {
                                    setCohort(prev => prev ? {
                                        ...prev,
                                        members: updatedMembers
                                    } : null);
                                }}
                            />
                        )}

                        {tab === 'mentors' && (
                            <CohortMemberManagement
                                cohort={cohort}
                                role="mentor"
                                cohortId={cohortId}
                                schoolId={schoolId}
                                onShowToast={(title, description, emoji) => {
                                    setToastTitle(title);
                                    setToastDescription(description);
                                    setToastEmoji(emoji);
                                    setShowToast(true);
                                }}
                                updateCohort={(updatedMembers) => {
                                    setCohort(prev => prev ? {
                                        ...prev,
                                        members: updatedMembers
                                    } : null);
                                }}
                            />
                        )}

                        {tab === 'batches' && (
                            <>
                                {isLoadingBatches ? (
                                    <div className="flex justify-center items-center py-8">
                                        <div className="w-8 h-8 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                                    </div>
                                ) : batches.length === 0 ? (
                                    // Single placeholder when no batches
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <h4 className="text-2xl font-light mb-4">Organize into batches</h4>
                                        <p className="text-gray-400 text-center mb-8">Create your first batch to organize learners into small groups with mentors</p>
                                        <button
                                            onClick={handleOpenBatchDialog}
                                            className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                                        >
                                            Create batch
                                        </button>
                                    </div>
                                ) : (
                                    // Split screen when batches exist
                                    <div className="flex h-[600px]">
                                        {/* Left side - Batch list (30%) */}
                                        <div className="w-[30%] border-r border-gray-800 pr-6">
                                            <div className="flex items-center justify-between mb-6">
                                                <button
                                                    onClick={handleOpenBatchDialog}
                                                    className="px-4 py-2 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                                                >
                                                    Create batch
                                                </button>
                                            </div>

                                            {/* Search bar */}
                                            <div className="relative mb-4">
                                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                                    <Search size={16} className="text-gray-500" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={batchSearchQuery}
                                                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                                                    placeholder="Search batches"
                                                    className="w-full pl-10 pr-4 py-2 bg-[#0D0D0D] text-white text-sm rounded-lg font-light placeholder-gray-500 outline-none border-none"
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                {batches
                                                    .filter(batch =>
                                                        batch.name.toLowerCase().includes(batchSearchQuery.toLowerCase())
                                                    )
                                                    .map(batch => {
                                                        const learnerCount = batch.members.filter(member => member.role === 'learner').length;
                                                        const mentorCount = batch.members.filter(member => member.role === 'mentor').length;

                                                        return (
                                                            <button
                                                                key={batch.id}
                                                                onClick={() => setSelectedBatch(batch)}
                                                                className={`w-full text-left p-4 rounded-lg transition-colors cursor-pointer ${selectedBatch?.id === batch.id
                                                                    ? 'bg-white text-gray-900'
                                                                    : 'bg-[#222] text-gray-300 hover:bg-[#333]'
                                                                    }`}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium mb-1">{batch.name}</span>
                                                                    <span className="text-sm opacity-70">
                                                                        {learnerCount} learner{learnerCount !== 1 ? 's' : ''}, {mentorCount} mentor{mentorCount !== 1 ? 's' : ''}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>

                                        {/* Right side - Batch details placeholder (70%) */}
                                        <div className="w-[70%] pl-6">
                                            {selectedBatch ? (
                                                <CreateBatchDialog
                                                    inline
                                                    isOpen={true}
                                                    onClose={() => setSelectedBatch(null)}
                                                    mode="view"
                                                    batch={selectedBatch}
                                                    learners={learners}
                                                    mentors={mentors}
                                                    cohortId={cohortId}
                                                    onRequestDelete={handleRequestDelete}
                                                    onBatchUpdated={(updatedBatch) => {
                                                        setBatches(prev => prev.map(b => b.id === updatedBatch.id ? updatedBatch : b));
                                                        setSelectedBatch(updatedBatch);
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center mt-10 h-full">
                                                    <h4 className="text-2xl font-light mb-2">No batch selected yet</h4>
                                                    <p className="text-gray-400 text-center">
                                                        Select a batch to manage it
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                    </main>
                </div>
            </div>

            {/* Add the course unlinking confirmation dialog near the other dialog components
            at the end of the component, before the final Toast component */}
            <ConfirmationDialog
                open={isCourseUnlinkConfirmOpen}
                title="Remove course from cohort"
                message={`Are you sure you want to remove "${courseToUnlink?.name}" from this cohort? Learners will no longer have access to this course`}
                confirmButtonText="Remove"
                onConfirm={() => courseToUnlink && removeCourseFromCohort(courseToUnlink.id)}
                onCancel={() => setIsCourseUnlinkConfirmOpen(false)}
                type="delete"
            />

            {/* Toast notification */}
            <Toast
                show={showToast}
                title={toastTitle}
                description={toastDescription}
                emoji={toastEmoji}
                onClose={() => setShowToast(false)}
            />

            {/* Add CoursePublishSuccessBanner component before the final closing tag */}
            <CoursePublishSuccessBanner
                isOpen={showCoursePublishBanner}
                onClose={closeCoursePublishBanner}
                cohortId={parseInt(cohortId)}
                cohortName={cohort?.name || ''}
                schoolSlug={schoolSlug}
                schoolId={schoolId}
                courseCount={courseLinkDetails.courseCount}
                courseNames={courseLinkDetails.courseNames}
                source="cohort"
            />

            {/* Add SettingsDialog component */}
            <SettingsDialog
                isOpen={!!selectedCourseForSettings}
                onClose={handleCloseSettingsDialog}
                courseName={selectedCourseForSettings?.name}
                dripConfig={{
                    is_drip_enabled: selectedCourseForSettings?.drip_config?.is_drip_enabled,
                    frequency_value: selectedCourseForSettings?.drip_config?.frequency_value,
                    frequency_unit: selectedCourseForSettings?.drip_config?.frequency_unit,
                    publish_at: selectedCourseForSettings?.drip_config?.publish_at
                }}
                schoolId={schoolId}
                courseId={selectedCourseForSettings?.id}
                cohortId={undefined}
            />

            {/* Add CreateBatchDialog component */}
            <CreateBatchDialog
                isOpen={isBatchDialogOpen}
                onClose={handleCloseBatchDialog}
                learners={learners}
                mentors={mentors}
                onCreateBatch={handleCreateBatch}
                cohortId={cohortId}
            />

            {/* ConfirmationDialog for batch delete */}
            <ConfirmationDialog
                open={showDeleteDialog}
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteDialog(false)}
                title="Delete batch"
                message={`Are you sure you want to delete the batch? This action cannot be undone`}
                confirmButtonText="Delete"
                isLoading={isDeleting}
                errorMessage={deleteError}
                type="delete"
            />
        </>
    );
} 