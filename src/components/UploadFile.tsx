"use client";

import { useRef, useState } from "react";
import { Upload, FileArchive } from "lucide-react";

interface UploadFileProps {
    disabled?: boolean;
    onComplete: (file: File) => void;
    className?: string;
    fileType?: string | string[];
    maxSizeBytes?: number;
    placeholderText?: string;
    isDarkMode?: boolean;
}

export default function UploadFile({
    disabled = false,
    onComplete,
    className = "",
    fileType = "",
    maxSizeBytes = 0,
    placeholderText = "",
    isDarkMode = true,
}: UploadFileProps) {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const openPicker = () => fileInputRef.current?.click();

    // Normalize fileType to array
    const fileTypes = Array.isArray(fileType) ? fileType : fileType ? [fileType] : [];

    // Check if file matches any of the accepted types
    const isValidFileType = (fileName: string): boolean => {
        if (fileTypes.length === 0) return true; // If no types specified, accept all
        const lowerFileName = fileName.toLowerCase();
        return fileTypes.some(type => lowerFileName.endsWith(type.toLowerCase()));
    };

    // Format file types for display
    const formatFileTypes = (): string => {
        if (fileTypes.length === 0) return '';
        if (fileTypes.length === 1) return fileTypes[0].toUpperCase();
        return fileTypes.map(type => type.toUpperCase()).join(' or ');
    };

    // Format file types for accept attribute (comma-separated)
    const formatAcceptAttribute = (): string => {
        return fileTypes.join(',');
    };

    const maybeSelectFile = (file: File) => {
        if (disabled) return;
        if (!isValidFileType(file.name)) return;
        if (file.size > maxSizeBytes) return;
        setSelectedFile(file);
        setUploadProgress(0);
    };

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (disabled) return;
        setDragActive(true);
    };

    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (disabled) return;
        setDragActive(false);
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (disabled) return;
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) maybeSelectFile(file);
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) maybeSelectFile(file);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && selectedFile && !isUploading && !disabled) {
            e.preventDefault();
            simulateUpload();
        }
    };

    const simulateUpload = async () => {
        if (!selectedFile || disabled) return;
        setIsUploading(true);

        let progress = 0;
        const interval = setInterval(() => {
            progress = Math.min(progress + Math.random() * 18, 95);
            setUploadProgress(Math.floor(progress));
        }, 180);

        setTimeout(() => {
            clearInterval(interval);
            setUploadProgress(100);
            setIsUploading(false);
            onComplete(selectedFile);
        }, 1600);
    };

    return (
        <div className={`p-1 ${className}`}>
            <div
                className={`rounded-xl border cursor-pointer p-4 transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${dragActive
                    ? (isDarkMode ? 'border-white border-solid' : 'border-black border-solid')
                    : (isDarkMode ? 'border-[#333333] border-dashed' : 'border-gray-300 border-dashed')
                    } ${isDarkMode ? 'bg-[#111111] text-white' : 'bg-gray-50 text-gray-900'}`}
                onDragOver={disabled ? undefined : onDragOver}
                onDragLeave={disabled ? undefined : onDragLeave}
                onDrop={disabled ? undefined : onDrop}
                onClick={disabled ? undefined : openPicker}
                onKeyDown={disabled ? undefined : onKeyDown}
                tabIndex={disabled ? -1 : 0}
            >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${isDarkMode ? 'bg-[#222222]' : 'bg-white border border-gray-200'}`}>
                            {selectedFile ? <FileArchive size={18} /> : <Upload size={18} />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-light truncate">{selectedFile ? selectedFile.name : placeholderText}</div>
                            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{formatFileTypes()} {maxSizeBytes > 0 ? `up to ${Math.round(maxSizeBytes / (1024 * 1024))}MB` : ''}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 justify-end">
                        <input ref={fileInputRef} type="file" accept={formatAcceptAttribute()} onChange={onFileChange} className="hidden" disabled={disabled} />
                        <button
                            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${isDarkMode ? 'bg-white text-black hover:opacity-90' : 'bg-black text-white hover:bg-gray-900'} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                openPicker();
                            }}
                            type="button"
                            disabled={isUploading || disabled}
                        >
                            Choose file
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${selectedFile && !isUploading && !disabled
                                ? 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer'
                                : (isDarkMode ? 'bg-[#333333] text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed')
                                }`}
                            onClick={(e) => {
                                e.stopPropagation();
                                simulateUpload();
                            }}
                            type="button"
                            disabled={!selectedFile || isUploading || disabled}
                        >
                            Upload
                        </button>
                    </div>
                </div>

                {(isUploading || uploadProgress > 0) && (
                    <div className="mt-3">
                        <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-[#222222]' : 'bg-gray-200'}`}>
                            <div className={`h-full rounded-full ${isDarkMode ? 'bg-white' : 'bg-black'}`} style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{isUploading ? 'Uploading…' : uploadProgress === 100 ? 'Uploaded' : 'Ready'}</div>
                    </div>
                )}
            </div>
        </div>
    );
}


