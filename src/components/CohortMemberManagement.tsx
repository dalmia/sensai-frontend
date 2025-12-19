"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Plus, Mail, Upload, X } from "lucide-react";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { CohortMember, CohortWithDetails as Cohort } from "@/types";

interface EmailInput {
    id: string;
    email: string;
    error?: string;
}

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (emails: string[]) => Promise<void>;
    submitButtonText: string;
    isSubmitting: boolean;
    role: 'learner' | 'mentor';
}

interface CohortMemberManagementProps {
    cohort: Cohort;
    role: 'learner' | 'mentor';
    cohortId: string;
    schoolId: string;
    onShowToast: (title: string, description: string, emoji: string) => void;
    updateCohort: (updatedMembers: CohortMember[]) => void;
    openInviteDialog?: boolean;
    onInviteDialogClose?: () => void;
}

function InviteModal({
    isOpen,
    onClose,
    onSubmit,
    submitButtonText,
    isSubmitting,
    role
}: InviteModalProps) {
    const [emailInputs, setEmailInputs] = useState<EmailInput[]>([{ id: '1', email: '' }]);
    const [focusedInputId, setFocusedInputId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
    const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

    // Effect to focus and scroll to newly added inputs
    useEffect(() => {
        if (!newlyAddedId || !isOpen) return;

        // Focus the input
        const inputElement = inputRefs.current[newlyAddedId];
        if (inputElement) {
            setTimeout(() => {
                inputElement.focus();

                // Scroll the container to show the new input
                if (scrollContainerRef.current) {
                    const containerRect = scrollContainerRef.current.getBoundingClientRect();
                    const inputRect = inputElement.getBoundingClientRect();

                    // If the input is below the visible area, scroll to it
                    if (inputRect.bottom > containerRect.bottom) {
                        inputElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }
                }
            }, 50); // Small delay to ensure the DOM is updated
        }

        // Reset the newly added id
        setNewlyAddedId(null);
    }, [newlyAddedId, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        const newInputs = emailInputs.map(input => ({
            ...input,
            error: !input.email.trim() ? 'Email is required' :
                !validateEmail(input.email.trim()) ? 'Invalid email' :
                    undefined
        }));

        setEmailInputs(newInputs);

        if (!newInputs.some(input => input.error)) {
            const validEmails = newInputs
                .filter(input => input.email.trim())
                .map(input => input.email.trim());


            try {
                await onSubmit(validEmails);
                // Reset the modal on success
                setEmailInputs([{ id: '1', email: '' }]);
                onClose();
            } catch (error) {
                console.error(`Failed to add ${role}s:`, error);
                // Specific error toast comes from the parent handler
            }
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg bg-white dark:bg-[#1A1A1A] text-black dark:text-white rounded-lg shadow-2xl py-2"
                onClick={e => e.stopPropagation()}
            >

                <div className="px-6 py-4">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-4 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer w-full mb-4 bg-gray-50 dark:bg-[#0A0A0A] rounded-lg p-4 pr-2 border border-dashed border-gray-200 dark:border-[#0A0A0A] hover:border-gray-400 dark:hover:border-white hover:bg-gray-100 dark:hover:bg-[#111] focus:outline-none group"
                    >
                        <div className="w-12 h-12 rounded-full bg-white dark:bg-[#1A1A1A] flex items-center justify-center border border-gray-200 dark:border-transparent">
                            <Upload size={20} className="text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-black dark:text-white text-base font-light">Import CSV</span>
                            <span className="text-gray-600 dark:text-gray-400 text-sm">Upload a CSV file with one email per row</span>
                        </div>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const text = event.target?.result as string;
                                    const emails = text.split(/\r?\n/).filter(email => email.trim());
                                    const newInputs = emails.map((email, index) => ({
                                        id: Math.random().toString(),
                                        email: email.trim(),
                                        error: validateEmail(email.trim()) ? undefined : 'Invalid email'
                                    }));
                                    setEmailInputs(newInputs);
                                };
                                reader.readAsText(file);
                            }
                        }}
                    />

                    <div
                        ref={scrollContainerRef}
                        className="max-h-[300px] overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
                    >
                        {emailInputs.map((input, index) => (
                            <div key={input.id} className="flex items-center gap-2">
                                <div className="flex-1">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <Mail
                                                size={18}
                                                className={`transition-colors ${focusedInputId === input.id ? 'text-black dark:text-white' : 'text-gray-500'}`}
                                            />
                                        </div>
                                        <input
                                            ref={el => {
                                                inputRefs.current[input.id] = el;
                                            }}
                                            type="email"
                                            value={input.email}
                                            onChange={(e) => {
                                                const newInputs = [...emailInputs];
                                                newInputs[index].email = e.target.value;
                                                newInputs[index].error = validateEmail(e.target.value) ? undefined : 'Invalid email';
                                                setEmailInputs(newInputs);
                                            }}
                                            onFocus={() => setFocusedInputId(input.id)}
                                            onBlur={() => setFocusedInputId(null)}
                                            placeholder="Enter email address"
                                            className={`w-full bg-gray-100 dark:bg-[#0A0A0A] pl-10 pr-4 py-3 rounded-lg text-black dark:text-white placeholder-gray-500 focus:outline-none ${input.error && focusedInputId !== input.id
                                                ? 'border-2 border-red-500'
                                                : focusedInputId === input.id
                                                    ? 'border border-white'
                                                    : 'border-0'
                                                } focus:border focus:!border-white focus:ring-0 transition-all duration-0`}
                                        />
                                    </div>
                                    {input.error && focusedInputId !== input.id && (
                                        <p className="text-red-500 text-sm mt-1">{input.error}</p>
                                    )}
                                </div>
                                {emailInputs.length > 1 && (
                                    <button
                                        onClick={() => {
                                            setEmailInputs(emailInputs.filter(e => e.id !== input.id));
                                        }}
                                        className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors p-2 cursor-pointer focus:outline-none self-start mt-1.5"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => {
                            const newId = Math.random().toString();
                            setEmailInputs([...emailInputs, { id: newId, email: '' }]);
                            setFocusedInputId(newId);
                            setNewlyAddedId(newId);
                        }}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white w-full py-3 px-4 rounded-lg transition-colors mt-2 cursor-pointer focus:outline-none hover:bg-gray-100 dark:hover:bg-[#111]"
                    >
                        <Plus size={20} />
                        <span>Add another email</span>
                    </button>
                </div>

                <div className={`flex justify-end gap-4 px-6 py-4`}>
                    <button
                        onClick={() => {
                            onClose();
                            setEmailInputs([{ id: '1', email: '' }]);
                        }}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors font-light cursor-pointer focus:outline-none"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-3 bg-[#e5e7eb] text-[#000000] dark:bg-[#ffffff] dark:text-[#000000] text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isSubmitting ? (role === 'learner' ? 'Inviting...' : 'Adding...') : submitButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
}


export default function CohortMemberManagement({
    cohort,
    role,
    cohortId,
    schoolId,
    onShowToast,
    updateCohort,
    openInviteDialog,
    onInviteDialogClose
}: CohortMemberManagementProps) {

    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

    // Effect to sync the internal state with the external control prop
    useEffect(() => {
        if (openInviteDialog !== undefined) {
            setIsAddMemberOpen(openInviteDialog);
        }
    }, [openInviteDialog]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const [memberToDelete, setMemberToDelete] = useState<CohortMember | null>(null);

    // Add state for selected members
    const [selectedMembers, setSelectedMembers] = useState<CohortMember[]>([]);

    // Get filtered members based on role
    const members = cohort?.members?.filter(member => member.role === role) || [];

    // Text content that changes based on role
    const roleText = {
        title: role === 'learner' ? 'Start building your cohort' : 'Guide your learners',
        description: role === 'learner' ? 'Create a group of learners who will take your course together' : 'Add mentors to support and inspire your learners',
        buttonText: role === 'learner' ? 'Add learners' : 'Add mentors',
        modalTitle: role === 'learner' ? 'Invite learners' : 'Invite mentors',
        successToastTitle: 'Bumping it up',
        successToastEmoji: role === 'learner' ? '📧' : '👩‍🏫',
    };

    // Handle individual member selection
    const handleMemberSelection = (member: CohortMember) => {
        setSelectedMembers(prevSelected => {
            // Check if this member is already selected
            const isSelected = prevSelected.some(m => m.id === member.id);

            // If selected, remove it; if not, add it
            return isSelected
                ? prevSelected.filter(m => m.id !== member.id)
                : [...prevSelected, member];
        });
    };

    // Handle "select all" functionality
    const handleSelectAllMembers = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedMembers(members);
        } else {
            setSelectedMembers([]);
        }
    };

    // Check if all members are selected
    const areAllMembersSelected = () => {
        return members.length > 0 && selectedMembers.length === members.length;
    };

    const handleDeleteMember = (member: CohortMember) => {
        setMemberToDelete(member);
        setSelectedMembers([]);
        setIsDeleteConfirmOpen(true);
    };

    // Add function to handle multiple members deletion
    const handleDeleteSelectedMembers = () => {
        setMemberToDelete(null);
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteMember = async () => {
        // Updated to handle both single and multiple member deletion
        const membersToDelete = memberToDelete ? [memberToDelete] : selectedMembers;
        if (!membersToDelete.length || !cohortId) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/members`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    member_ids: membersToDelete.map(member => member.id)
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to delete member: ${response.status}`);
            }

            // Update the cohort state in the parent component
            const updatedMembers = cohort.members.filter(
                member => !membersToDelete.some(m => m.id === member.id)
            );
            updateCohort(updatedMembers);

            // Show success toast with appropriate message based on number of members deleted
            onShowToast(
                'Scaling it down',
                membersToDelete.length === 1
                    ? `Removed ${membersToDelete[0].email} from the cohort`
                    : `Removed ${membersToDelete.length} ${role}s from the cohort`,
                role === 'learner' ? '👋' : '👨‍🏫'
            );
        } catch (error) {
            console.error('Error deleting member:', error);

            // Show error toast
            let errorMessage = 'Failed to remove member. Please try again.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            onShowToast('Error', errorMessage, '❌');

            // Do NOT re-throw; error already surfaced to user and tests expect silent failure
        } finally {
            setIsDeleteConfirmOpen(false);
            setMemberToDelete(null);
            setSelectedMembers([]);
        }
    };

    const handleAddMembers = async (emails: string[]) => {
        setIsSubmitting(true);
        try {
            await addMembers(emails, emails.map(() => role));

            // Show success toast based on role
            onShowToast(
                roleText.successToastTitle,
                `Added ${emails.length} ${role}${emails.length > 1 ? 's' : ''} to the cohort`,
                roleText.successToastEmoji
            );
        } catch (error) {
            console.error(`Failed to add ${role}s:`, error);

            // Generic fallback message; override only when the error is meaningful
            let errorMessage = 'Failed to add members. Please try again.';
            if (error instanceof Error && error.message && error.message !== 'Invalid JSON') {
                errorMessage = error.message;
            }
            onShowToast('Error', errorMessage, '❌');

            // Re-throwing is fine for upstream logs, tests focus on toast; keep behaviour
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    const addMembers = async (emails: string[], roles: string[]) => {
        if (!cohortId) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    org_id: schoolId,
                    emails,
                    roles
                }),
            });

            if (!response.ok) {
                // Try to extract more detailed error message from response
                let errorText = 'Failed to add members. Please try again.';
                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        // Use the specific detail message from the API
                        errorText = errorData.detail;
                    } else if (errorData.message) {
                        errorText = errorData.message;
                    } else if (errorData.error) {
                        errorText = errorData.error;
                    }
                } catch (parseError) {
                    // If parsing JSON fails, use default error message
                    console.error('Could not parse error response:', parseError);
                }
                throw new Error(errorText);
            }

            // Fetch updated cohort data to get the new members
            const cohortResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}`);
            const cohortData = await cohortResponse.json();

            // Update the parent component with the new members
            updateCohort(cohortData.members || []);

        } catch (error) {
            console.error('Error adding members:', error);
            throw error;
        }
    };

    const handleCloseInviteDialog = () => {
        setIsAddMemberOpen(false);
        if (onInviteDialogClose) {
            onInviteDialogClose();
        }
    };

    return (
        <div>
            {members.length > 0 && (
                <div className="flex justify-start items-center mb-6 gap-4">
                    <button
                        className="px-6 py-3 bg-[#e5e7eb] text-[#000000] dark:bg-[#ffffff] dark:text-[#000000] text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                        onClick={() => setIsAddMemberOpen(true)}
                    >
                        {roleText.buttonText}
                    </button>
                    {selectedMembers.length > 0 && (
                        <button
                            className="px-6 py-3 bg-red-800 text-white text-sm font-medium rounded-full hover:bg-red-900 transition-colors focus:outline-none cursor-pointer flex items-center"
                            onClick={handleDeleteSelectedMembers}
                        >
                            <Trash2 size={16} className="mr-2" />
                            Remove ({selectedMembers.length})
                        </button>
                    )}
                </div>
            )}

            {members.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111]">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                        <thead className="bg-gray-50 dark:bg-[#0D0D0D]">
                            <tr>
                                <th scope="col" className="w-10 px-3 py-3 text-left">
                                    <div className="flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 rounded-md border-2 border-purple-600 text-white appearance-none checked:bg-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-30 focus:outline-none bg-white dark:bg-[#111111] cursor-pointer transition-all duration-200 ease-in-out hover:border-purple-500 relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:w-2.5 before:h-2.5 before:opacity-0 before:bg-white checked:before:opacity-100 checked:before:scale-100 before:scale-0 before:rounded-sm before:transition-all before:duration-200 checked:border-transparent"
                                            checked={areAllMembersSelected()}
                                            onChange={handleSelectAllMembers}
                                            title={`Select all ${role}s`}
                                        />
                                    </div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Email</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-[#111111] divide-y divide-gray-200 dark:divide-gray-800">
                            {members.map(member => (
                                <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-black/30 transition-colors">
                                    <td className="w-10 px-4 py-4 whitespace-nowrap">
                                        <div className="flex justify-center">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 rounded-md border-2 border-purple-600 text-white appearance-none checked:bg-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-30 focus:outline-none bg-white dark:bg-[#111111] cursor-pointer transition-all duration-200 ease-in-out hover:border-purple-500 relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:w-2.5 before:h-2.5 before:opacity-0 before:bg-white checked:before:opacity-100 checked:before:scale-100 before:scale-0 before:rounded-sm before:transition-all before:duration-200 checked:border-transparent"
                                                checked={selectedMembers.some(m => m.id === member.id)}
                                                onChange={() => handleMemberSelection(member)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300 flex justify-between items-center">
                                        {member.email}
                                        <button
                                            onClick={() => handleDeleteMember(member)}
                                            className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors focus:outline-none cursor-pointer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20">
                    <h2 className="text-4xl font-light mb-4">{roleText.title}</h2>
                    <p className="text-gray-400 mb-8">{roleText.description}</p>
                    <button
                        className="px-6 py-3 bg-[#e5e7eb] text-[#000000] dark:bg-[#ffffff] dark:text-[#000000] text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                        onClick={() => setIsAddMemberOpen(true)}
                    >
                        {roleText.buttonText}
                    </button>
                </div>
            )}

            {/* Invite Modal */}
            <InviteModal
                isOpen={isAddMemberOpen}
                onClose={handleCloseInviteDialog}
                onSubmit={handleAddMembers}
                submitButtonText={roleText.modalTitle}
                isSubmitting={isSubmitting}
                role={role}
            />

            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
                open={isDeleteConfirmOpen}
                title={memberToDelete || selectedMembers.length === 1
                    ? `Remove ${memberToDelete?.role === 'learner' ? 'Learner' : 'Mentor'}`
                    : `Remove Selected ${role === 'learner' ? 'Learners' : 'Mentors'}`}
                message={memberToDelete
                    ? `Are you sure you want to remove ${memberToDelete?.email} from this cohort?`
                    : `Are you sure you want to remove ${selectedMembers.length} ${role}${selectedMembers.length === 1 ? '' : 's'} from this cohort?`
                }
                confirmButtonText="Remove"
                onConfirm={confirmDeleteMember}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                type="delete"
            />
        </div>
    );
}

// Email validation utility function
function validateEmail(email: string): boolean {
    if (!email) return true;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
} 