"use client";

import { useState, useEffect } from "react";
import LearnerCourseView from "@/components/LearnerCourseView";
import { Module } from "@/types/course";
import { useThemePreference } from "@/lib/hooks/useThemePreference";

interface ClientPreviewWrapperProps {
    modules: Module[];
}

export default function ClientPreviewWrapper({
    modules,
}: ClientPreviewWrapperProps) {
    // For preview mode, we use LearnerCourseView directly to ensure full-width display
    // without the sidebar that LearnerCohortView would add
    return (
        <LearnerCourseView
            modules={modules}
            completedTaskIds={{}}
            completedQuestionIds={{}}
            isTestMode={true}
        />
    );
} 