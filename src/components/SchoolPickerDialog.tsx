"use client";

import React from 'react';
import { X } from 'lucide-react';

interface School {
    id: string;
    name: string;
    role?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    url?: string;
    slug?: string;
}

interface SchoolPickerDialogProps {
    open: boolean;
    onClose: () => void;
    schools: School[];
    onSelectSchool: (schoolId: string) => void;
    onCreateSchool: () => void;
}

export default function SchoolPickerDialog({
    open,
    onClose,
    schools,
    onSelectSchool,
    onCreateSchool,
}: SchoolPickerDialogProps) {
    if (!open) return null;

    // Check if user owns any schools
    const hasOwnedSchool = schools.some(school =>
        school.role === 'owner'
    );

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
                className="w-full max-w-md rounded-lg shadow-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-transparent"
                onClick={e => e.stopPropagation()}
            >
                {/* Dialog Header */}
                <div className="flex justify-between items-center p-6">
                    <h2 className="text-xl font-light text-black dark:text-white">Select a School</h2>
                    <button
                        onClick={onClose}
                        className="transition-colors focus:outline-none cursor-pointer text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Dialog Content */}
                <div className="p-6">
                    <div className="space-y-4">
                        {schools.map(school => (
                            <button
                                key={school.id}
                                onClick={() => onSelectSchool(school.id)}
                                className="w-full px-4 py-3 text-left rounded-lg transition-colors focus:outline-none cursor-pointer flex justify-between items-center bg-[#f3f4f6] dark:bg-[#111111] text-black dark:text-white hover:bg-[#e5e7eb] dark:hover:bg-[#2d3748]"
                            >
                                <span>{school.name}</span>
                                {(school.role === 'owner' || school.role === 'admin') && (
                                    <span className={`text-xs px-2 py-1 rounded-full text-white ${school.role === 'owner' ? 'bg-purple-700' : 'bg-blue-600'}`}>
                                        {school.role === 'owner' ? 'Owner' : 'Admin'}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dialog Footer */}
                {!hasOwnedSchool && (
                    <div className="flex justify-end gap-4 p-6">
                    <button
                        onClick={onCreateSchool}
                            className="px-6 py-2 text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer bg-black dark:bg-white text-white dark:text-black"
                    >
                        Create a School
                    </button>
                </div>
                )}
            </div>
        </div>
    );
} 
