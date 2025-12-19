"use client";

import React, { useState, useEffect, useRef } from 'react';
import DripPublishingConfig, { DripPublishingConfigRef } from './DripPublishingConfig';
import { DripConfig } from '@/types/course';

interface CreateCohortDialogProps {
    open: boolean;
    onClose: () => void;
    onCreateCohort: (cohort: any, dripConfig?: DripConfig) => void;
    schoolId?: string;
    showDripPublishSettings?: boolean;
}

export default function CreateCohortDialog({ open, onClose, onCreateCohort, schoolId, showDripPublishSettings }: CreateCohortDialogProps) {
    const [cohortName, setCohortName] = useState('');
    const [dripConfig, setDripConfig] = useState<DripConfig | undefined>(undefined);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const dripConfigRef = useRef<DripPublishingConfigRef>(null);

    // Reset form state when dialog is opened
    useEffect(() => {
        if (open) {
            setCohortName('');
            setDripConfig(undefined);
            setError('');
            setIsLoading(false);
        }
    }, [open]);

    const handleSubmit = async () => {
        // Validate cohort name
        if (!cohortName.trim()) {
            setError('Cohort name is required');
            return;
        }

        // Validate drip config if enabled and showDripPublishSettings is true
        if (showDripPublishSettings && dripConfigRef.current) {
            const dripError = dripConfigRef.current.validateDripConfig();
            if (dripError) {
                return;
            }
        }

        // Set loading state to true
        setIsLoading(true);

        try {
            // Make API call to create cohort
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: cohortName,
                    org_id: schoolId ? parseInt(schoolId) : null
                }),
            });

            // Handle API errors
            if (!response.ok) {
                throw new Error(`Failed to create cohort: ${response.status} ${response.statusText}`);
            }

            // Get the new cohort data
            const newCohortData = await response.json();

            // Pass the created cohort back to the parent with drip config if applicable
            onCreateCohort(newCohortData, showDripPublishSettings ? dripConfig : undefined);

            // Reset form state
            setCohortName('');
            setDripConfig(undefined);
            setError('');

        } catch (error) {
            console.error('Error creating cohort:', error);
            setError('Failed to create cohort. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-lg shadow-2xl bg-white dark:bg-[#1A1A1A] text-black dark:text-white border border-gray-200 dark:border-transparent"
                onClick={e => e.stopPropagation()}
            >
                {/* Dialog Content */}
                <div className="p-6 mt-4">
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs mb-2 font-light text-gray-600 dark:text-gray-400">A cohort is a group of learners who will take your course together</p>
                            <input
                                id="cohortName"
                                type="text"
                                value={cohortName}
                                onChange={(e) => {
                                    setCohortName(e.target.value);
                                    if (error) setError('');
                                }}
                                placeholder="What will you name this cohort?"
                                className={`w-full px-4 py-3 text-lg rounded-lg font-light placeholder-gray-500 outline-none bg-white dark:bg-[#0D0D0D] text-black dark:text-white border ${error ? 'border-red-500' : 'border-gray-300 dark:border-transparent'}`}
                                disabled={isLoading}
                            />
                            {error && (
                                <p className="mt-1 text-sm text-red-500">{error}</p>
                            )}
                        </div>

                        {/* Conditionally render DripPublishingConfig */}
                        {showDripPublishSettings && (
                            <div>
                                <DripPublishingConfig
                                    ref={dripConfigRef}
                                    onConfigChange={setDripConfig}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Dialog Footer */}
                <div className="flex justify-end gap-4 p-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 transition-colors focus:outline-none cursor-pointer text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className={`px-6 py-2 text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer bg-purple-600 dark:bg-white text-white dark:text-black ${isLoading ? 'opacity-70' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 text-white dark:text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </span>
                        ) : 'Create cohort'}
                    </button>
                </div>
            </div>
        </div>
    );
} 
