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
    isDarkMode?: boolean;
}

export default function SchoolPickerDialog({
    open,
    onClose,
    schools,
    onSelectSchool,
    onCreateSchool,
    isDarkMode
}: SchoolPickerDialogProps) {
    if (!open) return null;

    // Check if user owns any schools
    const hasOwnedSchool = schools.some(school =>
        school.role === 'owner'
    );

    const [resolvedIsDarkMode, setResolvedIsDarkMode] = React.useState<boolean>(isDarkMode ?? true);
    React.useEffect(() => {
        if (typeof isDarkMode === 'boolean') {
            setResolvedIsDarkMode(isDarkMode);
            return;
        }
        if (typeof window === 'undefined') return;
        const storedTheme = window.localStorage.getItem('theme');
        setResolvedIsDarkMode(storedTheme !== 'light');
    }, [isDarkMode]);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
                className={`w-full max-w-md rounded-lg shadow-2xl ${resolvedIsDarkMode ? 'bg-[#1A1A1A]' : 'bg-white border border-gray-200'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Dialog Header */}
                <div className="flex justify-between items-center p-6">
                    <h2 className={`text-xl font-light ${resolvedIsDarkMode ? 'text-white' : 'text-black'}`}>Select a School</h2>
                    <button
                        onClick={onClose}
                        className={`transition-colors focus:outline-none cursor-pointer ${resolvedIsDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'}`}
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
                                className={`w-full px-4 py-3 text-left rounded-lg transition-colors focus:outline-none cursor-pointer flex justify-between items-center ${resolvedIsDarkMode ? 'bg-[#0D0D0D] text-white hover:bg-gray-800' : 'bg-gray-100 text-black hover:bg-gray-200'}`}
                            >
                                <span>{school.name}</span>
                                {(school.role === 'owner' || school.role === 'admin') && (
                                    <span className={`text-xs px-2 py-1 rounded-full text-white ${school.role === 'owner' ? 'bg-purple-700' : 'bg-blue-600'
                                        }`}>
                                        {school.role === 'owner' ? 'Owner' : 'Admin'}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dialog Footer */}
                {!hasOwnedSchool && (<div className="flex justify-end gap-4 p-6">
                    <button
                        onClick={onCreateSchool}
                        className={`px-6 py-2 text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer ${resolvedIsDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}
                    >
                        Create a School
                    </button>

                </div>
                )}
            </div>
        </div>
    );
} 