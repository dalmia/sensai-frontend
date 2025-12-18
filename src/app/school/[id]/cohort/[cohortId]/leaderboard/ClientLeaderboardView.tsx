"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { Performer } from "@/components/TopPerformers";
import { useThemePreference } from "@/lib/hooks/useThemePreference";

export default function ClientLeaderboardView({
    cohortId,
    cohortName: initialCohortName,
    view,
    topN,
    batchId
}: {
    cohortId: string;
    cohortName?: string;
    view: 'learner' | 'admin'
    topN?: number;
    batchId?: number | null;
}) {
    const router = useRouter();
    const { user } = useAuth();
    const [cohortName, setCohortName] = useState<string>(initialCohortName || "Introduction to Programming");
    const [performers, setPerformers] = useState<Performer[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const { themePreference, setThemePreference, isDarkMode } = useThemePreference();

    // Fetch leaderboard data
    useEffect(() => {
        const fetchLeaderboardData = async () => {
            if (!cohortId || !user?.id) return;

            setLoading(true);

            try {
                const url = batchId != null
                    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/leaderboard?batch_id=${batchId}`
                    : `${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/leaderboard`;

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`Failed to fetch leaderboard data: ${response.status}`);
                }

                const data = await response.json();

                // Transform API response to match Performer interface
                const performersData: Performer[] = (data.stats || []).map((stat: any, index: number) => {
                    const userName = [stat.user.first_name, stat.user.last_name].filter(Boolean).join(' ') || stat.user.email;
                    return {
                        name: userName,
                        streakDays: stat.streak_count,
                        tasksSolved: stat.tasks_completed,
                        position: index + 1, // Position based on array order
                        userId: stat.user.id // Keep track of user ID for identifying current user
                    };
                });

                setPerformers(performersData);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching leaderboard data:", error);
                setError("Failed to load leaderboard data. Please try again.");
                setLoading(false);
            }
        };

        fetchLeaderboardData();
    }, [cohortId, user?.id, batchId]);

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

    // Check if a performer is the current user
    const isCurrentUser = (performer: Performer) => {
        return performer.userId === parseInt(user.id)
    };

    // Show medal for top 3 positions regardless of streak
    const shouldShowMedal = (performer: Performer) => {
        return performer.position <= 3;
    };

    return (
        <div className={`${view === 'admin' ? '' : 'min-h-screen'} ${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
            {view === 'learner' && (
                <div className="hidden sm:block">
                    <Header
                        showCreateCourseButton={false}
                        isDarkMode={isDarkMode}
                        themePreference={themePreference}
                        onThemePreferenceChange={setThemePreference}
                    />
                </div>
            )}

            <main className={`container mx-auto ${view === 'admin' ? '' : 'px-4 md:py-8'}`}>
                {/* Back button and page title */}
                {view === 'learner' && (
                    <>
                        {/* Mobile back button - visible only on small screens */}
                        <div className="sm:hidden mb-4 pt-4">
                            <button
                                onClick={() => router.back()}
                                className="flex items-center space-x-2 px-3 py-2 bg-gray-800/40 hover:bg-gray-700/60 rounded-full text-sm text-gray-300 transition-colors"
                            >
                                <ArrowLeft size={16} />
                                <span>Back to {cohortName}</span>
                            </button>
                        </div>

                        {/* Title - different layouts for mobile and desktop */}
                        <div className="flex mb-8">
                            <div className="flex-1 text-center">
                                {/* Desktop: cohort / leaderboard format */}
                                <h1 className="hidden sm:flex sm:flex-row items-center justify-center">
                                    <span
                                        className="text-gray-400 text-lg font-light cursor-pointer hover:text-gray-300"
                                        onClick={() => router.back()}
                                    >
                                        {cohortName}
                                    </span>
                                    <span className="mx-2 text-lg font-light text-gray-400">/</span>
                                    <span className="text-4xl font-light">Leaderboard</span>
                                </h1>

                                {/* Mobile: only leaderboard title */}
                                <h1 className="sm:hidden text-3xl font-light">
                                    Leaderboard
                                </h1>
                            </div>
                        </div>
                    </>
                )}

                {loading ? (
                    <div className="flex justify-center my-12">
                        <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                    </div>
                ) : error ? (
                    <div className="text-center my-12">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={() => location.reload()}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                ) : performers.length === 0 ? (
                    <div className="text-center py-16 px-8">
                        <div className="flex justify-center mb-8">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-800/40 to-gray-900/60 flex items-center justify-center border border-gray-700/30">
                                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl font-light text-white mb-3">No learners in the cohort yet</h3>
                        <p className="text-gray-400 text-base max-w-md mx-auto leading-relaxed">The leaderboard will appear once learners are added</p>
                    </div>
                ) : (
                    <div className={`${isDarkMode ? 'bg-[#121212] border-gray-800' : 'bg-white border-gray-300'} rounded-lg border overflow-hidden`}>
                        {/* Column Headers */}
                        <div className={`grid ${view === 'admin'
                            ? 'grid-cols-7 sm:grid-cols-8 py-2 sm:py-3 text-xs sm:text-sm'
                            : 'grid-cols-7 sm:grid-cols-10 md:grid-cols-12 py-3 sm:py-4 text-xs sm:text-sm'
                            } gap-1 sm:gap-2 px-2 sm:px-4 border-b ${isDarkMode ? 'border-gray-800 bg-[#2A2000] text-white' : 'border-[#D39228] bg-[#F6C16E] text-black'} font-light`}>
                            <div className="col-span-1 text-center">Rank</div>
                            <div className={`${view === 'admin'
                                ? 'col-span-3 sm:col-span-3 md:col-span-4'
                                : 'col-span-3 sm:col-span-4 md:col-span-5 lg:col-span-6'}`}>
                                Learner
                            </div>
                            <div className={`${view === 'admin'
                                ? 'col-span-1 sm:col-span-2 md:col-span-1'
                                : 'col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-2'} text-center`}>
                                Streak
                            </div>
                            <div className={`${view === 'admin'
                                ? 'col-span-2'
                                : 'col-span-2 sm:col-span-3 lg:col-span-3'} text-right pr-1 sm:pr-2`}>
                                <span className="hidden md:inline">Tasks completed</span>
                                <span className="md:hidden">Tasks</span>
                            </div>
                        </div>

                        {/* Performers List */}
                        <div className={`divide-y ${isDarkMode ? 'divide-gray-800' : 'divide-gray-200'}`}> 
                            {performers.slice(0, topN !== undefined ? topN : performers.length).map((performer, index) => (
                                <div
                                    key={index}
                                    className={`grid ${view === 'admin'
                                        ? 'grid-cols-7 sm:grid-cols-8 py-2 text-xs sm:text-sm'
                                        : 'grid-cols-7 sm:grid-cols-10 md:grid-cols-12 py-3 sm:py-4 text-xs sm:text-sm'
                                        } gap-1 sm:gap-2 px-2 sm:px-4 items-center ${isCurrentUser(performer) ? (isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50') : ''}`}
                                >
                                    {/* Position Column */}
                                    <div className="col-span-1 flex justify-center">
                                        {shouldShowMedal(performer) ? (
                                            <div className={`${view === 'admin' ? 'w-6 h-6 sm:w-8 sm:h-8' : 'w-7 h-7 sm:w-10 sm:h-10'} flex items-center justify-center`}>
                                                <Image
                                                    src={getPositionBadge(performer.position)!}
                                                    alt={`Position ${performer.position}`}
                                                    width={view === 'admin' ? 20 : 28}
                                                    height={view === 'admin' ? 20 : 28}
                                                    className="w-auto h-auto sm:w-full sm:h-full"
                                                />
                                            </div>
                                        ) : (
                                            <div className={`${view === 'admin' ? 'w-5 h-5 sm:w-7 sm:h-7' : 'w-6 h-6 sm:w-9 sm:h-9'}  rounded-full flex items-center justify-center ${isDarkMode ? 'bg-gray-800/30' : 'bg-white'}`}>
                                                <div className={`${view === 'admin'
                                                    ? 'w-4 h-4 sm:w-6 sm:h-6 text-xs sm:text-sm'
                                                    : 'w-5 h-5 sm:w-8 sm:h-8 text-xs sm:text-base'} rounded-full flex items-center justify-center font-light border-2 
                                                    ${isCurrentUser(performer)
                                                        ? 'text-blue-500 border-blue-500'
                                                        : isDarkMode ? 'text-gray-400 border-gray-700' : 'text-gray-700 border-gray-300'}`}>
                                                    {performer.position}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Name Column */}
                                    <div className={`${view === 'admin'
                                        ? 'col-span-3 sm:col-span-3 md:col-span-4'
                                        : 'col-span-3 sm:col-span-4 md:col-span-5 lg:col-span-6'} flex items-center`}>
                                    <div className={`font-medium flex items-center overflow-hidden ${isDarkMode ? 'text-white' : 'text-black'}`}>
                                            <span className="truncate">{performer.name}</span>
                                            {isCurrentUser(performer) && (
                                                <span className={`ml-1 sm:ml-2 inline-flex items-center px-1 sm:px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                                                    You
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Streak Column */}
                                    <div className={`${view === 'admin'
                                        ? 'col-span-1 sm:col-span-2 md:col-span-1'
                                        : 'col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-2'} text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        <span className="hidden sm:inline">{performer.streakDays} Day{performer.streakDays === 1 ? "" : "s"}</span>
                                        <span className="sm:hidden">{performer.streakDays}d</span>
                                    </div>

                                    {/* Tasks Solved Column */}
                                    <div className={`${view === 'admin'
                                        ? 'col-span-2'
                                        : 'col-span-2 sm:col-span-3 lg:col-span-3'} text-right pr-1 sm:pr-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {performer.tasksSolved}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
} 