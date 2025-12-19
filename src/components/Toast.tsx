import React from 'react';
import { X } from 'lucide-react';

interface ToastProps {
    show: boolean;
    title: string;
    description: string;
    emoji: string;
    onClose: () => void;
    isMobileView?: boolean;
}

const Toast: React.FC<ToastProps> = ({
    show,
    title,
    description,
    emoji,
    onClose,
    isMobileView = false
}) => {
    if (!show) return null;

    return (
        <div className={`fixed ${isMobileView ? 'top-0 left-0 right-0 w-full rounded-none' : 'bottom-4 right-4 rounded-lg max-w-md'} bg-white text-black px-6 py-4 shadow-lg z-100 flex items-center gap-4`}>
            <div className="flex items-center justify-center w-10 h-10 bg-amber-50 rounded-full">
                <span className="text-xl">{emoji}</span>
            </div>
            <div className="flex-1">
                <h3 className="font-medium text-base">{title}</h3>
                <p className="text-sm text-gray-600 mt-0.5 leading-tight">{description}</p>
            </div>
            <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 cursor-pointer"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast; 