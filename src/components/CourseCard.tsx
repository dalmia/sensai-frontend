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
}

export default function CourseCard({ course, onDelete }: CourseCardProps) {
    const params = useParams();
    const router = useRouter();
    const schoolId = params?.id;
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
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

        let idNumber: number;
        if (typeof course.id === 'string') {
            idNumber = Array.from(course.id).reduce(
                (hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0
            );
            idNumber = Math.abs(idNumber);
        } else {
            idNumber = course.id;
        }

        return colors[idNumber % colors.length];
    };

    // Determine the correct link path
    const getLinkPath = () => {
        if (course.role && course.role !== 'admin' && course.org?.slug) {
            return `/school/${course.org.slug}?course_id=${course.id}&cohort_id=${course.cohort_id}`;
        }
        else if (course.org_id) {
            return `/school/admin/${course.org_id}/courses/${course.id}`;
        }
        return `/school/admin/${schoolId}/courses/${course.id}`;
    };

    const isAdminView = schoolId;

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDeleteConfirmOpen(true);
    };

    const handleDuplicateClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

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
                router.push(`/school/admin/${schoolId}/courses/${newCourseData.id}`);
            } catch (error) {
                console.error('Error duplicating course:', error);
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

            setIsDeleteConfirmOpen(false);

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
                <div className={`rounded-lg p-6 h-full transition-all hover:opacity-90 cursor-pointer border-b-2 ${getBorderColor()} border-opacity-70 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300`}>
                    <h2 className="text-xl font-light mb-2">{course.title}</h2>
                </div>
            </Link>
            {isAdminView && (
                <div className="absolute top-3 right-3 flex gap-2">
                    {/* Duplicate Button */}
                    <Tooltip content="Duplicate course">
                        <button
                            className={`p-2 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none cursor-pointer rounded-full text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-800 ${isDuplicating ? 'opacity-100 cursor-not-allowed' : ''}`}
                            aria-label="Duplicate course"
                            onClick={handleDuplicateClick}
                            disabled={isDuplicating}
                        >
                            {isDuplicating ? (
                                <div className="w-4 h-4 border border-t-transparent rounded-full animate-spin border-gray-600 dark:border-gray-400"></div>
                            ) : (
                                <Copy size={18} />
                            )}
                        </button>
                    </Tooltip>

                    {/* Delete Button */}
                    <button
                        className="p-2 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none cursor-pointer rounded-full text-gray-600 dark:text-gray-400 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-800"
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
            />
        </div>
    );
} 
