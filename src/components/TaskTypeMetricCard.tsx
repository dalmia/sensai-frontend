import React from "react";

interface TaskTypeMetricCardProps {
    title: string;
    count: number;
    completionRate: number;
    color: "blue" | "purple" | "amber" | "teal" | "indigo";
}

export default function TaskTypeMetricCard({
    title,
    count,
    completionRate,
    color,
}: TaskTypeMetricCardProps) {
    // Map color to the appropriate Tailwind CSS classes
    const colorMap = {
        blue: {
            text: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-600 dark:bg-blue-500",
            border: "border-blue-900/30",
            overlay: "bg-blue-500/5",
            accent: "bg-blue-500/10",
        },
        purple: {
            text: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-600 dark:bg-purple-500",
            border: "border-purple-900/30",
            overlay: "bg-purple-500/5",
            accent: "bg-purple-500/10",
        },
        amber: {
            text: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-600 dark:bg-amber-500",
            border: "border-amber-900/30",
            overlay: "bg-amber-500/5",
            accent: "bg-amber-500/10",
        },
        teal: {
            text: "text-teal-600 dark:text-teal-400",
            bg: "bg-teal-600 dark:bg-teal-500",
            border: "border-teal-900/30",
            overlay: "bg-teal-500/5",
            accent: "bg-teal-500/10",
        },
        indigo: {
            text: "text-indigo-600 dark:text-indigo-400",
            bg: "bg-indigo-600 dark:bg-indigo-500",
            border: "border-indigo-900/30",
            overlay: "bg-indigo-500/5",
            accent: "bg-indigo-500/10",
        },
    };

    const completionPercentage = Math.round(completionRate * 100);

    return (
        <div className={`relative overflow-hidden rounded-xl border border-gray-200 dark:border-transparent bg-white dark:bg-gradient-to-br dark:from-[#111] dark:to-[#0c0c0c] hover:${colorMap[color].border} transition-colors group`}>
            <div className={`absolute inset-0 ${colorMap[color].overlay}`}></div>

            {/* Background completion indicator */}
            <div
                className={`absolute bottom-0 left-0 h-full ${colorMap[color].accent} transition-all duration-700`}
                style={{ width: `${completionPercentage}%` }}
            ></div>

            <div className="relative p-6 flex flex-col">
                <div className="flex flex-col gap-2 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-x-8 xl:gap-y-0 xl:mb-3">
                    {/* task count container with fixed height */}
                    <div className="flex flex-col justify-start min-w-0">
                        <div className={`text-lg xl:text-xl font-light ${colorMap[color].text} mb-1 whitespace-normal break-normal leading-snug`}>{title}</div>
                    </div>
                    <div className="text-2xl sm:text-3xl xl:text-4xl font-light text-gray-900 dark:text-white xl:text-right leading-none">
                        {completionPercentage}%
                    </div>
                </div>

                <div className="text-xs text-gray-600 dark:text-gray-500">{count} task{count === 1 ? '' : 's'}</div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-gray-200 dark:bg-gray-800/70 rounded-full overflow-hidden mt-2">
                    <div
                        className={`h-full ${colorMap[color].bg} rounded-full transition-all duration-700`}
                        style={{ width: `${completionPercentage}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
} 