import { ReactNode, useState, useEffect, useRef } from "react";

interface TooltipProps {
    children: ReactNode;
    content: string;
    position?: "top" | "bottom" | "left" | "right";
    delay?: number;
    disabled?: boolean;
    className?: string;
    tooltipWidth?: string;
}

export default function Tooltip({
    children,
    content,
    position = "top",
    delay = 300,
    disabled = false,
    className = "",
    tooltipWidth = "",
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const clearTimeouts = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    // Clear timeout on unmount
    useEffect(() => {
        return () => clearTimeouts();
    }, []);

    const showTip = () => {
        clearTimeouts(); // Clear any existing timeouts first
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const hideTip = () => {
        clearTimeouts(); // Clear the show timeout
        setIsVisible(false);
    };

    // Position-based classes for the tooltip
    const positionClasses = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };

    // Arrow classes based on position
    const arrowClasses = {
        top: "bottom-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent",
        bottom: "top-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent",
        left: "right-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent",
        right: "left-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent",
    };

    if (disabled) return children;
    const tooltipWidthClass = tooltipWidth ? `w-[${tooltipWidth}]` : "whitespace-nowrap";

    return (
        <div
            className={`relative inline-block cursor-pointer ${className}`}
            onMouseEnter={showTip}
            onMouseLeave={hideTip}
            onTouchStart={showTip}
            onTouchEnd={hideTip}
        >
            {children}

            {isVisible && (
                <div
                    className={`absolute px-3 py-2 text-sm font-light text-white bg-gray-900 rounded-md pointer-events-none ${positionClasses[position]} ${tooltipWidthClass}`}
                    role="tooltip"
                    aria-hidden={!isVisible}
                    style={{ zIndex: 9999 }}
                >
                    {content}
                    <div
                        className={`absolute w-0 h-0 border-4 border-gray-900 ${arrowClasses[position]}`}
                    />
                </div>
            )}
        </div>
    );
} 