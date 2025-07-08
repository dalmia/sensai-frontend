"use client";

import { useState, useEffect } from "react";
import { Course, CohortWithDetails, CohortMember } from "@/types";
import CohortDashboard from "@/components/CohortDashboard";

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
}

export default function MentorCohortView({
    cohort,
    activeCourseIndex = 0, // default to 0
    schoolId,
    onActiveCourseChange
}: MentorCohortViewProps) {
    // State for cohort members
    const [cohortMembers, setCohortMembers] = useState<CohortMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(true);
    const [membersError, setMembersError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCohortMembers = async () => {
            if (!cohort?.id) return;
            setIsLoadingMembers(true);
            setMembersError(null);
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohort.id}`);
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
        fetchCohortMembers();
    }, [cohort?.id]);

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
        <CohortDashboard
            cohort={cohortWithMembers}
            cohortId={cohort.id.toString()}
            schoolId={schoolId}
            view="mentor"
            activeCourseIndex={activeCourseIndex}
            onActiveCourseChange={onActiveCourseChange}
        />
    );
} 