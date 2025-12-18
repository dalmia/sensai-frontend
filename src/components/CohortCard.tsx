import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "./ConfirmationDialog";

interface CohortCardProps {
    cohort: {
        id: number;
        name: string;
    };
    schoolId?: number | string;
    onDelete?: (cohortId: number) => void;
    isDarkMode?: boolean;
}

export default function CohortCard({ cohort, schoolId, onDelete, isDarkMode = true }: CohortCardProps) {
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Generate a unique border color based on the cohort id
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
        return colors[cohort.id % colors.length];
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        setIsDeleting(true);
        setDeleteError(null);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohort.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete cohort');
            }

            // Close the dialog after successful deletion
            setIsDeleteConfirmOpen(false);

            // Call the onDelete callback if provided
            if (onDelete) {
                onDelete(cohort.id);
            }

        } catch (error) {
            console.error('Error deleting cohort:', error);
            setDeleteError('An error occurred while deleting the cohort. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="group relative">
            <Link href={`/school/admin/${schoolId}/cohorts/${cohort.id}`} className="block h-full">
                <div className={`rounded-lg p-6 h-full transition-all hover:opacity-90 cursor-pointer border-b-2 ${getBorderColor()} border-opacity-70 ${isDarkMode ? 'bg-[#1A1A1A] text-gray-300' : 'bg-gray-100 text-gray-800'}`}>
                    <h2 className="text-xl font-light mb-2">{cohort.name}</h2>
                </div>
            </Link>
            <button
                className={`absolute top-3 right-3 p-2 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none cursor-pointer rounded-full ${isDarkMode ? 'text-gray-400 hover:text-red-500 hover:bg-gray-800' : 'text-gray-600 hover:text-red-600 hover:bg-gray-200'}`}
                aria-label="Delete cohort"
                onClick={handleDeleteClick}
            >
                <Trash2 size={18} />
            </button>

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                show={isDeleteConfirmOpen}
                title="Delete cohort"
                message={`Are you sure you want to delete this cohort? All learners will instantly lose access to any course assigned to this cohort, they will lose any progress they made and this action is irreversible`}
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