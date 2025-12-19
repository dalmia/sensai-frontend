import { useState, useEffect, useRef } from "react";
import { BookOpen, X, Plus } from "lucide-react";
import Link from "next/link";
import { Course } from "@/types";
import DripPublishingConfig, { DripPublishingConfigRef } from "./DripPublishingConfig";
import { DripConfig } from "@/types/course";

interface CohortCoursesLinkerDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    availableCourses: Course[];
    totalSchoolCourses: number;
    isLoadingCourses: boolean;
    courseError: string | null;
    schoolId: string;
    cohortId: string;
    onCoursesLinked: (courses: Course[], dripConfig?: DripConfig) => void;
    onFetchAvailableCourses: () => void;
}

export default function CohortCoursesLinkerDropdown({
    isOpen,
    onClose,
    availableCourses,
    totalSchoolCourses,
    isLoadingCourses,
    courseError,
    schoolId,
    cohortId,
    onCoursesLinked,
    onFetchAvailableCourses
}: CohortCoursesLinkerDropdownProps) {
    const [tempSelectedCourses, setTempSelectedCourses] = useState<Course[]>([]);
    const [courseSearchQuery, setCourseSearchQuery] = useState('');
    const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const dripConfigRef = useRef<DripPublishingConfigRef>(null);

    const [dripConfig, setDripConfig] = useState<DripConfig | undefined>(undefined);

    // Initialize filtered courses when available courses change
    useEffect(() => {
        setFilteredCourses(availableCourses);
    }, [availableCourses]);

    // Reset temp selected courses when dropdown opens
    useEffect(() => {
        if (isOpen) {
            setTempSelectedCourses([]);
            setCourseSearchQuery('');
            setDripConfig(undefined);
        }
    }, [isOpen]);

    // Handle clicks outside the dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;

            if (dropdownRef.current &&
                !dropdownRef.current.contains(target) &&
                !(target as Element).closest('[data-dropdown-toggle="true"]')) {
                onClose();
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    const handleCourseSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setCourseSearchQuery(query);

        if (availableCourses.length > 0) {
            if (query.trim() === '') {
                // Show all available courses that aren't temporarily selected
                setFilteredCourses(availableCourses.filter(course =>
                    !tempSelectedCourses.some(tc => tc.id === course.id)
                ));
            } else {
                // Filter by name AND exclude temp selected courses
                const filtered = availableCourses.filter(course =>
                    course.name.toLowerCase().includes(query.toLowerCase()) &&
                    !tempSelectedCourses.some(tc => tc.id === course.id)
                );
                setFilteredCourses(filtered);
            }
        }
    };

    const selectCourse = (course: Course) => {
        // Check if already selected
        if (tempSelectedCourses.some(c => c.id === course.id)) {
            return; // Already selected, do nothing
        }

        // Add to temporary selection
        setTempSelectedCourses([...tempSelectedCourses, course]);

        // Remove from filtered courses immediately for better UX
        setFilteredCourses(prev => prev.filter(c => c.id !== course.id));
    };

    const removeTempCourse = (courseId: number, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        // Find the course to remove
        const courseToRemove = tempSelectedCourses.find(course => course.id === courseId);

        // Remove from temp selection
        setTempSelectedCourses(tempSelectedCourses.filter(course => course.id !== courseId));

        // Add back to filtered courses if it matches the current search
        if (courseToRemove &&
            (courseSearchQuery.trim() === '' ||
                courseToRemove.name.toLowerCase().includes(courseSearchQuery.toLowerCase()))) {
            setFilteredCourses(prev => [...prev, courseToRemove]);
        }
    };

    const handleAddSelectedCourses = async () => {
        // If no courses selected, just close the dropdown
        if (tempSelectedCourses.length === 0) {
            onClose();
            return;
        }

        // Validate drip config if enabled
        if (dripConfigRef.current) {
            const dripError = dripConfigRef.current.validateDripConfig();
            if (dripError) {
                return;
            }
        }

        onCoursesLinked(tempSelectedCourses, dripConfig);

        // Clear temporary selection and close dropdown
        setTempSelectedCourses([]);
        setDripConfig(undefined);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full right-0 mt-2 py-2 w-[400px] bg-white text-gray-900 border border-gray-200 dark:bg-[#1A1A1A] dark:text-white dark:border-0 rounded-lg shadow-xl z-50">
            <div className="p-4 pb-2">
                {/* Only show search when there are available courses */}
                {!(totalSchoolCourses === 0 || availableCourses.length === 0) && (
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search courses"
                            className="w-full bg-gray-100 border border-gray-200 rounded-md px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 dark:!bg-[#111] dark:border-0 dark:text-white dark:placeholder:text-gray-400 dark:focus:ring-0 dark:focus:border-0"
                            value={courseSearchQuery}
                            onChange={handleCourseSearch}
                        />
                    </div>
                )}

                {/* Show temporarily selected courses right below the search bar */}
                {tempSelectedCourses.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {tempSelectedCourses.map(course => (
                            <div
                                key={course.id}
                                className="flex items-center bg-gray-100 border border-gray-200 dark:!bg-[#222] dark:border-0 px-3 py-1 rounded-full"
                            >
                                <span className="text-gray-900 dark:text-white text-sm font-light mr-2">{course.name}</span>
                                <button
                                    onClick={(e) => removeTempCourse(course.id, e)}
                                    className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="max-h-96 overflow-y-auto py-2 px-2">
                {isLoadingCourses ? (
                    <div className="flex justify-center items-center py-6">
                        <div className="w-8 h-8 border-2 border-t-purple-500 border-r-purple-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    </div>
                ) : courseError ? (
                    <div className="p-4 text-center">
                        <p className="text-red-400 mb-2">{courseError}</p>
                        <button
                            className="text-purple-400 hover:text-purple-300 cursor-pointer"
                            onClick={onFetchAvailableCourses}
                        >
                            Try again
                        </button>
                    </div>
                ) : filteredCourses.length === 0 ? (
                    <div className="p-4 text-center">
                        {totalSchoolCourses === 0 ? (
                            // School has no courses at all
                            <>
                                <h3 className="text-lg font-light mb-1 text-gray-900 dark:text-white">No courses available</h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">Create courses in your school that you can publish to your cohort</p>
                                <Link
                                    href={`/school/admin/${schoolId}#courses`}
                                    className="mt-4 inline-block px-4 py-3 text-sm bg-white text-black rounded-full hover:opacity-90 transition-opacity"
                                >
                                    Open school
                                </Link>
                            </>
                        ) : availableCourses.length === 0 ? (
                            // All school courses are already in the cohort
                            <>
                                <h3 className="text-lg font-light mb-1 text-gray-900 dark:text-white">No courses left</h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">All courses from your school have been added to this cohort</p>
                                <Link
                                    href={`/school/admin/${schoolId}#courses`}
                                    className="mt-4 inline-block px-4 py-3 text-sm bg-white text-black rounded-full hover:opacity-90 transition-opacity cursor-pointer"
                                >
                                    Create more courses
                                </Link>
                            </>
                        ) : tempSelectedCourses.length > 0 ? (
                            // All available courses have been temporarily selected
                            <>
                                <h3 className="text-lg font-light mb-1 text-gray-900 dark:text-white">All courses selected</h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">You have selected all available courses</p>
                            </>
                        ) : (
                            // Search returned no results
                            <>
                                <h3 className="text-lg font-light mb-1 text-gray-900 dark:text-white">No matching courses</h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">Try a different search term</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="max-h-[10rem] overflow-y-auto py-2 px-2">
                        <div className="space-y-0.5">
                            {filteredCourses.map(course => (
                                <div
                                    key={course.id}
                                    className="flex items-center px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#222] rounded-md cursor-pointer"
                                    onClick={() => selectCourse(course)}
                                >
                                    <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-md flex items-center justify-center mr-2">
                                        <BookOpen size={14} className="text-purple-700 dark:text-white" />
                                    </div>
                                    <p className="text-gray-900 dark:text-white text-sm font-light">{course.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add button at the end of the list */}
                {(tempSelectedCourses.length > 0) && (
                    <DripPublishingConfig
                        ref={dripConfigRef}
                        onConfigChange={setDripConfig}
                    />
                )}
            </div>
            <div className="px-2 py-1">
                <button
                    data-testid="link-courses"
                    className="w-full bg-gray-100 text-black py-3 rounded-full text-sm hover:bg-gray-200 dark:!text-black dark:!bg-white hover:dark:!bg-gray-100 transition-colors cursor-pointer"
                    onClick={handleAddSelectedCourses}
                    disabled={isLoadingCourses}
                >
                    {isLoadingCourses ? "Linking..." : "Link courses with cohort"}
                </button>
            </div>
        </div>

    );
} 