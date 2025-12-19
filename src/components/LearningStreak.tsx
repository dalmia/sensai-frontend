import React, { useMemo } from "react";

interface LearningStreakProps {
    streakDays: number;
    activeDays: string[]; // Days that are active in the streak (e.g., ['M', 'T', 'S_0', 'S_6'])
}

export default function LearningStreak({ streakDays, activeDays }: LearningStreakProps) {
    // Get current day in IST
    const getCurrentDayInIST = useMemo(() => {
        // Create a date in IST (UTC+5:30)
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
        const istDate = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
        return istDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    }, []);

    // All days of week for reference
    const allDaysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];
    const allDayIdentifiers = ["S_0", "M", "T", "W", "T", "F", "S_6"];

    // Reorder days to put current day in the middle (4th position)
    const { daysOfWeek, dayToIdentifierMap } = useMemo(() => {
        const currentDayIndex = getCurrentDayInIST;

        // Calculate days before and after to create a balanced view with current day in center
        const reorderedDays = [];
        const reorderedIdentifiers = [];

        // Add 3 days before the current day
        for (let i = 3; i > 0; i--) {
            const index = (currentDayIndex - i + 7) % 7;
            reorderedDays.push(allDaysOfWeek[index]);
            reorderedIdentifiers.push(allDayIdentifiers[index]);
        }

        // Add current day
        reorderedDays.push(allDaysOfWeek[currentDayIndex]);
        reorderedIdentifiers.push(allDayIdentifiers[currentDayIndex]);

        // Add 3 days after the current day
        for (let i = 1; i <= 3; i++) {
            const index = (currentDayIndex + i) % 7;
            reorderedDays.push(allDaysOfWeek[index]);
            reorderedIdentifiers.push(allDayIdentifiers[index]);
        }

        return {
            daysOfWeek: reorderedDays,
            dayToIdentifierMap: reorderedIdentifiers
        };
    }, [getCurrentDayInIST]);

    // List of energizing emojis
    const energizing_emojis = [
        "🚀", "💪", "🔥", "⚡", "🌟", "🏆", "💯", "🎉", "👏", "🌈", "💥", "🎯", "🏅", "✨"
    ];

    // Generate a random emoji from the list if streak is at least 1 day
    const randomEmoji = useMemo(() => {
        if (streakDays >= 1) {
            const randomIndex = Math.floor(Math.random() * energizing_emojis.length);
            return energizing_emojis[randomIndex];
        }
        return null;
    }, [streakDays]);

    // Function to check if a day is active based on index
    const isDayActive = (index: number): boolean => {
        // If the day is in the future (after the current day at index 3), it should never be active
        if (index > 3) {
            return false;
        }

        // Get the identifier for this position
        const identifier = dayToIdentifierMap[index];
        return activeDays.includes(identifier);
    };

    return (
        <div className="rounded-lg border overflow-hidden bg-white border-gray-300 dark:bg-[#121212] dark:border-gray-800">
            <div className="px-4 py-3 border-b bg-[#F6C16E] border-[#D39228] dark:bg-[#2A2000] dark:border-gray-800">
                <h3 className="text-lg font-light text-black dark:text-white">Learning Streak</h3>
            </div>

            <div className="p-4">
                <div className="text-3xl font-light mb-4 flex items-center text-black dark:text-white">
                    {streakDays} Day{streakDays === 1 ? "" : "s"}
                    {randomEmoji && <span className="ml-2" role="img" aria-label="Energizing emoji">{randomEmoji}</span>}
                </div>

                <div className="flex justify-between w-full">
                    {daysOfWeek.map((day, index) => (
                        <div
                            key={index}
                            className={`
                                flex-1 h-8 flex items-center justify-center rounded mx-1.5
                                ${isDayActive(index)
                                    ? "bg-[#F9B84E] text-black font-light"
                                    : "bg-gray-200 text-gray-600 font-light dark:bg-gray-800 dark:text-gray-400"}
                                ${index === 3 ? "border-2 border-[#F9B84E] bg-opacity-80" : ""}
                            `}
                        >
                            {day}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
} 