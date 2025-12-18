import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trash2, Copy } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "./ConfirmationDialog";
import Tooltip from "./Tooltip";

interface CourseCardProps {
    course: {
        id: string | number;
        title: string;
        role?: string;
        org_id: number;
        cohort_id?: number;
        org?: {
            slug: string;
        };
    };
    onDelete?: (courseId: string | number) => void;
    isDarkMode?: boolean;
}

export default function CourseCard({ course, onDelete, isDarkMode = true }: CourseCardProps) {
    const params = useParams();
    const router = useRouter();
    const schoolId = params?.id;
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    // Add state for duplicate functionality
    const [isDuplicating, setIsDuplicating] = useState(false);

    // Generate a unique border color based on the course id
    const getBorderColor = () => {
        const colors = [
            'border-purple-500',
            'border-green-500',
            'border-pink-500',
            'border-yellow-500',
            'border-blue-500',
            'border-red-500',
            'border-indigo-500',
            'border-orange-500'
        ];

        // Handle string IDs by converting to a number
        let idNumber: number;
        if (typeof course.id === 'string') {
            // Use string hash code
            idNumber = Array.from(course.id).reduce(
                (hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0
            );
            // Ensure positive number
            idNumber = Math.abs(idNumber);
        } else {
            idNumber = course.id;
        }

        return colors[idNumber % colors.length];
    };

    // Determine the correct link path
    const getLinkPath = () => {
        // If this is being viewed by a learner, use the school slug path
        if (course.role && course.role !== 'admin' && course.org?.slug) {
            // Include course_id and cohort_id as query parameters to help with selection on the school page
            return `/school/${course.org.slug}?course_id=${course.id}&cohort_id=${course.cohort_id}`;
        }
        // If we have an org_id from the API, use that for the school-specific course path
        else if (course.org_id) {
            return `/school/admin/${course.org_id}/courses/${course.id}`;
        }
        // If we're in a school context, use the school-specific course path
        return `/school/admin/${schoolId}/courses/${course.id}`;
    };

    // Check if this is an admin view
    const isAdminView = schoolId;

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDeleteConfirmOpen(true);
    };

    const handleDuplicateClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Otherwise, handle internally
        if (!isDuplicating) {
            setIsDuplicating(true);

            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${course.id}/duplicate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        org_id: course.org_id,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to duplicate course');
                }

                const newCourseData = await response.json();

                // Navigate to the new course page
                router.push(`/school/admin/${schoolId}/courses/${newCourseData.id}`);
            } catch (error) {
                console.error('Error duplicating course:', error);
                // You could add a toast notification here if needed
            } finally {
                setIsDuplicating(false);
            }
        }
    };

    const handleDeleteConfirm = async () => {
        setIsDeleting(true);
        setDeleteError(null);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${course.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete course');
            }

            // Close the dialog after successful deletion
            setIsDeleteConfirmOpen(false);

            // Call the onDelete callback if provided
            if (onDelete) {
                onDelete(course.id);
            }

        } catch (error) {
            console.error('Error deleting course:', error);
            setDeleteError('An error occurred while deleting the course. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };


    return (
        <div className="group relative">
            <Link href={getLinkPath()} className="block h-full">
                <div className={`rounded-lg p-6 h-full transition-all hover:opacity-90 cursor-pointer border-b-2 ${getBorderColor()} border-opacity-70 ${isDarkMode ? 'bg-[#1A1A1A] text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                    <h2 className="text-xl font-light mb-2">{course.title}</h2>
                </div>
            </Link>
            {isAdminView && (
                <div className="absolute top-3 right-3 flex gap-2">
                    {/* Duplicate Button */}
                    <Tooltip content="Duplicate course">
                        <button
                            className={`p-2 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none cursor-pointer rounded-full ${isDarkMode ? 'text-gray-400 hover:text-blue-500 hover:bg-gray-800' : 'text-gray-600 hover:text-blue-500 hover:bg-gray-200'} ${isDuplicating ? 'opacity-100 cursor-not-allowed' : ''}`}
                            aria-label="Duplicate course"
                            onClick={handleDuplicateClick}
                            disabled={isDuplicating}
                        >
                            {isDuplicating ? (
                                <div className={`w-4 h-4 border border-t-transparent rounded-full animate-spin ${isDarkMode ? 'border-gray-400' : 'border-gray-600'}`}></div>
                            ) : (
                                <Copy size={18} />
                            )}
                        </button>
                    </Tooltip>

                    {/* Delete Button */}
                    <button
                        className={`p-2 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none cursor-pointer rounded-full ${isDarkMode ? 'text-gray-400 hover:text-red-500 hover:bg-gray-800' : 'text-gray-600 hover:text-red-500 hover:bg-gray-200'}`}
                        aria-label="Delete course"
                        onClick={handleDeleteClick}
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            )}

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                show={isDeleteConfirmOpen}
                title="Delete course"
                message={`Are you sure you want to delete this course? All the modules and tasks will be permanently deleted, any learner with access will lose all their progress and this action is irreversible`}
                confirmButtonText="Delete"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                type="delete"
                isLoading={isDeleting}
                errorMessage={deleteError}
                isDarkMode={isDarkMode}
            />
        </div>
    );
} 