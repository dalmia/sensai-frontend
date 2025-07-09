"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCourses, useSchools, Course as ApiCourse } from "@/lib/api";
import CourseCard from "@/components/CourseCard";
import CreateCourseDialog from "@/components/CreateCourseDialog";

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const { courses, isLoading, error } = useCourses();
  const { schools } = useSchools();
  const [isCreateCourseDialogOpen, setIsCreateCourseDialogOpen] = useState(false);

  // Memoize derived data to avoid recalculations
  const {
    teachingCourses,
    mentoringCourses,
    learningCourses,
    hasTeachingCourses,
    hasMentoringCourses,
    hasLearningCourses,
    hasAnyCourses,
    showSegmentedTabs,
    tabsToShow
  } = useMemo(() => {
    const teachingCourses = courses.filter(course => course.role === 'admin');
    const mentoringCourses = courses.filter(course => course.role === 'mentor');
    const learningCourses = courses.filter(course => course.role !== 'admin' && course.role !== 'mentor');
    const hasTeachingCourses = teachingCourses.length > 0;
    const hasMentoringCourses = mentoringCourses.length > 0;
    const hasLearningCourses = learningCourses.length > 0;

    const roleCount = [hasTeachingCourses, hasMentoringCourses, hasLearningCourses].filter(Boolean).length;
    const showSegmentedTabs = roleCount > 1;

    // Determine which tabs to show based on available roles
    const tabsToShow = [];
    if (hasTeachingCourses) tabsToShow.push('teaching');
    if (hasMentoringCourses) tabsToShow.push('mentoring');
    if (hasLearningCourses) tabsToShow.push('learning');

    return {
      teachingCourses,
      mentoringCourses,
      learningCourses,
      hasTeachingCourses,
      hasMentoringCourses,
      hasLearningCourses,
      hasAnyCourses: hasTeachingCourses || hasMentoringCourses || hasLearningCourses,
      showSegmentedTabs,
      tabsToShow
    };
  }, [courses]);

  // Memoize initialActiveTab calculation
  const initialActiveTab = useMemo(() => {
    if (hasLearningCourses && !hasTeachingCourses && !hasMentoringCourses) return 'learning';
    if (hasMentoringCourses && !hasTeachingCourses && !hasLearningCourses) return 'mentoring';
    if (hasTeachingCourses) return 'teaching';
    if (hasMentoringCourses) return 'mentoring';
    return 'learning';
  }, [hasLearningCourses, hasTeachingCourses, hasMentoringCourses]);

  const [activeTab, setActiveTab] = useState<'teaching' | 'mentoring' | 'learning'>(initialActiveTab);
  const [hasSchool, setHasSchool] = useState<boolean | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  // Update school state based on API data
  useEffect(() => {
    if (schools && schools.length > 0) {
      setHasSchool(true);
      setSchoolId(schools[0].id);
    } else {
      setHasSchool(false);
    }
  }, [schools]);

  // Handle tab changes only when related data changes
  useEffect(() => {
    // If current tab is no longer available, switch to first available tab
    if (!tabsToShow.includes(activeTab) && tabsToShow.length > 0) {
      setActiveTab(tabsToShow[0] as 'teaching' | 'mentoring' | 'learning');
    }
  }, [tabsToShow, activeTab]);

  // Memoize event handlers
  const handleCreateCourseButtonClick = useCallback(() => {
    if (hasSchool && schoolId) {
      // If school already exists, show the course creation dialog
      setIsCreateCourseDialogOpen(true);
    } else {
      // If no school exists, redirect to school creation page
      router.push("/school/admin/create");
    }
  }, [hasSchool, schoolId, router]);

  // Handle success callback from CreateCourseDialog
  const handleCourseCreationSuccess = useCallback((courseData: { id: string; name: string }) => {
    if (hasSchool && schoolId) {
      // Redirect to the new course page - dialog will be unmounted during navigation
      router.push(`/school/admin/${schoolId}/courses/${courseData.id}`);
    } else {
      router.push("/school/admin/create");
    }
  }, [hasSchool, schoolId, router]);

  // Get current tab's courses
  const getCurrentTabCourses = () => {
    switch (activeTab) {
      case 'teaching':
        return teachingCourses;
      case 'mentoring':
        return mentoringCourses;
      case 'learning':
        return learningCourses;
      default:
        return [];
    }
  };

  // Get title for single role scenario
  const getSingleRoleTitle = () => {
    if (hasMentoringCourses && !hasTeachingCourses && !hasLearningCourses) {
      return "Courses you are mentoring";
    }
    return "Your courses";
  };

  return (
    <>
      <style jsx global>{`
        button:focus {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
        
        html, body {
          height: 100%;
          overflow-y: auto;
        }
      `}
      </style>

      <div className="min-h-screen bg-black text-white overflow-y-auto">
        {/* Use the reusable Header component */}
        <Header
          showCreateCourseButton={hasAnyCourses || (hasSchool ?? false)}
          showTryDemoButton={!hasLearningCourses}
        />

        {/* Main content */}
        <main className="max-w-6xl mx-auto pt-6 px-8 pb-12">
          {/* Loading state */}
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            </div>
          )}

          {/* Content when loaded */}
          {!isLoading && (
            <>
              {/* Segmented control for tabs */}
              {showSegmentedTabs && (
                <div className="flex justify-center mb-8">
                  <div className="inline-flex bg-[#222222] rounded-lg p-1 w-full sm:w-auto">
                    {tabsToShow.includes('teaching') && (
                      <button
                        className={`flex items-center justify-center px-1 xxs:px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm xxs:font-medium cursor-pointer flex-1 sm:flex-initial ${activeTab === 'teaching'
                          ? 'bg-[#333333] text-white'
                          : 'text-gray-400 hover:text-white'
                          }`}
                        onClick={() => setActiveTab('teaching')}
                      >
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 6.25278V19.2528M12 6.25278C10.8321 5.47686 9.24649 5 7.5 5C5.75351 5 4.16789 5.47686 3 6.25278V19.2528C4.16789 18.4769 5.75351 18 7.5 18C9.24649 18 10.8321 18.4769 12 19.2528M12 6.25278C13.1679 5.47686 14.7535 5 16.5 5C18.2465 5 19.8321 5.47686 21 6.25278V19.2528C19.8321 18.4769 18.2465 18 16.5 18C14.7535 18 13.1679 18.4769 12 19.2528" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Created by you
                      </button>
                    )}
                    {tabsToShow.includes('mentoring') && (
                      <button
                        className={`flex items-center justify-center px-1 xxs:px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm xxs:font-medium cursor-pointer flex-1 sm:flex-initial ${activeTab === 'mentoring'
                          ? 'bg-[#333333] text-white'
                          : 'text-gray-400 hover:text-white'
                          }`}
                        onClick={() => setActiveTab('mentoring')}
                      >
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Mentored by you
                      </button>
                    )}
                    {tabsToShow.includes('learning') && (
                      <button
                        className={`flex items-center justify-center px-1 xxs:px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm xxs:font-medium cursor-pointer flex-1 sm:flex-initial ${activeTab === 'learning'
                          ? 'bg-[#333333] text-white'
                          : 'text-gray-400 hover:text-white'
                          }`}
                        onClick={() => setActiveTab('learning')}
                      >
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Enrolled courses
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Display content based on courses availability */}
              <div className="mb-8">
                {!hasTeachingCourses && !hasMentoringCourses && !hasLearningCourses ? (
                  // No courses at all - show universal placeholder
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-medium mb-2">What if your next big idea became a course?</h2>
                    <p className="text-gray-400 mb-6">It might be easier than you think</p>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={handleCreateCourseButtonClick}
                        className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity inline-block cursor-pointer"
                      >
                        Create course
                      </button>
                    </div>
                  </div>
                ) : !showSegmentedTabs && (
                  // User has courses but only one role - show appropriate heading
                  <h2 className="text-2xl font-medium">
                    {getSingleRoleTitle()}
                  </h2>
                )}
              </div>

              {/* Course grid */}
              {hasAnyCourses && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getCurrentTabCourses().map((course) => (
                    <CourseCard
                      key={course.id}
                      course={{
                        ...course,
                        title: course.org?.slug ? `@${course.org.slug}/${course.title}` : course.title,
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Create Course Dialog */}
      <CreateCourseDialog
        open={isCreateCourseDialogOpen}
        onClose={() => setIsCreateCourseDialogOpen(false)}
        onSuccess={handleCourseCreationSuccess}
        schoolId={schoolId || undefined}
      />
    </>
  );
}
