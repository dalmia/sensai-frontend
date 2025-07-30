import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { User, ChevronRight, ArrowRight, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export interface Performer {
    name: string;
    streakDays: number;
    tasksSolved: number;
    position: number;
    userId?: number; // Optional user ID to identify the current user
}

interface TopPerformersProps {
    schoolId?: string; // School ID for navigation
    cohortId?: string; // Cohort ID for navigation
    view: 'learner' | 'admin';
    onEmptyData?: (isEmpty: boolean) => void; // Callback when data availability changes
}

export default function TopPerformers({
    schoolId,
    cohortId,
    view,
    onEmptyData
}: TopPerformersProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const refreshButtonRef = useRef<HTMLButtonElement>(null);

    // State for data that will be fetched
    const [loading, setLoading] = useState(true);
    const [performers, setPerformers] = useState<Performer[]>([]);
    const [currentUser, setCurrentUser] = useState<Performer | null>(null);

    // Function to fetch performers data
    const fetchPerformers = useCallback(async () => {
        if (!cohortId || !user?.id) return;

        setLoading(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/leaderboard`);

            if (!response.ok) {
                throw new Error(`Failed to fetch performers: ${response.status}`);
            }

            const data = await response.json();

            // Set the performers data
            const validPerformers: Performer[] = (data.stats || []).map((stat: any, index: number) => {
                const userName = [stat.user.first_name, stat.user.last_name].filter(Boolean).join(' ');
                return {
                    name: userName,
                    streakDays: stat.streak_count,
                    tasksSolved: stat.tasks_completed,
                    position: index + 1, // Position based on array order
                    userId: stat.user.id // Keep track of user ID for identifying current user
                };
            });

            console.log(validPerformers);

            // const validPerformers = performersData.filter(performer => performer.streakDays > 0 || performer.tasksSolved > 0);

            // Get top performers but filter out those with 0 streak days
            let topPerformers = validPerformers.slice(0, 3); // Take top 3 of those

            let currentUser = undefined;

            if (view === 'learner') {
                // Find current user in the FULL performers list (which will always include them)
                currentUser = validPerformers.find(performer => performer.userId === parseInt(user.id));
                if (currentUser) {
                    setCurrentUser(currentUser);
                }
            }

            setPerformers(topPerformers);

            if (topPerformers.length === 0 && currentUser === undefined && onEmptyData) {
                onEmptyData(true);
            } else if ((topPerformers.length > 0 || currentUser !== undefined) && onEmptyData) {
                onEmptyData(false);
            }

            setLoading(false);
        } catch (error) {
            console.error("Error fetching top performers:", error);
        } finally {
            setLoading(false);
        }
    }, [cohortId, user?.id]);

    // Fetch data on mount and when cohortId changes
    useEffect(() => {
        if (cohortId && user?.id) {
            fetchPerformers();
        }
    }, [cohortId, user?.id]);

    // Update tooltip position based on button position
    useEffect(() => {
        if (showTooltip && refreshButtonRef.current) {
            const rect = refreshButtonRef.current.getBoundingClientRect();
            setTooltipPosition({
                top: rect.top - 10, // Position above the button with some spacing
                left: rect.left + rect.width / 2, // Center horizontally
            });
        }
    }, [showTooltip]);

    // Function to get the appropriate badge SVG based on position
    const getPositionBadge = (position: number) => {
        if (position === 1) {
            return "/images/leaderboard_1.svg";
        } else if (position === 2) {
            return "/images/leaderboard_2.svg";
        } else if (position === 3) {
            return "/images/leaderboard_3.svg";
        }
        return null;
    };

    // Check if current user is already in top performers
    const isCurrentUserInTopPerformers = currentUser && currentUser.userId
        ? performers.some(performer => performer.userId === currentUser.userId)
        : false;

    // Function to navigate to the full leaderboard
    const navigateToLeaderboard = () => {
        if (schoolId && cohortId) {
            router.push(`/school/${schoolId}/cohort/${cohortId}/leaderboard`);
        } else {
            console.warn("Cannot navigate to leaderboard: missing schoolId or cohortId");
        }
    };

    // Function to handle refresh click with visual feedback
    const handleRefresh = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent click from bubbling to parent elements

        if (isRefreshing) return;

        setIsRefreshing(true);

        try {
            console.log("Refreshing leaderboard data...");
            await fetchPerformers();
            console.log("Leaderboard refresh complete!");
        } catch (error) {
            console.error("Error refreshing leaderboard:", error);
        } finally {
            // Reset refreshing state after a short delay to show animation
            setTimeout(() => {
                setIsRefreshing(false);
            }, 500);
        }
    };

    // Create tooltip portal
    const renderTooltipPortal = () => {
        if (!showTooltip || typeof document === 'undefined') return null;

        return createPortal(
            <div
                className="fixed px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap"
                style={{
                    top: `${tooltipPosition.top}px`,
                    left: `${tooltipPosition.left}px`,
                    transform: 'translate(-50%, -100%)',
                    zIndex: 9999
                }}
            >
                Refresh
                <div
                    className="absolute w-2 h-2 bg-gray-800 rotate-45"
                    style={{
                        top: '100%',
                        left: '50%',
                        marginTop: '-4px',
                        marginLeft: '-4px'
                    }}
                ></div>
            </div>,
            document.body
        );
    };

    return (
        <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 bg-[#2A2000] flex justify-between items-center">
                <h3 className="text-lg font-light text-white">Top Performers</h3>
                <div className="flex items-center space-x-2">
                    <div className="relative">
                        <button
                            ref={refreshButtonRef}
                            onClick={handleRefresh}
                            onMouseEnter={() => setShowTooltip(true)}
                            onMouseLeave={() => setShowTooltip(false)}
                            onFocus={() => setShowTooltip(true)}
                            onBlur={() => setShowTooltip(false)}
                            className="group p-1.5 rounded-md transition-all duration-200 
                            bg-white/10 hover:bg-white/15 text-gray-200 cursor-pointer"
                            aria-label="Refresh leaderboard"
                            disabled={isRefreshing}
                        >
                            <RefreshCcw
                                size={16}
                                className={`transition-all duration-200 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-90'}`}
                            />
                        </button>

                        {/* Render tooltip via portal */}
                        {renderTooltipPortal()}
                    </div>
                    <button
                        onClick={navigateToLeaderboard}
                        className="group px-2.5 py-1 text-sm font-light rounded-md transition-all duration-200 flex items-center 
                        bg-white/10 hover:bg-white/15 text-gray-200 cursor-pointer"
                        aria-label="See all performers"
                    >
                        <span>See All</span>
                        <ChevronRight size={16} className="ml-1 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                </div>
            </div>

            <div className="divide-y divide-gray-800">
                {loading ? (
                    // Show loading spinner while data is being fetched
                    <div className="py-12 px-8 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin"></div>
                        </div>
                    </div>
                ) : performers.length > 0 ? (
                    // Show top performers if list is not empty
                    performers.map((performer) => {
                        // Check if this performer is the current user
                        const isCurrentUser = currentUser && performer.userId === currentUser.userId;

                        return (
                            <div
                                key={performer.position}
                                className={`p-4 flex items-center ${isCurrentUser ? 'bg-blue-900/20' : ''
                                    }`}
                            >
                                {performer.position <= 3 ? (
                                    <div className="w-12 h-12 mr-4 flex items-center justify-center">
                                        <Image
                                            src={getPositionBadge(performer.position)!}
                                            alt={`Position ${performer.position}`}
                                            width={40}
                                            height={40}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 bg-gray-100">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-light text-xl border-2 text-gray-400 border-gray-400">
                                            {performer.position}
                                        </div>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <div className="text-base font-medium text-white flex items-center">
                                        {performer.name}
                                        {isCurrentUser && (
                                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-400">
                                                You
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-400">
                                        Streak: {performer.streakDays} Day{performer.streakDays === 1 ? "" : "s"}
                                    </div>
                                    <div className="text-sm text-gray-400">
                                        Solved: {performer.tasksSolved} Task{performer.tasksSolved === 1 ? "" : "s"}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : currentUser ? (
                    // Show only current user with top performer styling when performers list is empty
                    <div className="p-4 flex items-center bg-blue-900/20">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 bg-blue-900/20">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-light text-base border-2 text-blue-500 border-blue-500">
                                {currentUser.position}
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="text-base font-medium text-white flex items-center">
                                {currentUser.name}
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-400">
                                    You
                                </span>
                            </div>
                            <div className="text-sm text-gray-400">
                                Streak: {currentUser.streakDays} Day{currentUser.streakDays === 1 ? "" : "s"}
                            </div>
                            <div className="text-sm text-gray-400">
                                Solved: {currentUser.tasksSolved} Task{currentUser.tasksSolved === 1 ? "" : "s"}
                            </div>
                        </div>
                    </div>
                ) : (
                    // No performers and no current user - show empty state (only when not loading)
                    <div className="py-12 px-8 text-center">
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800/40 to-gray-900/60 flex items-center justify-center border border-gray-700/30">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                            </div>
                        </div>
                        <h4 className="text-lg font-light text-white mb-2">No learners in the cohort yet</h4>
                        <p className="text-gray-400 text-sm">Top performers will appear once learners are added</p>
                    </div>
                )}

                {/* Show current user if they're not in top performers and performers list is not empty */}
                {!loading && currentUser && !isCurrentUserInTopPerformers && performers.length > 0 && (
                    <>
                        <div className="px-4 bg-gray-900 text-center text-xs text-gray-400">
                        </div>
                        <div className="p-4 flex items-center bg-gray-900/20">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 bg-blue-900/20">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center font-light text-base border-2 text-blue-500 border-blue-500">
                                    {currentUser.position}
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="text-base font-medium text-white flex items-center">
                                    {currentUser.name}
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-400">
                                        You
                                    </span>
                                </div>
                                <div className="text-sm text-gray-400">
                                    Streak: {currentUser.streakDays} Day{currentUser.streakDays === 1 ? "" : "s"}
                                </div>
                                <div className="text-sm text-gray-400">
                                    Solved: {currentUser.tasksSolved} Task{currentUser.tasksSolved === 1 ? "" : "s"}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
} 