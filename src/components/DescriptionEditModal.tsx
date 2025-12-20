import React, { useRef, useEffect, useState } from 'react';

interface DescriptionEditModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (description: string) => void;
    currentDescription: string;
}

function DescriptionEditModal({ open, onClose, onSave, currentDescription }: DescriptionEditModalProps) {
    const [description, setDescription] = useState(currentDescription);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Reset description when modal opens
    useEffect(() => {
        if (open) {
            setDescription(currentDescription);
        }
    }, [open, currentDescription]);

    // Focus textarea when modal opens
    useEffect(() => {
        if (open && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [open]);

    const handleSave = () => {
        onSave(description);
        onClose();
    };

    if (!open) return null;

    return (
        <div 
            className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 bg-black/30 dark:bg-black/40"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-white dark:bg-[#1A1A1A] rounded-lg shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Dialog Content */}
                <div className="p-6">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-light text-gray-900 dark:text-white mb-3">
                                Edit description
                            </h3>
                            <textarea
                                ref={textareaRef}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Enter description"
                                className="w-full px-4 py-3 bg-gray-100 dark:bg-[#0D0D0D] text-gray-900 dark:text-white text-sm rounded-lg font-light placeholder-gray-400 dark:placeholder-gray-500 outline-none border border-gray-200 dark:border-transparent resize-none min-h-[120px] max-h-[300px] overflow-auto"
                                rows={10}
                            />
                        </div>
                    </div>
                </div>

                {/* Dialog Footer */}
                <div className="flex justify-end gap-4 p-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors focus:outline-none cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 dark:bg-white text-white dark:text-black text-sm font-medium rounded-full hover:bg-blue-700 dark:hover:bg-gray-100 transition-colors focus:outline-none cursor-pointer"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DescriptionEditModal;
