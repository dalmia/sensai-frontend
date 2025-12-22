"use client";

import React from 'react';
import { X, ExternalLink, Share } from 'lucide-react';
import Tooltip from './Tooltip';
import { DripConfig } from '@/types/course';


interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    courseName: string;
    dripConfig: DripConfig;
    schoolId: string;
    courseId: number | undefined;
    cohortId: number | undefined;
    onCopyCohortInviteLink?: (cohortId: number, cohortName: string) => void;
}

export default function SettingsDialog({ isOpen, onClose, courseName, dripConfig, schoolId, courseId, cohortId, onCopyCohortInviteLink }: SettingsDialogProps) {
    if (!isOpen) return null;

    const getFrequencyText = () => {
        const unit = dripConfig.frequency_unit.toLowerCase();
        const plural = dripConfig.frequency_value > 1 ? 's' : '';
        return `Every ${dripConfig.frequency_value} ${unit}${plural}`;
    };

    const formatDate = (date: Date) => {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-lg shadow-2xl relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Dialog Header */}
                <div className="flex justify-between items-center p-6 pb-2">
                    <h2 className="text-xl font-light text-black dark:text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors focus:outline-none cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Course/Cohort Info */}
                <div className="flex flex-col gap-2 px-6 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-black dark:text-white text-base font-light">{courseId ? 'Course' : 'Cohort'}</span>
                        <div className="flex items-center gap-2 ml-auto">
                            <Tooltip content="Open" position="top">
                                <button
                                    onClick={() => window.open(`/school/admin/${schoolId}/${courseId ? 'courses' : 'cohorts'}/${courseId || cohortId}`, '_blank')}
                                    className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white cursor-pointer flex items-center"
                                    aria-label="Open cohort page"
                                >
                                    <ExternalLink size={16} />
                                </button>
                            </Tooltip>
                            {cohortId && onCopyCohortInviteLink && (
                                <Tooltip content="Copy invite link" position="top">
                                    <button
                                        onClick={() => onCopyCohortInviteLink(cohortId, courseName)}
                                        className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white cursor-pointer flex items-center"
                                        aria-label="Copy cohort invite link"
                                    >
                                        <Share size={16} />
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                    <span className="text-black dark:text-white text-sm font-light">{courseName}</span>
                </div>

                {/* Release Schedule Section */}
                <div className="px-6 pb-6 pt-2">
                    <span className="text-black dark:text-white text-base font-light block mb-1">Course release schedule</span>
                    {dripConfig.is_drip_enabled ? (
                        <div className="space-y-1">
                            <span className="text-black dark:text-white text-sm font-light">{getFrequencyText()} </span>
                            <span className="text-black dark:text-white text-sm font-light">{`${dripConfig.publish_at ? `starting from ${formatDate(new Date(dripConfig.publish_at))}` : `after a learner joins the cohort`}`}</span>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <span className="text-black dark:text-white text-sm font-light">This course is not using a drip schedule. Learners can access all modules from the start.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}