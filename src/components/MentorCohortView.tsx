"use client";

import { useState, useEffect } from "react";
import { Course, CohortWithDetails, CohortMember } from "@/types";
import CohortDashboard from "@/components/CohortDashboard";
import LearnerCohortView from "@/components/LearnerCohortView";
import { Module } from "@/types/course";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Users } from "lucide-react";

interface TaskTypeMetrics {
    completion_rate: number;
    count: number;
    completions: Record<string, number>;
}

// Course metrics interface
interface CourseMetrics {
    average_completion: number;
    num_tasks: number;
    num_active_learners: number;
    task_type_metrics: {
        quiz?: TaskTypeMetrics;
        learning_material?: TaskTypeMetrics;
        exam?: TaskTypeMetrics;
    };
}

interface MentorCohortViewProps {
    cohort: CohortWithDetails;
    activeCourseIndex?: number; // now optional
    schoolId: string;
    onActiveCourseChange?: (index: number) => void; // new
    batchId?: number | null; // new
    // Props for LearnerCohortView
    courseModules?: Module[];
    completedTaskIds?: Record<string, boolean>;
    completedQuestionIds?: Record<string, Record<string, boolean>>;
    courses?: Course[];
}

export default function MentorCohortView({
    cohort,
    activeCourseIndex = 0, // default to 0
    schoolId,
    onActiveCourseChange,
    batchId, // new
    courseModules = [],
    completedTaskIds = {},
    completedQuestionIds = {},
    courses = []
}: MentorCohortViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Get view mode from URL params, default to 'mentor'
    const defaultView = searchParams.get('view') as 'mentor' | 'learner' | null;
    const [viewMode, setViewMode] = useState<'mentor' | 'learner'>(defaultView || 'mentor');

    // Sync viewMode with URL changes
    useEffect(() => {
        const urlView = searchParams.get('view') as 'mentor' | 'learner' | null;
        if (urlView && urlView !== viewMode) {
            setViewMode(urlView);
        }
    }, [searchParams, viewMode]);

    // Update URL when view mode changes
    const updateUrlWithViewMode = (mode: 'mentor' | 'learner') => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('view', mode);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    // Handle view mode toggle
    const handleViewModeToggle = (mode: 'mentor' | 'learner') => {
        setViewMode(mode);
        updateUrlWithViewMode(mode);
    };

    // Show placeholder if batchId is null
    if (batchId === null) {
        return (
            <div className="flex flex-col items-center justify-center py-20 flex-1">
                <h2 className="text-4xl font-light mb-4">No learners assigned yet</h2>
                <p className="text-gray-400 mb-8">You will see their progress here once they are assigned to you</p>
            </div>
        );
    }

    // State for cohort members
    const [cohortMembers, setCohortMembers] = useState<CohortMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(true);
    const [membersError, setMembersError] = useState<string | null>(null);
    const [schoolSlug, setSchoolSlug] = useState<string>('');

    useEffect(() => {
        const fetchCohortMembers = async () => {
            if (!cohort?.id) return;
            setIsLoadingMembers(true);
            setMembersError(null);
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohort.id}?batch_id=${batchId}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch cohort members: ${response.status}`);
                }
                const data = await response.json();
                setCohortMembers(data.members);
            } catch (error) {
                setMembersError("Failed to load cohort members.");
            } finally {
                setIsLoadingMembers(false);
            }
        };
        const fetchSchoolSlug = async () => {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${schoolId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch school details: ${response.status}`);
            }
            const data = await response.json();
            setSchoolSlug(data.slug);
        };
        fetchCohortMembers();
        fetchSchoolSlug();
    }, [cohort?.id, batchId]);

    if (isLoadingMembers) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-12 h-12 border-t-2 border-white rounded-full animate-spin"></div>
            </div>
        );
    }
    if (membersError) {
        return (
            <div className="flex flex-col items-center justify-center p-8 border border-red-800 rounded-lg bg-red-900/20">
                <p className="text-red-400 mb-2">{membersError}</p>
            </div>
        );
    }

    // Merge members into cohort object, preserving all CohortWithDetails properties
    const cohortWithMembers = { ...cohort, members: cohortMembers };

    return (
        <div className="w-full">
            {/* View Mode Toggle */}
            <div className="flex justify-center mb-8">
                <div className="bg-[#333333] rounded-full p-1 flex items-center">
                    <button
                        onClick={() => handleViewModeToggle('mentor')}
                        className={`flex items-center px-4 py-2 rounded-full text-sm font-light transition-all cursor-pointer ${viewMode === 'mentor'
                            ? 'bg-white text-black'
                            : 'text-white hover:bg-black'
                            }`}
                    >
                        <Users size={16} className="mr-2" />
                        Mentor View
                    </button>
                    <button
                        onClick={() => handleViewModeToggle('learner')}
                        className={`flex items-center px-4 py-2 rounded-full text-sm font-light transition-all cursor-pointer ${viewMode === 'learner'
                            ? 'bg-white text-black'
                            : 'text-white hover:bg-black'
                            }`}
                    >
                        <Eye size={16} className="mr-2" />
                        Learner View
                    </button>
                </div>
            </div>

            {/* Render appropriate view */}
            {viewMode === 'mentor' ? (
                <CohortDashboard
                    cohort={cohortWithMembers}
                    cohortId={cohort.id.toString()}
                    schoolId={schoolId}
                    schoolSlug={schoolSlug}
                    view="mentor"
                    activeCourseIndex={activeCourseIndex}
                    onActiveCourseChange={onActiveCourseChange}
                    batchId={batchId}
                />
            ) : (
                <LearnerCohortView
                    courseTitle={courses.length > 1 ? "" : courses[activeCourseIndex]?.name || ""}
                    modules={courseModules}
                    schoolId={schoolId}
                    cohortId={cohort.id.toString()}
                    streakDays={2}
                    activeDays={["M", "T"]}
                    completedTaskIds={completedTaskIds}
                    completedQuestionIds={completedQuestionIds}
                    courses={courses}
                    onCourseSelect={onActiveCourseChange}
                    activeCourseIndex={activeCourseIndex}
                />
            )}
        </div>
    );
} 