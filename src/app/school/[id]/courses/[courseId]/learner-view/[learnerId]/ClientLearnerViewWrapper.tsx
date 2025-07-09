"use client";

import { useState, useEffect } from "react";
import LearnerCourseView from "@/components/LearnerCourseView";
import { Module } from "@/types/course";
import { getCompletionData } from "@/lib/api";

interface ClientLearnerViewWrapperProps {
    modules: Module[];
    learnerId: string;
    cohortId: string;
    courseId: string;
    isAdminView: boolean;
}

export default function ClientLearnerViewWrapper({
    modules,
    learnerId,
    cohortId,
    courseId,
    isAdminView
}: ClientLearnerViewWrapperProps) {

    // State for tracking completed tasks and questions
    const [completedTaskIds, setCompletedTaskIds] = useState<Record<string, boolean>>({});
    const [completedQuestionIds, setCompletedQuestionIds] = useState<Record<string, Record<string, boolean>>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch learner progress data when component mounts
    useEffect(() => {
        const fetchLearnerProgress = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Fetch the learner's progress data
                const { taskCompletions, questionCompletions } = await getCompletionData(parseInt(cohortId), learnerId);

                setCompletedTaskIds(taskCompletions);
                setCompletedQuestionIds(questionCompletions);
            } catch (err) {
                console.error("Error fetching learner progress:", err);
                setError("Failed to load learner's progress data. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchLearnerProgress();
    }, [learnerId, courseId]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-12 h-12 border-t-2 border-white rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg text-center">
                <p className="text-red-400 mb-2">{error}</p>
            </div>
        );
    }

    return (
        <LearnerCourseView
            modules={modules}
            completedTaskIds={completedTaskIds}
            completedQuestionIds={completedQuestionIds}
            viewOnly={true}
            learnerId={learnerId}
            isAdminView={isAdminView}
        />
    );
} 