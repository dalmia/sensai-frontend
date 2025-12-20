"use client";

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSchools } from '@/lib/api';
import UnauthorizedError from '@/components/UnauthorizedError';
import { Header } from '@/components/layout/header';
import { useThemePreference } from '@/lib/hooks/useThemePreference';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const { schools, isLoading: schoolsLoading } = useSchools();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const pathname = usePathname();

    // Extract school ID from the URL if we are in a specific school admin view
    const schoolIdMatch = pathname.match(/\/school\/admin\/([^\/]+)/);
    const currentSchoolId = schoolIdMatch ? schoolIdMatch[1] : null;

    // Determine if the user has access to this school admin area
    useEffect(() => {
        if (authLoading || schoolsLoading || !isAuthenticated) {
            return;
        }

        // If we're on create page or similar, always allow
        if (!currentSchoolId || currentSchoolId === 'create') {
            setIsAuthorized(true);
            return;
        }

        // Check if user has admin or owner access to this school
        if (schools && schools.length > 0) {
            const hasAccess = schools.some(
                school =>
                    parseInt(school.id) === parseInt(currentSchoolId) &&
                    (school.role === 'admin' || school.role === 'owner')
            );
            setIsAuthorized(hasAccess);
        } else {
            setIsAuthorized(false);
        }
    }, [isAuthenticated, authLoading, schoolsLoading, schools, currentSchoolId]);

    // Show loading state
    if (authLoading || schoolsLoading || isAuthorized === null) {
        return (
            <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
                <Header
                    showCreateCourseButton={false}
                />
                <div className="flex justify-center items-center py-12">
                    <div className="w-12 h-12 border-t-2 border-b-2 rounded-full animate-spin border-black dark:border-white"></div>
                </div>
            </div>
        );
    }

    // If not authorized, show error page
    if (!isAuthorized) {
        return <UnauthorizedError />;
    }

    // User is authorized, render children
    return children;
} 