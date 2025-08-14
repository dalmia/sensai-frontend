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
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
                className="w-full max-w-2xl bg-[#1A1A1A] rounded-lg shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Dialog Content */}
                <div className="p-6">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-light text-white mb-3">
                                Edit description
                            </h3>
                            <textarea
                                ref={textareaRef}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Enter description"
                                className="w-full px-4 py-3 bg-[#0D0D0D] text-white text-sm rounded-lg font-light placeholder-gray-500 outline-none border-none resize-none min-h-[120px] max-h-[300px] overflow-auto"
                                rows={10}
                            />
                        </div>
                    </div>
                </div>

                {/* Dialog Footer */}
                <div className="flex justify-end gap-4 p-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DescriptionEditModal;
