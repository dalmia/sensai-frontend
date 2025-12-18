"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useSchools } from "@/lib/api";
import CreateCourseDialog from "@/components/CreateCourseDialog";
import SchoolPickerDialog from "@/components/SchoolPickerDialog";
import { ChevronDown, Plus, X, Book, School } from "lucide-react";
import { Cohort } from "@/types";

interface HeaderProps {
    showCreateCourseButton?: boolean;
    showTryDemoButton?: boolean;
    centerSlot?: React.ReactNode;
    isDarkMode?: boolean;
    themePreference?: 'dark' | 'light' | 'device';
    onThemePreferenceChange?: (preference: 'dark' | 'light' | 'device') => void;
}

export function Header({
    showCreateCourseButton = true,
    showTryDemoButton = false,
    centerSlot,
    isDarkMode = true,
    themePreference,
    onThemePreferenceChange
}: HeaderProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [isCreateCourseDialogOpen, setIsCreateCourseDialogOpen] = useState(false);
    const [isSchoolPickerOpen, setIsSchoolPickerOpen] = useState(false);
    const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const mobileActionsRef = useRef<HTMLDivElement>(null);
    const { schools, isLoading } = useSchools();

    // Check if user has a school they own (role admin)
    const hasOwnedSchool = Boolean(schools && schools.length > 0 &&
        schools.some(school => school.role === 'owner' || school.role === 'admin'));

    // Use the first owned/admin school or just first school as fallback
    const ownedSchool = schools?.find(school => school.role === 'owner' || school.role === 'admin');
    const schoolId = ownedSchool?.id || (schools && schools.length > 0 ? schools[0].id : null);

    // Close the profile menu and mobile actions when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
            if (mobileActionsRef.current && !mobileActionsRef.current.contains(event.target as Node)) {
                setMobileActionsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [profileMenuRef, mobileActionsRef]);

    // Handle logout
    const handleLogout = () => {
        signOut({ callbackUrl: "/login" });
        setProfileMenuOpen(false);
    };

    // Toggle profile menu
    const toggleProfileMenu = () => {
        setProfileMenuOpen(!profileMenuOpen);
    };


    // Toggle mobile actions menu
    const toggleMobileActions = () => {
        setMobileActionsOpen(!mobileActionsOpen);
    };


    // Handle button click based on school ownership
    const handleButtonClick = (e: React.MouseEvent) => {
        // If no schools, redirect to school creation
        if (!schools || schools.length === 0) {
            router.push("/school/admin/create");
            return;
        }

        // If exactly one school and user is owner, go directly to that school
        if (schools.length === 1 && (schools[0].role === 'owner')) {
            router.push(`/school/admin/${schools[0].id}`);
            return;
        }

        // Otherwise show the school picker dialog
        setIsSchoolPickerOpen(true);
    };

    // Handle selecting a school from the picker
    const handleSelectSchool = (selectedSchoolId: string) => {
        router.push(`/school/admin/${selectedSchoolId}`);
        setIsSchoolPickerOpen(false);
    };

    // Handle creating a new school
    const handleCreateSchool = () => {
        router.push("/school/admin/create");
    };

    // Handle creating a new course button click
    const handleCreateCourseButtonClick = () => {
        setIsCreateCourseDialogOpen(true);
        setMobileActionsOpen(false);
    };

    // Handle success callback from CreateCourseDialog
    const handleCourseCreationSuccess = (courseData: { id: string; name: string }) => {
        if (hasOwnedSchool && schoolId) {
            // Redirect to the new course page - dialog will be unmounted during navigation
            router.push(`/school/admin/${schoolId}/courses/${courseData.id}`);
        } else {
            router.push("/school/admin/create");
        }
    };

    // Handle go to school button click
    const handleGoToSchoolClick = () => {
        handleButtonClick({} as React.MouseEvent);
        setMobileActionsOpen(false);
    };

    // Add handler for "Try a demo" button click
    const handleTryDemoClick = () => {
        window.open("https://sensai.hyperverge.org/school/first-principles/join?cohortId=89", "_blank");
        setMobileActionsOpen(false);
    };

    // Get user initials for avatar
    const getInitials = () => {
        if (session?.user?.name) {
            return session.user.name.charAt(0).toUpperCase();
        }
        return "U";
    };

    // Get appropriate button text based on conditions
    const getButtonText = () => {
        if (hasOwnedSchool) {
            return "Open school";
        } else {
            return "Create a course";
        }
    };

    const logoSrc = isDarkMode ? "/images/sensai-logo-dark.svg" : "/images/sensai-logo-light.svg";
    const selectedThemePreference = themePreference ?? (isDarkMode ? 'dark' : 'light');

    return (
        <header className={`w-full px-3 py-4 ${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
            <div className="max-w-full mx-auto flex justify-between items-center">
                {/* Logo */}
                <Link href="/">
                    <div className="cursor-pointer">
                        <Image
                            src={logoSrc}
                            alt="SensAI Logo"
                            width={120}
                            height={40}
                            className="w-[100px] h-auto sm:w-[120px]"
                            style={{
                                maxWidth: '100%',
                                height: 'auto'
                            }}
                            priority
                        />
                    </div>
                </Link>

                {/* Center Slot (custom content) */}
                {centerSlot && (
                    <div className="hidden sm:flex flex-1 justify-center mx-1 sm:mx-2 items-center gap-4">
                        {centerSlot}
                    </div>
                )}

                {/* Right side actions */}
                <div className="flex items-center space-x-4 pr-1">

                    <>
                        {showTryDemoButton && (
                            <button
                                onClick={handleTryDemoClick}
                                className={`hidden md:block px-6 py-3 text-sm font-medium rounded-full cursor-pointer ${isDarkMode ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-black/10 text-black hover:bg-black/20'}`}
                            >
                                Try a demo
                            </button>
                        )}
                        {showCreateCourseButton && (
                            <button
                                onClick={handleButtonClick}
                                className={`hidden md:block px-6 py-3 text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none focus:ring-0 focus:border-0 cursor-pointer ${isDarkMode ? 'bg-white text-black' : 'bg-gray-300 text-gray-800'}`}
                            >
                                {getButtonText()}
                            </button>
                        )}
                    </>


                    {/* Profile dropdown */}
                    <div className="relative" ref={profileMenuRef}>
                        <button
                            className="w-10 h-10 rounded-full bg-purple-700 flex items-center justify-center hover:bg-purple-600 transition-colors focus:outline-none focus:ring-0 focus:border-0 cursor-pointer"
                            onClick={toggleProfileMenu}
                        >
                            <span className="text-white font-medium">{getInitials()}</span>
                        </button>

                        {/* Profile dropdown menu */}
                        {profileMenuOpen && (
                            <div className={`absolute right-0 mt-2 w-64 rounded-md shadow-lg py-1 z-10 ${isDarkMode ? 'bg-[#111111]' : 'bg-white border border-gray-200'}`}>
                                <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 rounded-full bg-purple-700 flex items-center justify-center mr-3">
                                            <span className="text-white font-medium">{getInitials()}</span>
                                        </div>
                                        <div>
                                            <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}>{session?.user?.name || "User"}</div>
                                            <div className="text-xs text-gray-400">{session?.user?.email || "user@example.com"}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Theme Toggle */}
                                <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                                    <div className="flex flex-col gap-2">
                                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Theme</span>
                                        <div className={`inline-flex w-full rounded-full p-1 ${isDarkMode ? 'bg-[#1F1F1F]' : 'bg-gray-200'}`}>
                                            <button
                                                type="button"
                                                onClick={() => onThemePreferenceChange?.('light')}
                                                className={`flex-1 px-3 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                                                    selectedThemePreference === 'light'
                                                        ? (isDarkMode ? 'bg-white text-black' : 'bg-white text-black')
                                                        : (isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-black')
                                                }`}
                                            >
                                                Light
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onThemePreferenceChange?.('dark')}
                                                className={`flex-1 px-3 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                                                    selectedThemePreference === 'dark'
                                                        ? (isDarkMode ? 'bg-white text-black' : 'bg-white text-black')
                                                        : (isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-black')
                                                }`}
                                            >
                                                Dark
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onThemePreferenceChange?.('device')}
                                                className={`flex-1 px-3 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                                                    selectedThemePreference === 'device'
                                                        ? (isDarkMode ? 'bg-white text-black' : 'bg-white text-black')
                                                        : (isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-black')
                                                }`}
                                            >
                                                Device
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className={`border-t py-1 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                                    <button
                                        onClick={handleLogout}
                                        className={`flex w-full items-center text-left px-4 py-2 text-sm cursor-pointer ${isDarkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}
                                    >
                                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Floating Action Button and Menu */}
            {showCreateCourseButton && (
                <div className="md:hidden">
                    {/* Semi-transparent overlay */}
                    {mobileActionsOpen && (
                        <div
                            className="fixed inset-0 z-10"
                            style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
                            aria-hidden="true"
                            onClick={() => setMobileActionsOpen(false)}
                        />
                    )}

                    {/* Main FAB button and menu contents */}
                    <div ref={mobileActionsRef}>
                        {/* Main FAB button */}
                        <button
                            onClick={toggleMobileActions}
                            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg z-20 cursor-pointer transition-transform duration-300 focus:outline-none"
                            aria-label="Actions menu"
                        >
                            {mobileActionsOpen ?
                                <X className="h-6 w-6" /> :
                                hasOwnedSchool ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                                        <rect width="7" height="9" x="3" y="3" rx="1"></rect>
                                        <rect width="7" height="5" x="14" y="3" rx="1"></rect>
                                        <rect width="7" height="9" x="14" y="12" rx="1"></rect>
                                        <rect width="7" height="5" x="3" y="16" rx="1"></rect>
                                    </svg>
                                ) : (
                                    <Plus className="h-6 w-6" />
                                )
                            }
                        </button>

                        {/* Action buttons that appear when FAB is clicked */}
                        {mobileActionsOpen && (
                            <div className="fixed bottom-24 right-6 flex flex-col gap-4 items-end z-20">
                                {/* Try a demo Button - only shown if not already a learner */}
                                {showTryDemoButton && (
                                    <div className="flex items-center gap-3">
                                        <span className="bg-black text-white py-2 px-4 rounded-full text-sm shadow-md">
                                            Try a demo
                                        </span>
                                        <button
                                            onClick={handleTryDemoClick}
                                            className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-md cursor-pointer"
                                            aria-label="Try as a learner"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                                                <path d="M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path>
                                                <path d="M12 3v2"></path>
                                                <path d="M12 19v2"></path>
                                                <path d="m19 12 2 1"></path>
                                                <path d="M3 13 5 12"></path>
                                                <path d="m17 7 1.4-1.4"></path>
                                                <path d="m5.6 18.4 1.4-1.4"></path>
                                                <path d="m16.7 18.4 1.4 1.4"></path>
                                                <path d="m5.6 5.6 1.4 1.4"></path>
                                            </svg>
                                        </button>
                                    </div>
                                )}


                                {/* Go To School Button - only shown if hasOwnedSchool is true */}
                                {hasOwnedSchool ? (
                                    <div className="flex items-center gap-3">
                                        <span className="bg-black text-white py-2 px-4 rounded-full text-sm shadow-md">
                                            Open school
                                        </span>
                                        <button
                                            onClick={handleGoToSchoolClick}
                                            className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-md cursor-pointer"
                                            aria-label="Go to school"
                                        >
                                            <School className="h-6 w-6" />
                                        </button>
                                    </div>
                                ) : /* Create Course Button */ <div className="flex items-center gap-3">
                                    <span className="bg-black text-white py-2 px-4 rounded-full text-sm shadow-md">
                                        Create a course
                                    </span>
                                    <button
                                        onClick={handleCreateCourseButtonClick}
                                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-md cursor-pointer"
                                        aria-label="Create a course"
                                    >
                                        <Book className="h-6 w-6" />
                                    </button>
                                </div>}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Course Dialog */}
            <CreateCourseDialog
                open={isCreateCourseDialogOpen}
                onClose={() => setIsCreateCourseDialogOpen(false)}
                onSuccess={handleCourseCreationSuccess}
                schoolId={schoolId || undefined}
            />

            {/* School Picker Dialog */}
            {schools && (
                <SchoolPickerDialog
                    open={isSchoolPickerOpen}
                    onClose={() => setIsSchoolPickerOpen(false)}
                    schools={schools}
                    onSelectSchool={handleSelectSchool}
                    onCreateSchool={handleCreateSchool}
                />
            )}
        </header>
    );
} 