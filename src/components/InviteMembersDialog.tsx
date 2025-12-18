"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Mail } from 'lucide-react';

interface InviteMembersDialogProps {
    open: boolean;
    onClose: () => void;
    onInvite: (emails: string[]) => void;
    isDarkMode?: boolean;
}

export default function InviteMembersDialog({ open, onClose, onInvite, isDarkMode }: InviteMembersDialogProps) {
    const [emailRows, setEmailRows] = useState<string[]>(['']);
    const [errors, setErrors] = useState<string[]>(['']);
    const [showErrors, setShowErrors] = useState(false);
    const [focusedInputIndex, setFocusedInputIndex] = useState<number | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [resolvedIsDarkMode, setResolvedIsDarkMode] = useState<boolean>(isDarkMode ?? true);

    // Reset state when dialog is opened
    useEffect(() => {
        if (open) {
            setEmailRows(['']);
            setErrors(['']);
            setShowErrors(false);
            setFocusedInputIndex(null);
            inputRefs.current = [null];
        }
    }, [open]);

    useEffect(() => {
        if (typeof isDarkMode === 'boolean') {
            setResolvedIsDarkMode(isDarkMode);
            return;
        }
        if (typeof window === 'undefined') return;
        const storedTheme = localStorage.getItem('theme');
        setResolvedIsDarkMode(storedTheme !== 'light');
    }, [isDarkMode]);

    // Update input refs array when number of rows changes
    useEffect(() => {
        inputRefs.current = inputRefs.current.slice(0, emailRows.length);
    }, [emailRows.length]);

    // Scroll to bottom and focus new input when new email is added
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
        // Focus the last input if it exists
        const lastInput = inputRefs.current[inputRefs.current.length - 1];
        if (lastInput && focusedInputIndex === emailRows.length - 1) {
            lastInput.focus();
        }
    }, [emailRows.length, focusedInputIndex]);

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validateEmail = (email: string): boolean => {
        return emailRegex.test(email);
    };

    const validateAllEmails = () => {
        return emailRows.map(email => {
            if (!email.trim()) return 'Email is required';
            if (!validateEmail(email)) return 'Please enter a valid email';
            return '';
        });
    };

    const handleEmailChange = (index: number, value: string) => {
        const newEmails = [...emailRows];
        newEmails[index] = value;
        setEmailRows(newEmails);

        // Update error for this specific email
        const newErrors = [...errors];
        if (!value.trim()) {
            newErrors[index] = 'Email is required';
        } else if (!validateEmail(value)) {
            newErrors[index] = 'Please enter a valid email';
        } else {
            newErrors[index] = '';
        }
        setErrors(newErrors);
    };

    const addEmailRow = () => {
        setEmailRows([...emailRows, '']);
        setErrors([...errors, '']);
        setFocusedInputIndex(emailRows.length);
        inputRefs.current = [...inputRefs.current, null];
    };

    const removeEmailRow = (index: number) => {
        const newEmails = emailRows.filter((_, i) => i !== index);
        const newErrors = errors.filter((_, i) => i !== index);
        setEmailRows(newEmails);
        setErrors(newErrors);
    };

    const handleSubmit = () => {
        // Validate all emails
        const newErrors = validateAllEmails();
        setErrors(newErrors);
        setShowErrors(true);

        // If there are any errors, don't proceed
        if (newErrors.some(error => error)) {
            return;
        }

        // Filter out any empty emails and submit
        const validEmails = emailRows.filter(email => email.trim() && validateEmail(email));
        onInvite(validEmails);
        onClose();
    };

    if (!open) return null;

    return (
        <>
            <style jsx global>{`
                .invite-members-email-input:focus,
                .invite-members-email-input:focus-visible {
                    outline: none !important;
                    box-shadow: none !important;
                    -webkit-box-shadow: none !important;
                }
            `}</style>
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className={`w-full max-w-lg rounded-lg shadow-2xl ${resolvedIsDarkMode ? 'bg-[#1A1A1A] text-white' : 'bg-white text-black border border-gray-200'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Dialog Content */}
                <div className="p-6 mt-4">
                    <div
                        ref={scrollContainerRef}
                        className={`max-h-[300px] overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-track-transparent ${resolvedIsDarkMode ? 'scrollbar-thumb-gray-800' : 'scrollbar-thumb-gray-300'}`}
                    >
                        {emailRows.map((email, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <div className="flex-1">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <Mail
                                                size={18}
                                                className={`transition-colors ${
                                                    focusedInputIndex === index
                                                        ? (resolvedIsDarkMode ? 'text-white' : 'text-black')
                                                        : 'text-gray-500'
                                                }`}
                                            />
                                        </div>
                                        <input
                                            ref={el => {
                                                inputRefs.current[index] = el;
                                            }}
                                            className={`invite-members-email-input w-full pl-10 pr-4 py-3 rounded-lg placeholder-gray-500 focus:outline-none ${
                                                resolvedIsDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-white text-black border border-gray-300'
                                            } ${errors[index] && focusedInputIndex !== index
                                                ? 'border-2 border-red-500'
                                                : focusedInputIndex === index
                                                    ? (resolvedIsDarkMode ? 'border border-white' : 'border border-black')
                                                    : (resolvedIsDarkMode ? 'border-0' : 'border border-gray-300')
                                            } appearance-none shadow-none focus:shadow-none focus-visible:shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none transition-all duration-0`}
                                            type="email"
                                            value={email}
                                            onChange={(e) => handleEmailChange(index, e.target.value)}
                                            onFocus={() => setFocusedInputIndex(index)}
                                            onBlur={() => setFocusedInputIndex(null)}
                                            placeholder="Enter email address"
                                        />
                                    </div>
                                    {errors[index] && showErrors && focusedInputIndex !== index && (
                                        <p className="text-red-500 text-sm mt-1">{errors[index]}</p>
                                    )}
                                </div>
                                {emailRows.length > 1 && (
                                    <button
                                        onClick={() => removeEmailRow(index)}
                                        className={`transition-colors p-2 cursor-pointer focus:outline-none self-start mt-1.5 ${resolvedIsDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'}`}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={addEmailRow}
                        className={`flex items-center gap-2 w-full py-3 px-4 rounded-lg transition-colors mt-2 cursor-pointer focus:outline-none ${
                            resolvedIsDarkMode ? 'text-gray-400 hover:text-white hover:bg-[#111]' : 'text-gray-600 hover:text-black hover:bg-gray-50'
                        }`}
                    >
                        <Plus size={20} />
                        <span>Add another email</span>
                    </button>
                </div>

                {/* Dialog Footer */}
                <div className="flex justify-end gap-4 px-6 py-4">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 transition-colors focus:outline-none cursor-pointer ${resolvedIsDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'}`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className={`px-6 py-2 text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer ${resolvedIsDarkMode ? 'bg-white text-black' : 'bg-purple-600 text-white'}`}
                    >
                        Invite
                    </button>
                </div>
            </div>
        </div>
        </>
    );
} 