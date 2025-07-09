"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Building, ChevronDown, ChevronLeft, Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import CohortCard from "@/components/CohortCard";
import { useAuth } from "@/lib/auth";
import LearnerCohortView from "@/components/LearnerCohortView";
import { Module, ModuleItem } from "@/types/course";
import { getCompletionData, useSchools } from "@/lib/api";
import { Cohort, Task, Milestone, CohortWithDetails } from "@/types";
import { transformCourseToModules } from "@/lib/course";
import MobileDropdown, { DropdownOption } from "@/components/MobileDropdown";
import MentorCohortView from "@/components/MentorCohortView";
import MemberSchoolViewHeader from '@/components/MemberSchoolViewHeader';

interface School {
    id: number;
    name: string;
    slug: string;
}

interface Course {
    id: number;
    name: string;
    milestones?: Milestone[];
    course_generation_status?: string | null;
}

export default function ClientSchoolMemberView({ slug }: { slug: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    // Get course_id and cohort_id from query parameters
    const defaultCourseId = searchParams.get('course_id');
    const defaultCohortId = searchParams.get('cohort_id');

    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const { schools } = useSchools();
    const [school, setSchool] = useState<School | null>(null);
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [activeCohort, setActiveCohort] = useState<Cohort | null>(null);
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<Course[]>([]);
    const [activeCourseIndex, setActiveCourseIndex] = useState(0);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [courseError, setCourseError] = useState<string | null>(null);
    const [courseModules, setCourseModules] = useState<Module[]>([]);
    const [showCohortSelector, setShowCohortSelector] = useState<boolean>(false);
    const [isAdminOrOwner, setIsAdminOrOwner] = useState<boolean>(false);

    // Add state for completion data
    const [completedTaskIds, setCompletedTaskIds] = useState<Record<string, boolean>>({});
    const [completedQuestionIds, setCompletedQuestionIds] = useState<Record<string, Record<string, boolean>>>({});

    // Add after isAdminOrOwner state
    const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
    const [availableBatches, setAvailableBatches] = useState<{ id: number, name: string }[]>([]);
    const [showBatchSelector, setShowBatchSelector] = useState<boolean>(false);

    // Fetch school data
    useEffect(() => {
        const fetchSchool = async () => {
            // Don't fetch if auth is still loading or user is not authenticated
            if (authLoading || !isAuthenticated || !user?.id) {
                return;
            }

            setLoading(true);
            try {
                // Fetch basic school info using slug
                const schoolResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/slug/${slug}`);
                if (!schoolResponse.ok) {
                    throw new Error(`API error: ${schoolResponse.status}`);
                }
                const schoolData = await schoolResponse.json();

                // Transform the API response to match the School interface
                const transformedSchool: School = {
                    id: parseInt(schoolData.id),
                    name: schoolData.name,
                    slug: schoolData.slug
                };

                setSchool(transformedSchool);

                // Check if user is admin or owner of this school
                const isOwnerOrAdmin = schools?.some(s =>
                    parseInt(s.id) === transformedSchool.id &&
                    (s.role === 'owner' || s.role === 'admin')
                );

                setIsAdminOrOwner(Boolean(isOwnerOrAdmin));

                let cohortsData: any[];

                // If user is owner or admin, fetch all cohorts for the school
                if (isOwnerOrAdmin) {
                    const allCohortsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/?org_id=${transformedSchool.id}`);
                    if (!allCohortsResponse.ok) {
                        throw new Error(`API error: ${allCohortsResponse.status}`);
                    }
                    cohortsData = await allCohortsResponse.json();
                } else {
                    // Otherwise, fetch only the cohorts the user is a member of
                    const userCohortsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/${user.id}/org/${transformedSchool.id}/cohorts`);
                    if (!userCohortsResponse.ok) {
                        throw new Error(`API error: ${userCohortsResponse.status}`);
                    }
                    cohortsData = await userCohortsResponse.json();
                }

                // Transform cohorts data
                const transformedCohorts: Cohort[] = cohortsData.map((cohort: any) => ({
                    id: cohort.id,
                    name: cohort.name,
                    joined_at: cohort.joined_at,
                    role: cohort.role,
                    batches: cohort.batches || undefined // add batches if present
                }));

                setCohorts(transformedCohorts);

                // Set the active cohort based on query parameters if available
                if (transformedCohorts.length > 0) {
                    if (defaultCohortId) {
                        // Try to find the cohort that matches the cohort_id from query params
                        const cohortFromQuery = transformedCohorts.find(
                            cohort => cohort.id.toString() === defaultCohortId
                        );

                        if (cohortFromQuery) {
                            setActiveCohort(cohortFromQuery);
                        } else {
                            // If we can't find the cohort, default to the first one
                            setActiveCohort(transformedCohorts[0]);
                        }
                    } else {
                        // Default behavior - use the first cohort
                        setActiveCohort(transformedCohorts[0]);
                    }
                }

                setLoading(false);
            } catch (error) {
                console.error("Error fetching data:", error);
                setLoading(false);
            }
        };

        fetchSchool();
    }, [slug, router, user?.id, isAuthenticated, authLoading, schools, defaultCohortId]);

    // Add useEffect to update batch state when activeCohort changes
    useEffect(() => {
        if (activeCohort && (activeCohort as any).batches) {
            const batches = (activeCohort as any).batches;
            setAvailableBatches(batches);
            if (batches.length > 1) {
                setSelectedBatchId(batches[0].id);
            } else if (batches.length === 1) {
                setSelectedBatchId(batches[0].id);
            } else {
                setSelectedBatchId(null);
            }
        } else {
            setAvailableBatches([]);
            setSelectedBatchId(null);
        }
    }, [activeCohort]);

    // Function to fetch cohort courses
    const fetchCohortCourses = async (cohortId: number) => {
        if (!cohortId) return;

        setLoadingCourses(true);
        setCourseError(null);

        try {
            const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/courses?include_tree=true`;

            // Check if 'joined_at' exists, as older learners may not have this timestamp.
            const cohortUrl = activeCohort?.joined_at ? `${url}&joined_at=${activeCohort.joined_at}` : url;
            const response = await fetch(cohortUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch courses: ${response.status}`);
            }

            const coursesData: Course[] = await response.json();
            setCourses(coursesData);
            // Reset active course index when cohort changes
            setActiveCourseIndex(0);

            // Transform the first course's milestones to modules if available
            if (coursesData.length > 0) {
                const modules = transformCourseToModules(coursesData[0]);
                setCourseModules(modules);
            } else {
                setCourseModules([]);
            }

            setLoadingCourses(false);
        } catch (error) {
            console.error("Error fetching cohort courses:", error);
            setCourseError("Failed to load courses. Please try again.");
            setLoadingCourses(false);
        }
    };

    // Function to fetch completion data
    const fetchCompletionData = async (cohortId: number, userId: string) => {
        if (!cohortId || !userId) return;

        try {
            const { taskCompletions, questionCompletions } = await getCompletionData(cohortId, userId);

            // Update state with processed completion data
            setCompletedTaskIds(taskCompletions);
            setCompletedQuestionIds(questionCompletions);
        } catch (error) {
            console.error("Error fetching completion data:", error);
            // We don't set an error state as this is not critical functionality
            // Just log the error and continue
        }
    };

    // Fetch courses when active cohort changes
    useEffect(() => {
        if (activeCohort) {
            fetchCohortCourses(activeCohort.id);

            // Also fetch completion data when cohort changes
            if (user?.id) {
                fetchCompletionData(activeCohort.id, user.id.toString());
            }
        }
    }, [activeCohort, user?.id]);

    // Update to handle course selection from query params after courses are loaded
    useEffect(() => {
        if (courses.length > 0 && defaultCourseId) {
            // Find the index of the course that matches the course_id from query params
            const courseIndex = courses.findIndex(
                course => course.id.toString() === defaultCourseId
            );
            if (courseIndex !== -1 && courseIndex !== activeCourseIndex) {
                setActiveCourseIndex(courseIndex);
            }
        }
        // If no course_id param, reset to 0
        if (courses.length > 0 && !defaultCourseId && activeCourseIndex !== 0) {
            setActiveCourseIndex(0);
        }
    }, [courses, defaultCourseId]);

    // Handle course tab selection
    const handleCourseSelect = (index: number) => {
        if (index == activeCourseIndex) {
            return;
        }
        setActiveCourseIndex(index);
        const modules = transformCourseToModules(courses[index]);
        setCourseModules(modules);

        // Update URL with course ID
        if (courses[index]) {
            const courseId = courses[index].id.toString();
            const params = new URLSearchParams(window.location.search);

            params.set('course_id', courseId);

            // Replace current URL to avoid adding to browser history stack
            router.replace(`/school/${slug}?${params.toString()}`, { scroll: false });
        }
    };

    // Helper function to update URL query params
    const updateUrlWithCohortId = (cohortId: number) => {
        // Create the new URL with updated query parameters
        const params = new URLSearchParams();

        if (cohortId.toString() == params.get('cohort_id')) {
            return;
        }

        // Set cohort id in query params
        params.set('cohort_id', cohortId.toString());

        // will later set course id defaults in the query param after course cohorts have loaded
        params.delete('course_id');

        // Replace current URL to avoid adding to browser history stack
        router.replace(`/school/${slug}?${params.toString()}`, { scroll: false });
    };

    // Keep the original handleCohortSelect function for the Header component
    const handleCohortSelect = (cohort: Cohort) => {
        setActiveCohort(cohort);
        setShowCohortSelector(false);
        // Update URL with cohort ID
        updateUrlWithCohortId(cohort.id);
    };

    // Transform cohorts to dropdown options
    const cohortOptions: DropdownOption<Cohort>[] = cohorts.map(cohort => ({
        id: cohort.id,
        label: <span className="text-white font-light">{cohort.name}</span>,
        value: cohort
    }));

    // Handle cohort selection from dropdown
    const handleCohortOptionSelect = (option: DropdownOption<Cohort>) => {
        setActiveCohort(option.value);
        setShowCohortSelector(false);
        // Update URL with cohort ID
        updateUrlWithCohortId(option.value.id);
    };

    // Handle back button click
    const handleBackClick = () => {
        router.push('/');
    };

    // Show loading state while auth is loading
    if (authLoading) {
        return (
            <div className="min-h-screen bg-black text-white">
                <div className="hidden sm:block">
                    <Header showCreateCourseButton={false} />
                </div>
                <div className="flex justify-center items-center py-12">
                    <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated && !authLoading) {
        // Use client-side redirect
        router.push('/login');
        return null;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white">
                <div className="hidden sm:block">
                    <Header showCreateCourseButton={false} />
                </div>
                <div className="flex justify-center items-center py-12">
                    <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!school) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p>School not found</p>
            </div>
        );
    }

    return (
        <>
            {/* Admin/Owner Banner */}
            {isAdminOrOwner && (
                <div className="bg-[#111111] border-b border-gray-800 text-white py-3 px-4 text-center shadow-sm">
                    <p className="font-light text-sm">
                        You are viewing all the cohorts in this school because you are an admin. Learners only see the cohorts they are enrolled in.
                    </p>
                </div>
            )}

            <div className="hidden sm:block">
                <Header
                    showCreateCourseButton={false}
                    centerSlot={
                        <MemberSchoolViewHeader
                            cohorts={cohorts}
                            activeCohort={activeCohort}
                            onCohortSelect={handleCohortSelect}
                            batches={activeCohort?.role === 'mentor' && availableBatches.length > 1 ? availableBatches : []}
                            activeBatchId={activeCohort?.role === 'mentor' && availableBatches.length > 1 ? selectedBatchId : null}
                            onBatchSelect={activeCohort?.role === 'mentor' && availableBatches.length > 1 ? (batchId => setSelectedBatchId(batchId)) : undefined}
                        />
                    }
                />
            </div>
            <div className="min-h-screen bg-black text-white">
                <div className="container mx-auto">
                    <main>
                        {cohorts.length === 0 && (
                            <div className="pt-24 px-4">
                                <div className="flex flex-col items-center justify-center py-12 rounded-lg text-center">
                                    <h3 className="text-xl font-light mb-2">No cohorts available</h3>
                                    <p className="text-gray-400">You are not enrolled in any cohorts for this school</p>
                                </div>
                            </div>
                        )}

                        {cohorts.length > 0 && activeCohort && (
                            <>
                                {loadingCourses ? (
                                    <div className="flex justify-center items-center py-12">
                                        <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                                    </div>
                                ) : courseError ? (
                                    <div className="mt-12 text-center px-4">
                                        <p className="text-red-400 mb-4">{courseError}</p>
                                        <button
                                            onClick={() => {
                                                if (activeCohort) {
                                                    fetchCohortCourses(activeCohort.id);
                                                }
                                            }}
                                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full">
                                        {/* Mobile Cohort Banner - Always show on mobile */}
                                        {activeCohort && (
                                            <div className="sm:hidden w-full bg-gradient-to-r from-teal-800 via-emerald-700 to-cyan-800 p-4 border-b border-emerald-600 shadow-md">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center">
                                                        <button
                                                            onClick={handleBackClick}
                                                            className="mr-2 text-white hover:text-gray-200 transition-colors"
                                                        >
                                                            <ChevronLeft size={20} />
                                                        </button>
                                                        <h2 className="text-white font-light text-lg truncate mr-2">
                                                            {activeCohort.name}
                                                        </h2>
                                                    </div>
                                                    {cohorts.length > 1 && (
                                                        <button
                                                            className="bg-teal-900 bg-opacity-80 text-white font-light text-sm border border-cyan-600 rounded-full px-3 py-1 hover:bg-emerald-700 hover:bg-opacity-70 transition-all cursor-pointer"
                                                            onClick={() => setShowCohortSelector(true)}
                                                        >
                                                            Switch
                                                        </button>
                                                    )}
                                                    {activeCohort?.role === "mentor" && availableBatches && availableBatches.length > 1 && (
                                                        <>
                                                            <button
                                                                className="ml-2 bg-teal-900 bg-opacity-80 text-white font-light text-sm border border-cyan-600 rounded-full px-3 py-1 hover:bg-emerald-700 hover:bg-opacity-70 transition-all cursor-pointer"
                                                                onClick={() => setShowBatchSelector(true)}
                                                            >
                                                                {availableBatches.find(b => b.id === selectedBatchId)?.name || "Select Batch"}
                                                                <ChevronDown className="inline ml-1 w-4 h-4" />
                                                            </button>
                                                            <MobileDropdown
                                                                isOpen={showBatchSelector}
                                                                onClose={() => setShowBatchSelector(false)}
                                                                title="Switch Batch"
                                                                options={availableBatches.map(b => ({ id: b.id, label: <span className="text-white font-light">{b.name}</span>, value: b }))}
                                                                selectedId={selectedBatchId === null ? undefined : selectedBatchId}
                                                                onSelect={option => setSelectedBatchId(option.id as number)}
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Mobile Cohort Selector using MobileDropdown component */}
                                        <MobileDropdown
                                            isOpen={showCohortSelector}
                                            onClose={() => setShowCohortSelector(false)}
                                            title="Switch Cohort"
                                            options={cohortOptions}
                                            selectedId={activeCohort?.id}
                                            onSelect={handleCohortOptionSelect}
                                        />

                                        {courses.length === 0 ? (
                                            <div className="pt-12 text-center px-4">
                                                <h3 className="text-xl font-light mb-2">No courses available</h3>
                                                <p className="text-gray-400">There are no courses in this cohort yet</p>
                                            </div>
                                        ) : (
                                            // Course Content using LearnerCohortView or MentorCohortView
                                            <div className="w-full px-4 py-4 md:py-8">
                                                {courses.length > 0 && (
                                                    <div className="w-full">
                                                        {activeCohort?.role === "mentor" ? (
                                                            <MentorCohortView
                                                                cohort={{
                                                                    ...activeCohort,
                                                                    org_id: school.id,
                                                                    groups: (activeCohort as any).groups || [],
                                                                    courses: courses
                                                                } as CohortWithDetails}
                                                                activeCourseIndex={activeCourseIndex}
                                                                schoolId={school.id.toString()}
                                                                onActiveCourseChange={handleCourseSelect}
                                                                batchId={selectedBatchId}
                                                            />
                                                        ) : (
                                                            <LearnerCohortView
                                                                courseTitle={courses.length > 1 ? "" : courses[activeCourseIndex].name}
                                                                modules={courseModules}
                                                                schoolId={school.id.toString()}
                                                                cohortId={activeCohort?.id.toString()}
                                                                streakDays={2}
                                                                activeDays={["M", "T"]}
                                                                completedTaskIds={completedTaskIds}
                                                                completedQuestionIds={completedQuestionIds}
                                                                courses={courses}
                                                                onCourseSelect={handleCourseSelect}
                                                                activeCourseIndex={activeCourseIndex}
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </main>
                </div>
            </div>
        </>
    );
} 