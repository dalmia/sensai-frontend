"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/layout/header";

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // Redirect to login if not authenticated
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    // Set page title with user's name or email
    useEffect(() => {
        const displayName = session?.user?.name || session?.user?.email || "Profile";
        document.title = `${displayName} | SensAI`;
    }, [session?.user?.name, session?.user?.email]);

    // Show loading state while checking session
    if (status === "loading") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-black px-4">
                <div className="w-12 h-12 border-t-2 border-b-2 border-black dark:border-white rounded-full animate-spin"></div>
            </div>
        );
    }

    // Get user initials for avatar
    const getInitials = () => {
        if (session?.user?.name) {
            return session.user.name.charAt(0).toUpperCase();
        }
        return "U";
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <Header showCreateCourseButton={false} />
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="flex items-center">
                    <div className="w-[20%] flex justify-center">
                        <div className="w-24 h-24 rounded-full bg-purple-700 flex items-center justify-center">
                            <span className="text-white text-4xl font-medium">{getInitials()}</span>
                        </div>
                    </div>
                    <div className="w-[80%]">
                        <h1 className="text-2xl font-semibold text-black dark:text-white">
                            {session?.user?.name || "User"}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            {session?.user?.email || ""}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

