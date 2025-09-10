"use client";

import Tooltip from "./Tooltip";
import { Info } from "lucide-react";

interface ButtonProps {
    onClick: (e?: React.MouseEvent) => void | Promise<void>;
    disabled?: boolean;
    isLoading?: boolean;
    loadingText: string;
    normalText: string;
    bgColor: string;
    textColor?: string;
    className?: string;
    icon?: React.ReactNode;
    tooltip?: boolean;
}

export default function ConnectNotionButton({
    onClick,
    disabled = false,
    isLoading = false,
    loadingText,
    normalText,
    bgColor,
    textColor = "text-white",
    className = "",
    icon,
    tooltip = false
}: ButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`px-3 py-2 ${bgColor} ${textColor} rounded-full font-light text-sm transition ${isLoading ? 'opacity-70' : ''} ${className} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {isLoading ? (
                <div className="flex items-center">
                    <div className={`w-4 h-4 border-2 ${textColor === 'text-black' ? 'border-black' : 'border-white'} border-t-transparent rounded-full animate-spin mr-2`}></div>
                    {loadingText}
                </div>
            ) : (
                <div className="flex items-center">
                    {icon && <span className="mr-2">{icon}</span>}
                    {normalText}
                    {tooltip && <Tooltip content="You can only add those Notion pages where you have full access. If you want to add a page that you don't have full access to, either request your Notion admin for full access or ask someone with full access to connect that notion page with this question. Once that page is connected, you will be able to view it here." position="bottom" tooltipWidth="400px" className="">
                        <Info className="w-4 h-4 text-black cursor-pointer ml-2" />
                    </Tooltip>}
                </div>
            )}
        </button>
    );
}
