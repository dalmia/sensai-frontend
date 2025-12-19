"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HelpCircle, ChevronRight, ArrowUp, ArrowDown, Search } from "lucide-react";
import Tooltip from "@/components/Tooltip";
import ClientLeaderboardView from "@/app/school/[id]/cohort/[cohortId]/leaderboard/ClientLeaderboardView";
import TaskTypeMetricCard from "@/components/TaskTypeMetricCard";
import { CohortWithDetails as Cohort, CohortMember } from "@/types";

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
        assignment?: TaskTypeMetrics;
    };
}

interface CohortDashboardProps {
    cohort: Cohort;
    cohortId: string;
    schoolId: string;
    schoolSlug: string;
    onAddLearners?: () => void;
    view?: 'admin' | 'mentor';
    activeCourseIndex?: number;
    onActiveCourseChange?: (index: number) => void;
    batchId?: number | null;
}

export default function CohortDashboard({ cohort, cohortId, schoolId, schoolSlug, onAddLearners, view = 'admin', activeCourseIndex, onActiveCourseChange, batchId }: CohortDashboardProps) {
    // State for course metrics
    const [courseMetrics, setCourseMetrics] = useState<CourseMetrics | null>(null);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
    const [metricsError, setMetricsError] = useState<string | null>(null);

    // State for active course
    const [activeCourseId, setActiveCourseId] = useState<number | null>(null);
    // Track local index for dropdown
    const [localCourseIndex, setLocalCourseIndex] = useState<number>(0);

    // State for sorting the student metrics table
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

    // State for search functionality
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Handle column header click for sorting
    const handleSort = (column: string) => {
        if (sortColumn === column) {
            // Cycle through: asc -> desc -> null
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else if (sortDirection === 'desc') {
                setSortColumn(null);
                setSortDirection(null);
            }
        } else {
            // New column selected, start with ascending
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const fetchCourseMetrics = async () => {
        if (!cohort?.courses || cohort.courses.length === 0) {
            setIsLoadingMetrics(false);
            return;
        }

        // Use activeCourseIndex prop if provided, otherwise use localCourseIndex, defaulting to 0
        let courseIndex = 0;
        if (typeof activeCourseIndex === 'number' && activeCourseIndex >= 0 && activeCourseIndex < cohort.courses.length) {
            courseIndex = activeCourseIndex;
        } else if (localCourseIndex >= 0 && localCourseIndex < cohort.courses.length) {
            courseIndex = localCourseIndex;
        }
        const courseId = cohort.courses[courseIndex].id;

        setIsLoadingMetrics(true);
        setMetricsError(null);

        try {
            const url = batchId != null
                ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/courses/${courseId}/metrics?batch_id=${batchId}`
                : `${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/courses/${courseId}/metrics`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch metrics: ${response.status}`);
            }

            const metricsData: CourseMetrics = await response.json();
            setCourseMetrics(metricsData);
        } catch (error) {
            console.error("Error fetching course metrics:", error);
            setMetricsError("There was an error while fetching the metrics. Please try again.");
        } finally {
            setIsLoadingMetrics(false);
        }
    };

    // Format learner name
    const formatLearnerName = (member: CohortMember): string => {
        const name = [member.first_name, member.middle_name, member.last_name]
          .filter(Boolean)
          .join(' ');
          
        return name || member.email;
    }

    // Set initial active course when courses change or activeCourseIndex changes
    useEffect(() => {
        if (cohort?.courses && cohort.courses.length > 0) {
            let index = 0;
            if (typeof activeCourseIndex === 'number' && activeCourseIndex >= 0 && activeCourseIndex < cohort.courses.length) {
                index = activeCourseIndex;
            }
            setActiveCourseId(cohort.courses[index].id);
            setLocalCourseIndex(index);
        }
    }, [cohort?.courses, activeCourseIndex]);

    // Add click outside handler for dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const dropdown = document.getElementById('course-dropdown');
            const button = document.getElementById('course-dropdown-button');

            if (dropdown && !dropdown.classList.contains('hidden') &&
                button && !button.contains(event.target as Node) &&
                !dropdown.contains(event.target as Node)) {
                dropdown.classList.add('hidden');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fetch metrics when the component mounts, when cohort courses change, or when active course or batch changes
    useEffect(() => {
        fetchCourseMetrics();
    }, [cohort?.courses, cohortId, activeCourseIndex, localCourseIndex, batchId]);

    // Check if there are any learners in the cohort
    const learnerCount = cohort?.members?.filter(m => m.role === 'learner').length || 0;

    // If no learners, display placeholder
    if (!isLoadingMetrics && learnerCount === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 rounded-lg">
                <h2 className="text-4xl font-light mb-4">No learners in this cohort yet</h2>
                <p className="text-gray-400 mb-8">
                    {view === 'mentor'
                        ? "No learners have joined this cohort yet. Once learners join, you'll be able to view their progress and metrics."
                        : "Add learners to this cohort to view usage data and metrics"}
                </p>
                {view !== 'mentor' && (
                    <button
                        onClick={() => {
                            if (onAddLearners) onAddLearners();
                        }}
                        className="px-6 py-3 bg-[#e5e7eb] text-[#000000] dark:bg-[#ffffff] dark:text-[#000000] text-sm font-medium rounded-full hover:opacity-90 transition-opacity cursor-pointer"
                    >
                        Add learners
                    </button>
                )}
            </div>
        );
    }

    if (!isLoadingMetrics && !metricsError && (courseMetrics === null || !courseMetrics || Object.keys(courseMetrics).length === 0)) {
        return (
            <div className="flex flex-col items-center justify-center py-20 rounded-lg" data-testid="empty-course-state">
                <h2 className="text-4xl font-light mb-4">Empty Course</h2>
                <p className="text-gray-400 mb-8">
                    {view === 'mentor'
                        ? "No tasks have been added to this course yet. Once tasks are available, you'll be able to view progress and metrics."
                        : "Add tasks to this course to view usage data and metrics"}
                </p>
            </div>
        );
    }

    // Get the active course object
    const activeCourse = cohort?.courses?.find(course => course.id === activeCourseId) || cohort?.courses?.[0];

    return (
        <div>
            <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-2/3">
                    {/* Course title - only show if there's just one course */}
                    {activeCourse && cohort?.courses?.length === 1 && (
                        <h2 className="text-2xl font-light mb-4">{activeCourse.name}</h2>
                    )}

                    {/* Course selector: Tabs for mentor, Dropdown for others */}
                    {cohort?.courses && cohort.courses.length > 1 && (
                        <div className="mb-6">
                            {view === 'mentor' ? (
                                // Tabs for mentor view
                                <div className="w-full">
                                    <div className="flex items-center border-b border-gray-200 dark:border-gray-900 overflow-x-auto scrollbar-hide">
                                        {cohort.courses.map((course, index) => (
                                            <button
                                                key={course.id}
                                                className={`px-8 py-4 text-base md:text-lg tracking-wide whitespace-nowrap transition-all duration-200 cursor-pointer flex-shrink-0 relative group ${index === localCourseIndex
                                                    ? 'text-black dark:text-white font-light'
                                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-light'
                                                    }`}
                                                onClick={() => {
                                                    setActiveCourseId(course.id);
                                                    setLocalCourseIndex(index);
                                                    if (onActiveCourseChange) onActiveCourseChange(index);
                                                }}
                                            >
                                                <span className="relative z-10">{course.name}</span>
                                                {/* Active indicator */}
                                                {index === localCourseIndex && (
                                                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-black dark:bg-white" />
                                                )}
                                                {/* Hover indicator */}
                                                {index !== localCourseIndex && (
                                                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gray-300 dark:bg-gray-700 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                // Dropdown for admin/other views
                                <>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        Select Course
                                    </label>
                                    <div className="relative inline-block">
                                        <button
                                            id="course-dropdown-button"
                                            data-testid="course-dropdown-button"
                                            className="flex items-center justify-between min-w-[240px] px-4 py-2 bg-gray-100 dark:bg-[#111] text-gray-900 dark:text-white rounded-md hover:bg-gray-200 dark:hover:bg-[#222] transition-colors cursor-pointer"
                                            onClick={() => {
                                                const dropdown = document.getElementById('course-dropdown');
                                                if (dropdown) {
                                                    dropdown.classList.toggle('hidden');
                                                }
                                            }}
                                        >
                                            <span>{cohort.courses[localCourseIndex]?.name}</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        <div
                                            id="course-dropdown"
                                            className="absolute z-10 hidden mt-1 bg-white dark:bg-[#111] border border-gray-200 dark:border-[#333] shadow-lg rounded-md w-full max-h-60 overflow-y-auto"
                                        >
                                            {cohort.courses.map((course, idx) => (
                                                <button
                                                    key={course.id}
                                                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#222] transition-colors cursor-pointer ${activeCourseId === course.id ? 'bg-gray-100 dark:bg-[#222]' : ''}`}
                                                    onClick={() => {
                                                        setActiveCourseId(course.id);
                                                        setLocalCourseIndex(idx);
                                                        if (onActiveCourseChange) onActiveCourseChange(idx);
                                                        document.getElementById('course-dropdown')?.classList.add('hidden');
                                                    }}
                                                >
                                                    {course.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {isLoadingMetrics ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="w-12 h-12 border-t-2 border-b-2 border-foreground rounded-full animate-spin"></div>
                        </div>
                    ) : metricsError ? (
                        <div className="flex flex-col items-center justify-center p-8 border border-red-800 rounded-lg bg-red-900/20">
                            <p className="text-red-400 mb-2">{metricsError}</p>
                            <button
                                className="text-white bg-red-800 hover:bg-red-700 px-4 py-2 rounded-md mt-2 cursor-pointer"
                                onClick={fetchCourseMetrics}
                            >
                                Try again
                            </button>
                        </div>
                    ) : courseMetrics && Object.keys(courseMetrics).length > 0 && (
                        <div className="flex gap-6">
                            {/* Task Completion Rate - 75% width */}
                            <div className="bg-gray-50 dark:bg-[#111] p-8 rounded-lg w-2/3 border border-gray-200 dark:border-transparent">
                                <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-6 flex items-center">
                                    <span className="inline-block">Task completion</span>
                                    <Tooltip content="Average percentage of tasks completed by a learner" position="top">
                                        <span className="ml-2 inline-flex items-center">
                                            <HelpCircle size={14} className="relative top-[0.1em]" />
                                        </span>
                                    </Tooltip>
                                </h3>
                                <div className="flex gap-4">
                                    {/* Left column: Percentage number, vertically centered */}
                                    <div className="flex items-center">
                                        <span className={`text-4xl font-light ${courseMetrics.average_completion < 0.3 ? 'text-red-400' :
                                            courseMetrics.average_completion < 0.7 ? 'text-amber-400' :
                                                'text-green-400'
                                            }`}>
                                            {Math.round(courseMetrics.average_completion * 100)}%
                                        </span>
                                    </div>

                                    {/* Right column: Progress bar and task count */}
                                    <div className="flex-1 flex flex-col">
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-800 h-4 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${courseMetrics.average_completion < 0.3 ? 'bg-red-400' :
                                                    courseMetrics.average_completion < 0.7 ? 'bg-amber-400' :
                                                        'bg-green-400'
                                                    }`}
                                                style={{ width: `${courseMetrics.average_completion * 100}%` }}
                                            ></div>
                                        </div>
                                        {/* Task count below the progress bar */}
                                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-right">
                                            {Math.round(courseMetrics.average_completion * courseMetrics.num_tasks)} / {courseMetrics.num_tasks} tasks
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Active Learners - 25% width */}
                            <div className="bg-gray-50 dark:bg-[#111] p-8 rounded-lg w-1/3 border border-gray-200 dark:border-transparent">
                                <h3 className="text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                                    <span className="inline-block">Active learners</span>
                                    <Tooltip content="Number of learners who have attempted at least one task" position="top">
                                        <span className="ml-2 inline-flex items-center">
                                            <HelpCircle size={14} className="relative top-[0.1em]" />
                                        </span>
                                    </Tooltip>
                                </h3>
                                <div className="flex items-end">
                                    {/* Calculate the percentage of active learners */}
                                    {(() => {
                                        const totalLearners = cohort?.members?.filter(m => m.role === 'learner').length || 0;
                                        const activePercentage = totalLearners > 0 ?
                                            (courseMetrics.num_active_learners / totalLearners) : 0;

                                        // Determine font size based on digit count
                                        const activeLearnerDigits = courseMetrics.num_active_learners.toString().length;
                                        const totalLearnerDigits = totalLearners.toString().length;
                                        const largeNumberClass =
                                            (activeLearnerDigits >= 4 || totalLearnerDigits >= 4)
                                                ? "text-4xl"
                                                : (activeLearnerDigits >= 3 || totalLearnerDigits >= 3)
                                                    ? "text-5xl"
                                                    : "text-6xl";

                                        return (
                                            <div className="w-full flex items-baseline">
                                                <span className={`${largeNumberClass} font-light whitespace-nowrap ${activePercentage < 0.3 ? 'text-red-400' :
                                                    activePercentage < 0.7 ? 'text-amber-400' :
                                                        'text-green-400'
                                                    }`}>
                                                    {courseMetrics.num_active_learners}
                                                </span>
                                                        <span className="text-sm text-gray-600 dark:text-gray-400 ml-2 whitespace-nowrap">
                                                    out of {totalLearners}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                    )}

                    {/* Task Type Metrics - Ultra Simple Direct Cards */}
                    {courseMetrics && Object.keys(courseMetrics).length > 0 && (
                        <div className="mt-8">
                            <h3 className="text-gray-600 dark:text-gray-400 mb-4 flex items-center pl-2">
                                <span className="inline-block">Completion by type</span>
                                <Tooltip content="Average completion by a learner for each type of task" position="top">
                                    <span className="ml-2 inline-flex items-center">
                                        <HelpCircle size={14} className="relative top-[0.1em]" />
                                    </span>
                                </Tooltip>
                            </h3>

                            {/* Empty state */}
                            {!courseMetrics.task_type_metrics?.quiz &&
                                !courseMetrics.task_type_metrics?.learning_material &&
                                !courseMetrics.task_type_metrics?.exam &&
                                !courseMetrics.task_type_metrics?.assignment && (
                                    <div className="text-center text-gray-600 dark:text-gray-400 py-16 bg-gray-50 dark:bg-[#111] rounded-lg border border-gray-200 dark:border-transparent">
                                        No task type metrics available
                                    </div>
                                )}

                            {/* Cards Layout */}
                            {(courseMetrics.task_type_metrics?.quiz ||
                                courseMetrics.task_type_metrics?.learning_material ||
                                courseMetrics.task_type_metrics?.assignment) && (() => {
                                    // Calculate number of available task types
                                    const availableTypes = [
                                        courseMetrics.task_type_metrics?.quiz,
                                        courseMetrics.task_type_metrics?.learning_material,
                                        courseMetrics.task_type_metrics?.assignment,
                                    ].filter(Boolean).length;

                                    // Render with the appropriate grid class based on count
                                    return (
                                        <div className={`grid grid-cols-1 ${availableTypes === 1 ? 'md:grid-cols-1' : availableTypes === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
                                            } gap-4`}>

                                            {/* Learning Material Card */}
                                            {courseMetrics.task_type_metrics?.learning_material && (
                                                <TaskTypeMetricCard
                                                    title="Learning material"
                                                    count={courseMetrics.task_type_metrics?.learning_material?.count}
                                                    completionRate={courseMetrics.task_type_metrics?.learning_material?.completion_rate}
                                                    color="purple"
                                                />
                                            )}

                                            {/* Quiz Card */}
                                            {courseMetrics.task_type_metrics?.quiz && (
                                                <TaskTypeMetricCard
                                                    title="Quiz"
                                                    count={courseMetrics.task_type_metrics?.quiz?.count}
                                                    completionRate={courseMetrics.task_type_metrics?.quiz?.completion_rate}
                                                    color="indigo"
                                                />
                                            )}

                                            {/* Assignment Card */}
                                            {courseMetrics.task_type_metrics?.assignment && (
                                                <TaskTypeMetricCard
                                                    title="Assignment"
                                                    count={courseMetrics.task_type_metrics?.assignment?.count}
                                                    completionRate={courseMetrics.task_type_metrics?.assignment?.completion_rate}
                                                    color="blue"
                                                />
                                            )}
                                        </div>
                                    );
                                })()}
                        </div>
                    )}
                </div>

                {/* Right side - Leaderboard */}
                {courseMetrics && Object.keys(courseMetrics).length > 0 && (<div className="lg:w-1/2 space-y-6 h-full">
                    {/* Use ClientLeaderboardView */}
                    <ClientLeaderboardView
                        cohortId={cohortId}
                        cohortName={cohort?.name}
                        view='admin'
                        topN={5}
                        batchId={batchId}
                    />
                    {/* View All Leaderboard Button */}
                    {cohort?.members?.filter(m => m.role === 'learner').length > 5 &&
                        <div className="flex justify-center mt-2">
                            <Link
                                href={`/school/${schoolId}/cohort/${cohortId}/leaderboard${batchId != null ? `?batchId=${batchId}` : ''}`}
                                className="group px-4 py-2 font-light rounded-md transition-all duration-200 flex items-center 
                            bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-white/10 dark:hover:bg-white/15 dark:text-gray-200 cursor-pointer"
                            >
                                <span>View Full Leaderboard</span>
                                <ChevronRight size={16} className="ml-1 transition-transform duration-200 group-hover:translate-x-0.5" />
                            </Link>
                        </div>
                    }
                </div>)}
            </div>

            {/* Student Level Metrics Table */}
            {courseMetrics && Object.keys(courseMetrics).length > 0 && (
                <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-gray-600 dark:text-gray-400 flex items-center pl-2">
                            <span className="inline-block">Completion by learner</span>
                            <Tooltip content="Completion rate for each learner by task type" position="top">
                                <span className="ml-2 inline-flex items-center">
                                    <HelpCircle size={14} className="relative top-[0.1em]" />
                                </span>
                            </Tooltip>
                        </h3>

                        {/* Search input */}
                        <div className="relative w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={16} className="text-gray-500 dark:text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search learners"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 dark:!bg-black/30 dark:border-gray-800 dark:text-white dark:focus:ring-white/20 dark:focus:border-white/20"
                            />
                        </div>
                    </div>

                    {/* Student metrics table */}
                    <div className="bg-white dark:bg-[#111] rounded-lg overflow-hidden border border-gray-200 dark:border-transparent">
                        {(() => {
                            // Get all unique student IDs across all task types
                            const studentIds = new Set<string>();

                            if (courseMetrics.task_type_metrics?.learning_material?.completions) {
                                Object.keys(courseMetrics.task_type_metrics?.learning_material?.completions).forEach(id =>
                                    studentIds.add(id));
                            }
                            if (courseMetrics.task_type_metrics?.quiz?.completions) {
                                Object.keys(courseMetrics.task_type_metrics?.quiz?.completions).forEach(id =>
                                    studentIds.add(id));
                            }
                            if (courseMetrics.task_type_metrics?.exam?.completions) {
                                Object.keys(courseMetrics.task_type_metrics?.exam?.completions).forEach(id =>
                                    studentIds.add(id));
                            }
                            if (courseMetrics.task_type_metrics?.assignment?.completions) {
                                Object.keys(courseMetrics.task_type_metrics?.assignment?.completions).forEach(id =>
                                    studentIds.add(id));
                            }

                            // Map student IDs to member info
                            const studentIdToMember = new Map<string, CohortMember>();
                            cohort?.members?.filter(m => m.role === 'learner').forEach(member => {
                                studentIdToMember.set(member.id.toString(), member);
                            });

                            if (studentIds.size === 0) {
                                return (
                                    <div className="text-center text-gray-400 py-16">
                                        No learner progress data available
                                    </div>
                                );
                            }

                            // Function to get completion percentage for a student and task type
                            const getCompletionPercentage = (studentId: string, taskType: 'learning_material' | 'quiz' | 'assignment') => {
                                if (!courseMetrics.task_type_metrics[taskType]) return null;

                                const completions = courseMetrics.task_type_metrics[taskType]?.completions || {};
                                const count = courseMetrics.task_type_metrics[taskType]?.count || 0;

                                if (count === 0) return null;
                                return (completions[studentId] || 0) / count;
                            };

                            // First filter by search query
                            let filteredStudentIds = Array.from(studentIds).filter(studentId => {
                                const member = studentIdToMember.get(studentId);
                                if (!member) return false;

                                const query = searchQuery.toLowerCase().trim();
                                if (!query) return true; // If no search query, include all

                                // Search by email (could be extended to other fields if needed)
                                return member.email.toLowerCase().includes(query);
                            });

                            // Then sort if sorting is active
                            if (sortColumn && sortDirection) {
                                filteredStudentIds.sort((a, b) => {
                                    let valueA: number | null = null;
                                    let valueB: number | null = null;

                                    if (sortColumn === 'learning_material') {
                                        valueA = getCompletionPercentage(a, 'learning_material');
                                        valueB = getCompletionPercentage(b, 'learning_material');
                                    } else if (sortColumn === 'quiz') {
                                        valueA = getCompletionPercentage(a, 'quiz');
                                        valueB = getCompletionPercentage(b, 'quiz');
                                    } else if (sortColumn === 'assignment') {
                                        valueA = getCompletionPercentage(a, 'assignment');
                                        valueB = getCompletionPercentage(b, 'assignment');
                                    }

                                    // Handle null values (put them at the end)
                                    if (valueA === null && valueB === null) return 0;
                                    if (valueA === null) return 1;
                                    if (valueB === null) return -1;

                                    return sortDirection === 'asc'
                                        ? valueA - valueB
                                        : valueB - valueA;
                                });
                            }

                            // Show empty state when no results match search
                            if (filteredStudentIds.length === 0 && searchQuery) {
                                return (
                                    <div className="text-center text-gray-600 dark:text-gray-400 py-16">
                                        No learners match your search query
                                    </div>
                                );
                            }

                            return (
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-800">
                                            <th className="text-left text-gray-600 dark:text-gray-400 p-4 font-normal">Learner</th>
                                            {courseMetrics.task_type_metrics?.learning_material && (
                                                <th
                                                    className="text-left text-gray-600 dark:text-gray-400 p-4 font-normal cursor-pointer hover:bg-gray-50 dark:hover:bg-black/30 select-none"
                                                    onClick={() => handleSort('learning_material')}
                                                >
                                                    <div className="flex items-center">
                                                        <span className="text-purple-400 mr-1">●</span>
                                                        <span>Learning material</span>
                                                        {sortColumn === 'learning_material' && sortDirection === 'asc' && (
                                                            <ArrowUp size={14} className="ml-1" />
                                                        )}
                                                        {sortColumn === 'learning_material' && sortDirection === 'desc' && (
                                                            <ArrowDown size={14} className="ml-1" />
                                                        )}
                                                    </div>
                                                </th>
                                            )}
                                            {courseMetrics.task_type_metrics?.quiz && (
                                                <th
                                                    className="text-left text-gray-600 dark:text-gray-400 p-4 font-normal cursor-pointer hover:bg-gray-50 dark:hover:bg-black/30 select-none"
                                                    onClick={() => handleSort('quiz')}
                                                >
                                                    <div className="flex items-center">
                                                        <span className="text-indigo-400 mr-1">●</span>
                                                        <span>Quiz</span>
                                                        {sortColumn === 'quiz' && sortDirection === 'asc' && (
                                                            <ArrowUp size={14} className="ml-1" />
                                                        )}
                                                        {sortColumn === 'quiz' && sortDirection === 'desc' && (
                                                            <ArrowDown size={14} className="ml-1" />
                                                        )}
                                                    </div>
                                                </th>
                                            )}
                                            {courseMetrics.task_type_metrics?.assignment && (
                                                <th
                                                    className="text-left text-gray-600 dark:text-gray-400 p-4 font-normal cursor-pointer hover:bg-gray-50 dark:hover:bg-black/30 select-none"
                                                    onClick={() => handleSort('assignment')}
                                                >
                                                    <div className="flex items-center">
                                                        <span className="text-blue-400 mr-1">●</span>
                                                        <span>Assignment</span>
                                                        {sortColumn === 'assignment' && sortDirection === 'asc' && (
                                                            <ArrowUp size={14} className="ml-1" />
                                                        )}
                                                        {sortColumn === 'assignment' && sortDirection === 'desc' && (
                                                            <ArrowDown size={14} className="ml-1" />
                                                        )}
                                                    </div>
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudentIds.map(studentId => {
                                            const member = studentIdToMember.get(studentId);
                                            if (!member) return null;

                                            // Calculate completion percentages for each task type
                                            const learningMaterialCompletion = courseMetrics.task_type_metrics?.learning_material
                                                ? (courseMetrics.task_type_metrics?.learning_material?.completions[studentId] || 0) /
                                                courseMetrics.task_type_metrics?.learning_material?.count
                                                : null;

                                            const quizCompletion = courseMetrics.task_type_metrics?.quiz
                                                ? (courseMetrics.task_type_metrics?.quiz?.completions[studentId] || 0) /
                                                courseMetrics.task_type_metrics?.quiz?.count
                                                : null;

                                            const examCompletion = courseMetrics.task_type_metrics?.exam
                                                ? (courseMetrics.task_type_metrics?.exam?.completions[studentId] || 0) /
                                                courseMetrics.task_type_metrics?.exam?.count
                                                : null;

                                            const assignmentCompletion = courseMetrics.task_type_metrics?.assignment
                                                ? (courseMetrics.task_type_metrics?.assignment?.completions[studentId] || 0) /
                                                courseMetrics.task_type_metrics?.assignment?.count
                                                : null;

                                            // Helper function to get text color class based on completion percentage
                                            const getColorClass = (completion: number | null) => {
                                                if (completion === null) return 'text-gray-400';
                                                if (completion < 0.3) return 'text-red-400';
                                                if (completion < 0.7) return 'text-amber-400';
                                                return 'text-green-400';
                                            };

                                            return (
                                                <tr key={studentId} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-black/30">
                                                    <td className="p-4">
                                                        {formatLearnerName(member)}
                                                    </td>
                                                    {courseMetrics.task_type_metrics?.learning_material && (
                                                        <td className={`p-4 ${getColorClass(learningMaterialCompletion)}`}>
                                                            {learningMaterialCompletion !== null
                                                                ? `${Math.round(learningMaterialCompletion * 100)}%`
                                                                : '-'}
                                                        </td>
                                                    )}
                                                    {courseMetrics.task_type_metrics?.quiz && (
                                                        <td className={`p-4 ${getColorClass(quizCompletion)}`}>
                                                            {quizCompletion !== null
                                                                ? `${Math.round(quizCompletion * 100)}%`
                                                                : '-'}
                                                        </td>
                                                    )}
                                                    {courseMetrics.task_type_metrics?.assignment && (
                                                        <td className={`p-4 ${getColorClass(assignmentCompletion)}`}>
                                                            {assignmentCompletion !== null
                                                                ? `${Math.round(assignmentCompletion * 100)}%`
                                                                : '-'}
                                                        </td>
                                                    )}
                                                    {courseMetrics.task_type_metrics?.exam && (
                                                        <td className={`p-4 ${getColorClass(examCompletion)}`}>
                                                            {examCompletion !== null
                                                                ? `${Math.round(examCompletion * 100)}%`
                                                                : '-'}
                                                        </td>
                                                    )}
                                                    <td className="p-4 text-right">
                                                        <Link
                                                            href={`/school/${schoolSlug}/courses/${activeCourseId || cohort.courses?.[0]?.id}/learner-view/${studentId}?cohortId=${cohort.id}`}
                                                            target="_blank"
                                                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-sm text-gray-900 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white rounded-md transition-colors cursor-pointer"
                                                        >
                                                            View as learner
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
} 