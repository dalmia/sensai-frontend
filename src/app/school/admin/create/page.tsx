"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/lib/auth";
import { useSchools } from "@/lib/api";
import { motion } from "framer-motion"; // Import Framer Motion
import { X } from "lucide-react"; // Import X icon

export default function CreateSchool() {
    const router = useRouter();
    const { user } = useAuth();
    const { schools, isLoading: isLoadingSchools } = useSchools();

    // State for form fields
    const [firstName, setFirstName] = useState("");
    const [middleName, setMiddleName] = useState("");
    const [lastName, setLastName] = useState("");
    const [schoolName, setSchoolName] = useState("");
    const [slug, setSlug] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Add state for error message
    const [slugError, setSlugError] = useState<string | null>(null);
    // Add state for success dialog
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [newSchoolId, setNewSchoolId] = useState<string | null>(null);

    // Check if user already has a school and redirect if they do
    useEffect(() => {
        if (schools && schools.length > 0) {
            const ownedSchool = schools.find(school => school.role === 'owner');
            if (ownedSchool) {
                router.push(`/school/admin/${ownedSchool.id}`);
            }
        }
    }, [schools, router]);

    // Base URL for the school (would come from environment variables in a real app)
    const baseUrl = `${process.env.NEXT_PUBLIC_APP_URL}/school/`;

    // Play success sound effect - a distinctive sound for school creation
    const playSuccessSound = () => {
        try {
            const audioContext = new AudioContext();

            // Create a more elaborate, celebratory sound with multiple oscillators

            // First oscillator - descending chime sound
            const oscillator1 = audioContext.createOscillator();
            oscillator1.type = 'triangle'; // Triangle wave for a bell-like quality
            oscillator1.frequency.setValueAtTime(1200, audioContext.currentTime);
            oscillator1.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);

            // Second oscillator - ascending tone
            const oscillator2 = audioContext.createOscillator();
            oscillator2.type = 'sine';
            oscillator2.frequency.setValueAtTime(400, audioContext.currentTime + 0.15);
            oscillator2.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.45);

            // Third oscillator - higher pitch flourish
            const oscillator3 = audioContext.createOscillator();
            oscillator3.type = 'square'; // Square wave for a bright quality
            oscillator3.frequency.setValueAtTime(1400, audioContext.currentTime + 0.3);
            oscillator3.frequency.exponentialRampToValueAtTime(1800, audioContext.currentTime + 0.5);
            oscillator3.frequency.exponentialRampToValueAtTime(1600, audioContext.currentTime + 0.7);

            // Create gain nodes with different envelope shapes
            const gainNode1 = audioContext.createGain();
            gainNode1.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode1.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.05);
            gainNode1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);

            const gainNode2 = audioContext.createGain();
            gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.15);
            gainNode2.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.25);
            gainNode2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6);

            const gainNode3 = audioContext.createGain();
            gainNode3.gain.setValueAtTime(0, audioContext.currentTime + 0.3);
            gainNode3.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.4);
            gainNode3.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);

            // Connect nodes
            oscillator1.connect(gainNode1);
            oscillator2.connect(gainNode2);
            oscillator3.connect(gainNode3);

            gainNode1.connect(audioContext.destination);
            gainNode2.connect(audioContext.destination);
            gainNode3.connect(audioContext.destination);

            // Start and stop oscillators with different timings
            oscillator1.start(audioContext.currentTime);
            oscillator1.stop(audioContext.currentTime + 0.5);

            oscillator2.start(audioContext.currentTime + 0.15);
            oscillator2.stop(audioContext.currentTime + 0.7);

            oscillator3.start(audioContext.currentTime + 0.3);
            oscillator3.stop(audioContext.currentTime + 0.9);
        } catch (error) {
            console.error("Error creating school creation sound:", error);
        }
    };

    // Function to handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user?.id) {
            console.error("User not authenticated");
            return;
        }

        setIsSubmitting(true);
        // Clear any previous errors
        setSlugError(null);

        try {
            // Create the school via API
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: schoolName,
                    slug: slug,
                    user_id: user.id
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                if (errorData.detail) {
                    if (errorData.detail.includes('already exists')) {
                        setSlugError('This school URL is already taken. Please choose another.');
                        throw new Error('Slug already exists');
                    } else {
                        throw new Error(errorData.detail);
                    }
                } else {
                    throw new Error(`API error: ${response.status}`);
                }
            }

            const data = await response.json();

            // Instead of redirecting, show success dialog
            setNewSchoolId(data.id.toString());
            setShowSuccessDialog(true);
            playSuccessSound();
        } catch (error) {
            console.error("Error creating school:", error);
            // Error is already set if it's a slug error
        } finally {
            setIsSubmitting(false);
        }
    };

    // Function to navigate to the new school
    const navigateToSchool = () => {
        if (newSchoolId) {
            // Replace client-side navigation with a full page navigation
            window.location.href = `/school/admin/${newSchoolId}`;
        }
    };

    // Effect to pre-fill name fields from user data if available
    useEffect(() => {
        if (user?.name) {
            const nameParts = user.name.split(" ");
            if (nameParts.length >= 1) setFirstName(nameParts[0]);
            if (nameParts.length >= 3) {
                setMiddleName(nameParts.slice(1, -1).join(" "));
                setLastName(nameParts[nameParts.length - 1]);
            } else if (nameParts.length === 2) {
                setLastName(nameParts[1]);
            }
        }
    }, [user]);

    // Animation variants for shooting stars
    const shootingStarVariants = {
        initial: {
            opacity: 0,
            x: 0,
            y: 0,
            scale: 0,
            rotate: 215,
        },
        animate: {
            opacity: [0, 1, 1, 0],
            x: "-100vw",
            y: "100vh",
            scale: [0, 0.5],
            rotate: 215,
            transition: {
                duration: 3,
                ease: "easeOut",
            }
        }
    };

    // Animation variants for orbs
    const orbVariants = {
        initial: { opacity: 0, y: 100, scale: 0.1 },
        animate: {
            opacity: [0, 0.8, 0.8, 0],
            y: [-20, -120],
            scale: [0.1, 0.6, 0.4, 0.1],
            transition: {
                duration: 4,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "loop" as const
            }
        }
    };

    // Function to navigate back to home
    const handleGoBack = () => {
        router.push('/');
    };

    return (
        <>
            <div className="flex min-h-screen flex-col bg-white text-black dark:bg-black dark:text-white">
                {/* Close button - repositioned for better mobile experience */}
                <div className="absolute top-5 right-4 sm:right-6 md:right-8 lg:right-12 z-10">
                    <button
                        onClick={handleGoBack}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-0 focus:border-0 cursor-pointer bg-gray-100 hover:bg-gray-200 border border-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-transparent"
                        aria-label="Close and return to home"
                    >
                        <X className="w-4 h-4 sm:w-5 sm:h-5 text-black dark:text-white" />
                    </button>
                </div>

                <main className="container mt-10 sm:mt-20 mx-auto px-4 sm:px-6 py-8 max-w-3xl">
                    {isLoadingSchools ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="w-12 h-12 border-t-2 border-b-2 rounded-full animate-spin border-slate-900 dark:border-white border-t-transparent" data-testid="loading-spinner"></div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-3xl font-light mb-6 sm:mb-8 text-center">Create Your School</h1>

                            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
                                {/* School Name */}
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-light mb-2">School Name</h2>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">This is usually your name or the name of your organization.</p>
                                    <input
                                        id="schoolName"
                                        type="text"
                                        value={schoolName}
                                        onChange={(e) => setSchoolName(e.target.value)}
                                        className="w-full px-3 sm:px-4 py-3 rounded-md border focus:outline-none focus:ring-1 bg-white border-gray-300 text-black focus:ring-black dark:bg-[#161925] dark:border-gray-800 dark:text-white dark:focus:ring-white"
                                        required
                                        maxLength={40}
                                    />
                                    <div className="text-right text-sm mt-1 text-gray-500 dark:text-gray-400">
                                        {schoolName.length}/40
                                    </div>
                                </div>

                                {/* School URL */}
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-light mb-2">School Link</h2>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">This is how your school will be accessed online by your learners</p>
                                    <div className="flex flex-col sm:flex-row">
                                        <div className={`bg-gray-100 text-gray-700 border-gray-300 dark:bg-[#161925] dark:text-gray-300 dark:border-gray-800 px-3 sm:px-4 py-3 rounded-t-md sm:rounded-l-md sm:rounded-tr-none border sm:text-sm md:text-base overflow-x-auto whitespace-nowrap ${slugError ? 'border-red-500' : ''}`}>
                                            {baseUrl}
                                        </div>
                                        <input
                                            id="slug"
                                            type="text"
                                            value={slug}
                                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                            className={`flex-1 px-3 sm:px-4 py-3 rounded-b-md sm:rounded-r-md sm:rounded-bl-none border sm:border-l-0 border-t-0 sm:border-t focus:outline-none focus:ring-1 bg-white border-gray-300 text-black focus:ring-black dark:bg-[#161925] dark:border-gray-800 dark:text-white dark:focus:ring-white ${slugError ? 'border-red-500' : ''}`}
                                            required
                                            pattern="[a-z0-9-]+"
                                            title="Only lowercase letters, numbers, and hyphens are allowed"
                                            maxLength={121}
                                        />
                                    </div>
                                    <div className="flex flex-col sm:flex-row justify-between text-sm mt-1">
                                        {slugError && (
                                            <p className="text-red-500 mb-1 sm:mb-0">{slugError}</p>
                                        )}
                                        <div className={`text-gray-500 dark:text-gray-400 ${slugError ? 'sm:ml-auto' : 'w-full text-right'}`}>
                                            {slug.length}/121
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <div className="pt-4 sm:pt-6 flex justify-center">
                                    <button
                                        type="submit"
                                        className="w-full sm:w-auto px-6 sm:px-8 py-3 text-sm font-medium rounded-full transition-colors cursor-pointer disabled:opacity-50 bg-white text-black border border-gray-200 shadow-sm hover:bg-gray-50 dark:bg-white dark:text-black dark:border-transparent dark:shadow-none dark:hover:opacity-90"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Creating...' : 'Create School'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </main>
            </div>

            {/* Success Dialog with Framer Motion animations */}
            {showSuccessDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center overflow-hidden px-4">
                    {/* Shooting Stars using Framer Motion - adjusted for mobile */}
                    {Array.from({ length: 8 }).map((_, i) => {
                        const top = Math.random() * 40; // Random starting position
                        const left = Math.random() * 100 + 50; // Random starting position
                        const width = Math.random() * 100 + 40; // Adjusted for mobile: Between 40px and 140px
                        const delay = Math.random() * 2; // Random delay

                        return (
                            <motion.div
                                key={`star-${i}`}
                                initial="initial"
                                animate="animate"
                                variants={shootingStarVariants}
                                style={{
                                    position: 'absolute',
                                    top: `${top}%`,
                                    left: `${left}%`,
                                    width: `${width}px`,
                                    height: '2px',
                                    background: 'linear-gradient(90deg, #ffffff, rgba(255, 255, 255, 0))',
                                    borderRadius: '999px',
                                    filter: 'drop-shadow(0 0 6px rgba(105, 155, 255, 1))',
                                    zIndex: 51,
                                }}
                                transition={{
                                    delay,
                                    duration: 3,
                                }}
                            />
                        );
                    })}

                    {/* Floating Orbs using Framer Motion - reduced quantity for mobile */}
                    {Array.from({ length: 6 }).map((_, i) => {
                        const left = (i % 3) * 30 + 10; // 3 orbs per row, evenly spaced
                        const size = 6 + (i % 3) * 3; // Smaller sizes for mobile: 6px, 9px, or 12px
                        const delay = i * 0.4; // Sequential delays
                        const hue = i % 2 === 0 ? 210 + (i * 5) : 180 - (i * 3); // Blues/purples

                        return (
                            <motion.div
                                key={`orb-${i}`}
                                initial="initial"
                                animate="animate"
                                variants={orbVariants}
                                style={{
                                    position: 'absolute',
                                    left: `${left}%`,
                                    bottom: '10%',
                                    width: `${size}px`,
                                    height: `${size}px`,
                                    borderRadius: '50%',
                                    background: `radial-gradient(circle at 30% 30%, hsla(${hue}, 80%, 75%, 0.8), hsla(${hue}, 80%, 75%, 0) 70%)`,
                                    filter: 'blur(1px)',
                                    boxShadow: `0 0 8px 2px hsla(${hue}, 80%, 70%, 0.3)`,
                                    zIndex: 51,
                                }}
                                transition={{
                                    delay,
                                    duration: 4,
                                    repeat: Infinity,
                                    repeatType: "loop" as const,
                                    ease: "easeInOut"
                                }}
                            />
                        );
                    })}

                    {/* Dialog Content - Using Framer Motion for a subtle animation */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="p-[2px] rounded-lg max-w-md w-full mx-auto relative z-60 bg-white border border-gray-200 dark:bg-gradient-to-r dark:from-indigo-500 dark:via-purple-500 dark:to-pink-500 dark:border-transparent"
                    >
                        <div className="bg-white text-black dark:bg-black dark:text-white rounded-lg p-6 sm:p-8 flex flex-col items-center text-center">
                            <h2 className="text-3xl sm:text-4xl font-light mb-3 sm:mb-4">Your School is Ready!</h2>
                            <p className="text-lg sm:text-xl font-light mb-6 sm:mb-8">An epic journey begins now</p>

                            <button
                                onClick={navigateToSchool}
                                className="w-full sm:w-auto px-6 sm:px-8 py-3 text-sm font-medium rounded-full hover:opacity-90 transition-opacity cursor-pointer bg-black text-white dark:bg-white dark:text-black"
                            >
                                Open my school
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </>
    );
} 