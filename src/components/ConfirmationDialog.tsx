"use client";

import React from 'react';
import { X, Trash2 } from 'lucide-react';

interface ConfirmationDialogProps {
    // Core props (required)
    onConfirm: () => void;
    onCancel: () => void;
    onClickOutside?: () => void;
    // Visibility prop (with two possible names for backward compatibility)
    open?: boolean;
    show?: boolean;

    // Content props
    title?: string;
    message?: string;

    // Button text props
    confirmButtonText?: string;
    cancelButtonText?: string;

    // State props
    isLoading?: boolean;
    errorMessage?: string | null;

    // Type props for styling
    type?: 'publish' | 'delete' | 'custom' | 'save';

    // Custom content to be rendered between message and buttons
    children?: React.ReactNode;

    // Close button props
    showCloseButton?: boolean;
    onClose?: () => void;

    // Theme prop
    isDarkMode?: boolean;
}

export default function ConfirmationDialog({
    // Use either open or show prop for visibility
    open,
    show,

    // Content props with defaults
    title,
    message,

    // Action handlers
    onConfirm,
    onCancel,
    onClickOutside,
    // Button text with defaults
    confirmButtonText,
    cancelButtonText = "Cancel",

    // State props
    isLoading = false,
    errorMessage = null,

    // Type with default
    type = 'delete',

    // Custom content
    children,

    // Close button props
    showCloseButton = false,
    onClose,

    // Theme prop with default (dark mode by default for backward compatibility)
    isDarkMode = true
}: ConfirmationDialogProps) {
    // Handle both 'open' and 'show' props for backward compatibility
    const isVisible = open !== undefined ? open : (show !== undefined ? show : false);

    if (!isVisible) return null;

    // Default values based on type
    const defaultTitle = type === 'publish' ? "Ready to publish?"
        : type === 'save' ? "Save changes?"
            : "Confirm deletion";
    const defaultMessage = type === 'publish'
        ? "Make sure your content is complete and reviewed for errors before publishing"
        : type === 'save'
            ? "Do you want to save your changes?"
            : "Are you sure you want to delete? This action cannot be undone.";
    const defaultButtonText = type === 'publish' ? "Publish"
        : type === 'save' ? "Save"
            : "Delete";

    // Use provided values or defaults
    const displayTitle = title || defaultTitle;
    const displayMessage = message || defaultMessage;
    const buttonText = confirmButtonText || defaultButtonText;

    // Button styles based on type
    const buttonBgColor =
        type === 'publish' ? 'bg-green-800 hover:bg-green-900' :
            type === 'delete' ? 'bg-red-800 hover:bg-red-900' :
                type === 'save' ? 'bg-yellow-500 hover:bg-yellow-600' :
                    'bg-blue-600 hover:bg-blue-700'; // Default for custom type

    // Handle close button click
    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            onCancel();
        }
    };

    return (
        <div
            className={`fixed inset-0 backdrop-blur-sm z-[100] flex items-center justify-center p-4 ${isDarkMode ? 'bg-black/40' : 'bg-black/30'}`}
            onClick={(e) => {
                e.stopPropagation();
                onClickOutside ? onClickOutside() : onCancel();
            }}
        >
            <div
                className={`w-full max-w-md rounded-lg shadow-2xl relative ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {showCloseButton && (
                    <button
                        className={`absolute top-4 right-4 transition-colors focus:outline-none cursor-pointer ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClose();
                        }}
                    >
                        <X size={18} />
                    </button>
                )}
                <div className="p-6">
                    <h2 className={`text-xl font-light mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{displayTitle}</h2>
                    <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{displayMessage}</p>
                    {errorMessage && (
                        <p className="mt-4 text-red-400 text-sm">{errorMessage}</p>
                    )}

                    {/* Render custom content if provided */}
                    {children && (
                        <div className="mt-6">
                            {children}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-4 p-6">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancel();
                        }}
                        className={`px-4 py-2 transition-colors focus:outline-none cursor-pointer ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        disabled={isLoading}
                    >
                        {cancelButtonText}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onConfirm();
                        }}
                        className={`px-6 py-2 ${buttonBgColor} ${type === 'save' ? 'text-black' : 'text-white'} text-sm font-medium rounded-full transition-colors focus:outline-none cursor-pointer ${isLoading ? 'opacity-70' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                <span>{buttonText}</span>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                {type === 'delete' && <Trash2 size={16} className="mr-2" />}
                                {buttonText}
                            </div>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
} 