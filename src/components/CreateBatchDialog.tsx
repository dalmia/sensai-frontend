"use client";

import { useState, useEffect, useRef } from "react";
import { X, Check, GraduationCap, School, Search, Pencil, Trash2 } from "lucide-react";
import { CohortMember } from "@/types";
import Tooltip from "@/components/Tooltip";

interface Batch {
    id: number;
    name: string;
    cohort_id: number;
    members: {
        id: number;
        email: string;
        role: string;
    }[];
}

interface CreateBatchDialogProps {
    isOpen: boolean;
    onClose: () => void;
    learners: CohortMember[];
    mentors: CohortMember[];
    onCreateBatch?: (batchName: string, selectedLearners: CohortMember[], selectedMentors: CohortMember[]) => void;
    cohortId: string;
    mode?: 'create' | 'view' | 'edit';
    batch?: Batch | null;
    inline?: boolean;
    onRequestDelete?: (batch: Batch) => void;
    onBatchUpdated?: (updatedBatch: Batch) => void;
}

export default function CreateBatchDialog({
    isOpen,
    onClose,
    learners,
    mentors,
    onCreateBatch,
    cohortId,
    mode = 'create',
    batch = null,
    inline = false,
    onRequestDelete,
    onBatchUpdated
}: CreateBatchDialogProps) {
    const [batchName, setBatchName] = useState("");
    const [selectedLearners, setSelectedLearners] = useState<CohortMember[]>([]);
    const [selectedMentors, setSelectedMentors] = useState<CohortMember[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [currentMode, setCurrentMode] = useState<'create' | 'view' | 'edit'>(mode);
    const [batchNameError, setBatchNameError] = useState(false);
    const [learnerSelectionError, setLearnerSelectionError] = useState(false);

    // Reset or initialize state based on mode and batch changes
    useEffect(() => {
        setCurrentMode(mode);
        if (mode === 'view' && batch) {
            setBatchName(batch.name);
            const batchLearners = batch.members.filter(m => m.role === 'learner');
            const batchMentors = batch.members.filter(m => m.role === 'mentor');
            setSelectedLearners(batchLearners as CohortMember[]);
            setSelectedMentors(batchMentors as CohortMember[]);
        }
    }, [mode, batch]);

    // Existing reset when dialog opens (create mode)
    useEffect(() => {
        if (isOpen && mode === 'create') {
            setBatchName("");
            setSelectedLearners([]);
            setSelectedMentors([]);
            setSearchQuery("");
            setIsCreating(false);
        }
    }, [isOpen, mode]);

    // Focus name input when dialog opens
    useEffect(() => {
        if (isOpen && nameInputRef.current) {
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Reset errors when entering edit mode or changing batch name/learners
    useEffect(() => {
        if (currentMode === 'edit') {
            setBatchNameError(false);
            setLearnerSelectionError(false);
        }
    }, [currentMode]);

    const isDialogVisible = inline || isOpen;

    if (!isDialogVisible) return null;

    const handleLearnerSelection = (learner: CohortMember) => {
        setSelectedLearners(prev => {
            const isSelected = prev.some(l => l.id === learner.id);
            return isSelected
                ? prev.filter(l => l.id !== learner.id)
                : [...prev, learner];
        });
    };

    const handleMentorSelection = (mentor: CohortMember) => {
        setSelectedMentors(prev => {
            const isSelected = prev.some(m => m.id === mentor.id);
            return isSelected
                ? prev.filter(m => m.id !== mentor.id)
                : [...prev, mentor];
        });
    };

    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (batchName.trim() && selectedLearners.length > 0) {
                handleCreate();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleCreate = async () => {
        if (!batchName.trim() || selectedLearners.length === 0 || isCreating) return;

        setIsCreating(true);
        try {
            const allSelectedMembers = [...selectedLearners, ...selectedMentors];
            const user_ids = allSelectedMembers.map(member => member.id);
            const roles = allSelectedMembers.map(member => member.role);

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/batches/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: batchName.trim(),
                    cohort_id: parseInt(cohortId),
                    user_ids,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to create batch: ${response.status}`);
            }

            const batchData = await response.json();

            // Call the parent handler with the created batch data
            onCreateBatch?.(batchName.trim(), selectedLearners, selectedMentors);

        } catch (error) {
            console.error("Error creating batch:", error);
            // You might want to show an error toast here
        } finally {
            setIsCreating(false);
        }
    };

    // Select all / deselect all handlers
    const handleSelectAllLearners = () => {
        if (selectedLearners.length === filteredLearners.length) {
            // If all are selected, deselect all
            setSelectedLearners([]);
        } else {
            // If not all are selected, select all
            setSelectedLearners(filteredLearners);
        }
    };

    const handleSelectAllMentors = () => {
        if (selectedMentors.length === filteredMentors.length) {
            // If all are selected, deselect all
            setSelectedMentors([]);
        } else {
            // If not all are selected, select all
            setSelectedMentors(filteredMentors);
        }
    };

    // Filter learners and mentors based on search query
    const filteredLearners = learners.filter(learner =>
        learner.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredMentors = mentors.filter(mentor =>
        mentor.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // If no mentors available, show learners in both columns
    const showLearnersInBothColumns = mentors.length === 0;

    // Reusable learner card component
    const LearnerCard = ({ learner }: { learner: CohortMember }) => (
        <button
            key={learner.id}
            onClick={() => handleLearnerSelection(learner)}
            className={`flex items-center space-x-3 p-4 rounded-lg transition-colors cursor-pointer ${selectedLearners.some(l => l.id === learner.id)
                ? 'bg-purple-600 text-white'
                : 'bg-[#f3f4f6] dark:bg-[#222] text-gray-700 dark:text-gray-300 hover:bg-[#e5e7eb] dark:hover:bg-[#333]'
                }`}
        >
            <div className="flex items-center space-x-3">
                <input
                    type="checkbox"
                    checked={selectedLearners.some(l => l.id === learner.id)}
                    onChange={() => handleLearnerSelection(learner)}
                    className="h-4 w-4 rounded border-2 border-gray-400 focus:ring-purple-500 focus:ring-2 cursor-pointer appearance-none checked:bg-purple-600 checked:border-transparent relative before:content-['✓'] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:text-white before:text-xs before:font-bold before:opacity-0 checked:before:opacity-100 before:transition-opacity before:duration-200"
                    onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm font-light">{learner.email}</span>
            </div>
        </button>
    );

    // Reusable mentor card component
    const MentorCard = ({ mentor }: { mentor: CohortMember }) => (
        <button
            key={mentor.id}
            onClick={() => handleMentorSelection(mentor)}
            className={`flex items-center space-x-3 p-4 rounded-lg transition-colors cursor-pointer ${selectedMentors.some(m => m.id === mentor.id)
                ? 'bg-blue-600 text-white'
                : 'bg-[#f3f4f6] dark:bg-[#222] text-gray-700 dark:text-gray-300 hover:bg-[#e5e7eb] dark:hover:bg-[#333]'
                }`}
        >
            <div className="flex items-center space-x-3">
                <input
                    type="checkbox"
                    checked={selectedMentors.some(m => m.id === mentor.id)}
                    onChange={() => handleMentorSelection(mentor)}
                    className="h-4 w-4 rounded border-2 border-gray-400 focus:ring-blue-500 focus:ring-2 cursor-pointer appearance-none checked:bg-blue-600 checked:border-transparent relative before:content-['✓'] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:text-white before:text-xs before:font-bold before:opacity-0 checked:before:opacity-100 before:transition-opacity before:duration-200"
                    onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm font-light">{mentor.email}</span>
            </div>
        </button>
    );

    // Reusable learner column component
    const LearnerColumn = ({ useGridLayout = false }: { useGridLayout?: boolean }) => (
        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            <div className="flex-shrink-0">
                <p className={`text-sm ${learnerSelectionError ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>Select learners to be added to the batch</p>
                {selectedLearners.length > 0 && (
                    <div className="flex items-center space-x-3 mt-2">
                        <Tooltip content={selectedLearners.length === filteredLearners.length ? "Deselect all" : "Select all"} position="right">
                            <input
                                type="checkbox"
                                checked={selectedLearners.length === filteredLearners.length}
                                onChange={handleSelectAllLearners}
                                className="h-4 w-4 rounded border-2 border-gray-400 focus:ring-purple-500 focus:ring-2 cursor-pointer appearance-none checked:bg-purple-600 checked:border-transparent relative before:content-['✓'] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:text-white before:text-xs before:font-bold before:opacity-0 checked:before:opacity-100 before:transition-opacity before:duration-200"
                            />
                        </Tooltip>
                        <span className="text-gray-600 dark:text-gray-400 text-sm leading-4">{selectedLearners.length} selected</span>
                    </div>
                )}
            </div>
            <div className={`gap-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent ${useGridLayout ? 'grid grid-cols-2' : 'grid grid-cols-1'}`} style={{ maxHeight: 'calc(100vh - 300px)' }}>
                {filteredLearners.map(learner => (
                    <LearnerCard key={learner.id} learner={learner} />
                ))}
            </div>
        </div>
    );

    // Reusable mentor column component
    const MentorColumn = () => (
        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            <div className="flex-shrink-0">
                <p className="text-gray-600 dark:text-gray-400 text-sm">Select mentors to guide the batch (optional)</p>
                {selectedMentors.length > 0 && (
                    <div className="flex items-center space-x-3 mt-2">
                        <Tooltip content={selectedMentors.length === filteredMentors.length ? "Deselect all" : "Select all"} position="right">
                            <input
                                type="checkbox"
                                checked={selectedMentors.length === filteredMentors.length}
                                onChange={handleSelectAllMentors}
                                className="h-4 w-4 rounded border-2 border-gray-400 focus:ring-blue-500 focus:ring-2 cursor-pointer appearance-none checked:bg-blue-600 checked:border-transparent relative before:content-['✓'] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:text-white before:text-xs before:font-bold before:opacity-0 checked:before:opacity-100 before:transition-opacity before:duration-200"
                            />
                        </Tooltip>
                        <span className="text-gray-600 dark:text-gray-400 text-sm leading-4">{selectedMentors.length} selected</span>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 gap-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                {filteredMentors.map(mentor => (
                    <MentorCard key={mentor.id} mentor={mentor} />
                ))}
            </div>
        </div>
    );

    // Helpers for editing
    const handleEnterEdit = () => setCurrentMode('edit');

    const resetSelectionFromBatch = () => {
        if (batch) {
            const batchLearners = batch.members.filter(m => m.role === 'learner');
            const batchMentors = batch.members.filter(m => m.role === 'mentor');
            setSelectedLearners(batchLearners as CohortMember[]);
            setSelectedMentors(batchMentors as CohortMember[]);
            setBatchName(batch.name);
        }
    };

    const handleCancelEdit = () => {
        resetSelectionFromBatch();
        setCurrentMode('view');
    };

    const hasChanges = () => {
        if (!batch) return false;
        if (batchName.trim() !== batch.name.trim()) return true;
        const origLearnerIds = batch.members.filter(m => m.role === 'learner').map(m => m.id).sort();
        const origMentorIds = batch.members.filter(m => m.role === 'mentor').map(m => m.id).sort();
        const newLearnerIds = selectedLearners.map(l => l.id).sort();
        const newMentorIds = selectedMentors.map(m => m.id).sort();
        return JSON.stringify(origLearnerIds) !== JSON.stringify(newLearnerIds) || JSON.stringify(origMentorIds) !== JSON.stringify(newMentorIds);
    };

    const saveDisabled = !hasChanges();

    // In edit mode, handle Save logic with validation
    const handleEditSave = async () => {
        let hasError = false;
        if (!batchName.trim()) {
            setBatchNameError(true);
            hasError = true;
        }
        if (selectedLearners.length === 0) {
            setLearnerSelectionError(true);
            hasError = true;
            setTimeout(() => setLearnerSelectionError(false), 3000);
        }
        if (hasError) return;

        if (!batch) return;

        const originalIds = batch.members.map(m => m.id);
        const newIds = [...selectedLearners, ...selectedMentors].map(m => m.id);
        const members_added = newIds.filter(id => !originalIds.includes(id));
        const members_removed = originalIds.filter(id => !newIds.includes(id));

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/batches/${batch.id}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: batchName.trim(),
                        members_added,
                        members_removed
                    })
                }
            );
            if (!response.ok) {
                throw new Error(`Failed to update batch: ${response.status}`);
            }
            // Try to get updated batch from API, else construct locally
            let updatedBatch: Batch = batch;
            try {
                updatedBatch = await response.json();
            } catch {
                // If API doesn't return updated batch, update locally
                updatedBatch = {
                    ...batch,
                    name: batchName.trim(),
                    members: [...selectedLearners, ...selectedMentors]
                };
            }
            if (typeof onBatchUpdated === 'function') {
                onBatchUpdated(updatedBatch);
            }
            setCurrentMode('view');
        } catch (error) {
            console.error('Error updating batch:', error);
        }
    };

    // ---------------- Render Helpers ----------------
    const renderHeader = () => {
        if (currentMode === 'view') {
            return (
                <div className="flex items-center justify-between px-6 py-4">
                    <h2 className="text-lg font-light truncate pr-4" title={batchName}>{batchName}</h2>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={handleEnterEdit}
                            className="flex items-center space-x-2 px-4 py-2 bg-[#e5e7eb] text-[#000000] dark:bg-[#ffffff] dark:text-[#000000] text-sm font-medium rounded-full hover:opacity-90 transition-opacity cursor-pointer"
                        >
                            <Pencil size={16} />
                            <span>Edit</span>
                        </button>
                        {onRequestDelete && batch && (
                            <button
                                onClick={() => onRequestDelete(batch)}
                                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-full hover:bg-red-700 transition-colors cursor-pointer"
                            >
                                <Trash2 size={16} />
                                <span>Delete</span>
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        if (currentMode === 'edit') {
            return (
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex-1 mr-2">
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={batchName}
                            onChange={(e) => {
                                setBatchName(e.target.value);
                                if (batchNameError && e.target.value.trim()) setBatchNameError(false);
                            }}
                            placeholder="Enter batch name"
                            className={`text-lg font-light bg-transparent outline-none text-black dark:text-white w-full placeholder-gray-500 border ${batchNameError ? 'border-red-500' : 'border-none'}`}
                        />
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={handleEditSave}
                            disabled={saveDisabled}
                            className="flex items-center space-x-2 px-4 py-2 bg-[#e5e7eb] text-[#000000] dark:bg-[#ffffff] dark:text-[#000000] text-sm font-medium rounded-full hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Check size={16} />
                            <span>Save</span>
                        </button>
                        <button
                            onClick={handleCancelEdit}
                            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-[#333] text-gray-900 dark:text-white text-sm font-medium rounded-full hover:bg-gray-200 dark:hover:bg-[#444] transition-colors cursor-pointer"
                        >
                            <X size={16} />
                            <span>Cancel</span>
                        </button>
                    </div>
                </div>
            );
        }

        // Create mode header (default existing)
        return (
            <div className="flex items-center justify-between px-6 py-4">
                <div className="flex-1">
                    <input
                        ref={nameInputRef}
                        type="text"
                        value={batchName}
                        onChange={(e) => setBatchName(e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        placeholder="Enter batch name"
                        className="text-lg font-light bg-transparent border-none outline-none text-black dark:text-white w-full placeholder-gray-500 h-12"
                    />
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={handleCreate}
                        disabled={selectedLearners.length === 0 || !batchName.trim() || isCreating}
                        className="flex items-center space-x-2 px-6 py-3 bg-[#e5e7eb] text-[#000000] dark:bg-[#ffffff] dark:text-[#000000] text-sm font-medium rounded-full hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check size={16} />
                        <span>{isCreating ? 'Creating...' : 'Create'}</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center w-10 h-10 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>
        );
    };

    const renderCreateEditContent = () => (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {learners.length === 0 ? (
                /* Show placeholder when no learners */
                <div className="flex flex-col items-center justify-center py-20 flex-1">
                    <h2 className="text-4xl font-light mb-4">No learners found</h2>
                    <p className="text-gray-400 mb-8">Add learners to this cohort first before creating a batch</p>
                </div>
            ) : (
                <>
                    {/* Single search bar for both layouts */}
                    <div className="px-6 pb-4 flex-shrink-0">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <Search size={16} className="text-gray-500" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by email"
                                className="w-full pl-10 px-4 py-2 bg-gray-100 text-black dark:!bg-[#0D0D0D] dark:text-white text-lg rounded-lg font-light placeholder-gray-500 outline-none border border-gray-200 dark:border-none"
                            />
                        </div>
                    </div>

                    {/* Content area using reusable components */}
                    <div className="flex-1 flex px-6 pb-6 min-h-0 overflow-hidden">
                        {showLearnersInBothColumns ? (
                            /* Show learners in grid layout when no mentors */
                            <LearnerColumn useGridLayout={true} />
                        ) : (
                            /* Normal two-column layout */
                            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
                                <LearnerColumn useGridLayout={false} />
                                <MentorColumn />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );

    const renderViewContent = () => {
        if (selectedLearners.length === 0) {
            return (
                <div className="flex flex-1 justify-center mt-20">
                    <div className="text-center">
                        <h2 className="text-lg font-light mb-2">No learners in this batch</h2>
                    </div>
                </div>
            );
        }
        // If no mentors, show learners in grid (2 columns)
        if (selectedMentors.length === 0) {
            return (
                <div className="flex-1 flex flex-col px-6 pb-6 overflow-hidden min-h-0">
                    <h3 className="text-gray-400 text-sm mb-4 flex-shrink-0">
                        {selectedLearners.length} {selectedLearners.length === 1 ? "learner" : "learners"}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                        {selectedLearners.map(learner => (
                            <div key={learner.id} className="p-4 rounded-lg bg-purple-600 text-white text-sm truncate">
                                {learner.email}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        // Normal two-column layout
        return (
            <div className="flex-1 grid grid-cols-2 gap-6 px-6 pb-6 overflow-hidden min-h-0">
                <div className="space-y-4 flex-1 min-h-0 flex flex-col">
                    <h3 className="text-gray-400 text-sm flex-shrink-0">
                        {selectedLearners.length} {selectedLearners.length === 1 ? "learner" : "learners"}
                    </h3>
                    <div className="space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pr-2" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                        {selectedLearners.map(learner => (
                            <div key={learner.id} className="p-4 rounded-lg bg-purple-600 text-white text-sm truncate">
                                {learner.email}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-4 flex-1 min-h-0 flex flex-col">
                    <h3 className="text-gray-400 text-sm flex-shrink-0">
                        {selectedMentors.length} {selectedMentors.length === 1 ? "mentor" : "mentors"}
                    </h3>
                    <div className="space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pr-2" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                        {selectedMentors.map(mentor => (
                            <div key={mentor.id} className="p-4 rounded-lg bg-blue-600 text-white text-sm truncate">
                                {mentor.email}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => (currentMode === 'view' ? renderViewContent() : renderCreateEditContent());

    // ---------------- Main Render ----------------
    if (inline) {
        return (
            <div className={`w-full h-full text-black dark:text-white flex flex-col rounded-lg min-h-0 bg-white dark:bg-transparent ${currentMode == 'edit' ? 'dark:bg-[#1A1A1A]' : ''}`}>
                {renderHeader()}
                {renderContent()}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="w-2/3 h-3/4 bg-white dark:bg-[#1A1A1A] text-black dark:text-white flex flex-col rounded-lg min-h-0">
                {renderHeader()}
                {renderContent()}
            </div>
        </div>
    );
} 