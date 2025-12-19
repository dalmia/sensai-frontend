import { useRef, useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import Link from 'next/link';
import CreateCohortDialog from './CreateCohortDialog';
import DripPublishingConfig, { DripPublishingConfigRef } from './DripPublishingConfig';
import { DripConfig } from '@/types/course';

// Define interface for CourseCohortSelectionDialog props
interface CourseCohortSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    originButtonRef: React.RefObject<HTMLButtonElement | null>;
    isPublishing: boolean;
    onConfirm: () => void;
    showLoading: boolean;
    hasError: boolean;
    errorMessage: string;
    onRetry: () => void;
    cohorts: any[]; // Using any[] for consistency with existing cohorts state
    selectedCohort: any | null; // Changed from tempSelectedCohorts to single selection
    onSelectCohort: (cohort: any) => void;
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    searchQuery: string;
    filteredCohorts: any[];
    totalSchoolCohorts: number;
    schoolId: string;
    courseId?: string; // Add courseId for linking the new cohort
    onCohortCreated?: (cohort: any) => void; // Callback when a cohort is created and linked
    onOpenCreateCohortDialog: () => void; // New callback to open the CreateCohortDialog
    onAutoCreateAndPublish: () => void; // New callback for auto-creating cohort and publishing
    onDripConfigChange: (config: DripConfig | undefined) => void;
}

// Add CohortSelectionDialog component
export const CourseCohortSelectionDialog = ({
    isOpen,
    onClose,
    originButtonRef,
    isPublishing,
    onConfirm,
    showLoading,
    hasError,
    errorMessage,
    onRetry,
    cohorts,
    selectedCohort,
    onSelectCohort,
    onSearchChange,
    searchQuery,
    filteredCohorts,
    totalSchoolCohorts,
    schoolId,
    courseId,
    onCohortCreated,
    onOpenCreateCohortDialog,
    onAutoCreateAndPublish,
    onDripConfigChange,
}: CourseCohortSelectionDialogProps) => {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const dripConfigRef = useRef<DripPublishingConfigRef>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    
    // Calculate position when button or isOpen changes
    useEffect(() => {
        const updatePosition = () => {
            if (isOpen && originButtonRef.current && dropdownRef.current) {
                const buttonRect = originButtonRef.current.getBoundingClientRect();
                const windowWidth = window.innerWidth;

                // Position dropdown below button
                // Use viewport-relative position (since fixed positioning is relative to viewport)
                const top = buttonRect.bottom;

                // Calculate left position to avoid going off-screen
                // Default to aligning with left edge of button
                let left = buttonRect.left;

                // If dropdown would go off right edge, align with right edge of button instead
                const dropdownWidth = 400; // Width of dropdown from CSS
                if (left + dropdownWidth > windowWidth) {
                    left = buttonRect.right - dropdownWidth;
                }

                // Apply the new position directly to the DOM element for immediate effect
                setPosition({ top, left });
            }
        };

        // Initial position update
        updatePosition();

        // Add scroll and resize event listeners
        if (isOpen) {
            window.addEventListener('scroll', updatePosition, { passive: true });
            window.addEventListener('resize', updatePosition, { passive: true });
            // Add a more frequent position update for smoother following during scrolling
            const intervalId = setInterval(updatePosition, 16); // ~60fps

            return () => {
                window.removeEventListener('scroll', updatePosition);
                window.removeEventListener('resize', updatePosition);
                clearInterval(intervalId);
            };
        }

        return undefined;
    }, [isOpen, originButtonRef, dropdownRef]);

    // Handle clicks outside of the dropdown
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

    // Update the click handler to use the new callback
    const handleCreateCohortClick = (e: React.MouseEvent) => {
        e.preventDefault();
        onOpenCreateCohortDialog();
    };

    const handleConfirm = () => {
        // Validate drip config if publishing and drip config is enabled
        if (isPublishing && dripConfigRef.current) {
            const dripError = dripConfigRef.current.validateDripConfig();
            if (dripError) {
                return;
            }
        }

        onConfirm();
    };

    if (!isOpen) return null;

    const buttonText = isPublishing
        ? showLoading
            ? "Publishing..."
            : "Publish course to selected cohort"
        : showLoading
            ? "Adding..."
            : "Add course to selected cohort";

    return (
        <div
            ref={dropdownRef}
            className="fixed z-50 py-2 w-[400px] bg-white dark:bg-[#1A1A1A] rounded-lg shadow-xl border border-gray-200 dark:border-transparent"
            onClick={(e) => e.stopPropagation()}
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                position: 'fixed',
            }}
        >
            <div className="p-4 pb-2">
                {/* Add label at the top */}
                <h3 className="text-gray-900 dark:text-white text-sm font-light mb-3">Select the cohort of learners to share this course with</h3>

                {/* Only show search when not loading */}
                {!showLoading && (
                    <>
                        {/* Only show search when there are available cohorts */}
                        {!hasError && cohorts.length > 0 && (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search for a cohort"
                                    className="w-full bg-gray-100 dark:bg-[#111] rounded-md px-3 py-2 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                    value={searchQuery}
                                    onChange={onSearchChange}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {showLoading ? (
                <div className="flex justify-center items-center py-6">
                    <div className="w-8 h-8 border-2 border-t-green-500 border-r-green-500 border-b-transparent border-l-transparent rounded-full animate-spin" data-testid="loading-spinner"></div>
                </div>
            ) : hasError ? (
                <div className="p-4 text-center">
                    <p className="text-red-500 dark:text-red-400 mb-2">{errorMessage}</p>
                    <button
                        className="text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300 cursor-pointer"
                        onClick={onRetry}
                    >
                        Try again
                    </button>
                </div>
            ) : filteredCohorts.length === 0 ? (
                <div className="p-4 text-center">
                    {totalSchoolCohorts === 0 ? (
                        // School has no cohorts at all
                        <>
                            <h3 className="text-lg text-gray-900 dark:text-white font-light mb-1">No cohorts available</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Create cohorts in your school that you can publish courses to</p>
                            <button
                                onClick={handleCreateCohortClick}
                                className="mt-4 inline-block px-4 py-2 text-sm bg-gray-900 dark:bg-white text-white dark:text-black rounded-full hover:opacity-90 transition-opacity cursor-pointer"
                            >
                                Create cohort
                            </button>
                        </>
                    ) : totalSchoolCohorts > 0 && cohorts.length === 0 ? (
                        // All cohorts have been assigned to the course already
                        <>
                            <h3 className="text-lg text-gray-900 dark:text-white font-light mb-1">All cohorts assigned</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">All available cohorts are already assigned to this course</p>
                            <button
                                onClick={onAutoCreateAndPublish}
                                className="mt-4 inline-block px-4 py-2 text-sm bg-gray-900 dark:bg-white text-white dark:text-black rounded-full hover:opacity-90 transition-opacity cursor-pointer"
                            >
                                Make a new cohort
                            </button>
                        </>
                    ) : (
                        // Search returned no results
                        <>
                            <h3 className="text-lg text-gray-900 dark:text-white font-light mb-1">No matching cohorts</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Try a different search term</p>
                        </>
                    )}
                </div>
            ) : (
                <>
                    {/* Scrollable cohorts list - limited to height of ~4 cohorts */}
                    <div className="max-h-[10rem] overflow-y-auto py-2 px-4">
                        <div className="space-y-0.5">
                            {filteredCohorts.map(cohort => {
                                const isSelected = selectedCohort && selectedCohort.id === cohort.id;
                                return (
                                    <div
                                        key={cohort.id}
                                        className={`flex items-center px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#222] rounded-md cursor-pointer ${isSelected ? 'bg-gray-100 dark:bg-[#222]' : ''}`}
                                        onClick={() => onSelectCohort(isSelected ? null : cohort)}
                                    >
                                        {isSelected && (
                                            <div className="w-4 h-4 bg-green-600 rounded-sm flex items-center justify-center mr-2">
                                                <Check size={12} className="text-white" />
                                            </div>
                                        )}
                                        <p className="text-gray-900 dark:text-white text-sm font-light">{cohort.name}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Drip Publishing UI - Only show when publishing and a cohort is selected */}
                    {isPublishing && selectedCohort && (
                        <div className="px-4 py-2 space-y-2">
                            <DripPublishingConfig
                                ref={dripConfigRef}
                                onConfigChange={onDripConfigChange}
                            />
                        </div>
                    )}

                    {/* Buttons always visible at bottom */}
                    <div className="px-4 pb-4 space-y-2">
                        <button
                            className="w-full bg-[#016037] text-white py-3 rounded-full text-sm hover:bg-[#017045] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={handleConfirm}
                            disabled={showLoading || !selectedCohort}
                        >
                            {buttonText}
                        </button>
                        <button
                            className="w-full bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white py-3 rounded-full text-sm hover:bg-gray-100 dark:hover:bg-[#222] transition-colors cursor-pointer"
                            onClick={onAutoCreateAndPublish}
                            disabled={showLoading}
                        >
                            Make a new cohort
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};