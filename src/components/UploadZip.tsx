"use client";

import { useRef, useState } from "react";
import { Upload, FileArchive } from "lucide-react";

interface UploadZipProps {
    disabled?: boolean;
    onComplete: (file: File) => void;
    className?: string;
}

export default function UploadZip({ disabled = false, onComplete, className = "" }: UploadZipProps) {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const openPicker = () => fileInputRef.current?.click();

    const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

    const maybeSelectZip = (file: File) => {
        if (disabled) return;
        const isZip = file.name.toLowerCase().endsWith(".zip");
        if (!isZip) return;
        if (file.size > MAX_SIZE_BYTES) return;
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
        if (file) maybeSelectZip(file);
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) maybeSelectZip(file);
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
                className={`rounded-xl border ${dragActive ? 'border-white border-solid' : 'border-[#333333] border-dashed'} bg-[#111111] text-white p-4`}
                onDragOver={disabled ? undefined : onDragOver}
                onDragLeave={disabled ? undefined : onDragLeave}
                onDrop={disabled ? undefined : onDrop}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-[#222222] flex items-center justify-center mr-3">
                            {selectedFile ? <FileArchive size={18} /> : <Upload size={18} />}
                        </div>
                        <div>
                            <div className="text-sm font-light">{selectedFile ? selectedFile.name : 'Upload your project ZIP'}</div>
                            <div className="text-xs text-gray-400">.zip up to 50MB</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input ref={fileInputRef} type="file" accept=".zip" onChange={onFileChange} className="hidden" disabled={disabled} />
                        <button
                            className="px-3 py-1.5 bg-white text-black rounded-full text-xs cursor-pointer"
                            onClick={openPicker}
                            type="button"
                            disabled={isUploading || disabled}
                        >
                            Choose file
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded-full text-xs ${selectedFile && !isUploading && !disabled ? 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer' : 'bg-[#333333] text-gray-400 cursor-not-allowed'}`}
                            onClick={simulateUpload}
                            type="button"
                            disabled={!selectedFile || isUploading || disabled}
                        >
                            Upload
                        </button>
                    </div>
                </div>

                {(isUploading || uploadProgress > 0) && (
                    <div className="mt-3">
                        <div className="h-2 bg-[#222222] rounded-full overflow-hidden">
                            <div className="h-full bg-white" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{isUploading ? 'Uploading…' : uploadProgress === 100 ? 'Uploaded' : 'Ready'}</div>
                    </div>
                )}
            </div>
        </div>
    );
}


