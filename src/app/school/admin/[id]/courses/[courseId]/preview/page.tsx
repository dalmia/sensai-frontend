import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ClientPreviewWrapper from './ClientPreviewWrapper';
import { getPublishedCourseModules } from '@/lib/server-api';

export async function generateMetadata(
    { params }: { params: { id: string, courseId: string } }
): Promise<Metadata> {
    try {
        const courseResponse = await fetch(`${process.env.BACKEND_URL}/courses/${params.courseId}`, {
            cache: 'no-store'
        });

        if (!courseResponse.ok) {
            return {
                title: 'Course Preview - Not Found',
                description: 'The requested course could not be found.'
            };
        }

        const course = await courseResponse.json();

        return {
            title: `${course.name} - Course Preview`,
            description: `Preview of the course "${course.name}"`
        };
    } catch (error) {
        return {
            title: 'Course Preview',
            description: 'Preview of a course'
        };
    }
}

export default async function PreviewPage({ params }: { params: { id: string, courseId: string } }) {
    const orgId = params.id;
    const courseId = params.courseId;

    try {
        // Use the new getPublishedCourseModules function to fetch and transform course data
        const { courseData, modules } = await getPublishedCourseModules(courseId);

        return (
            <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors">
                {/* Preview announcement banner */}
                <div className="bg-gray-100 border-b border-gray-200 text-black dark:bg-[#111111] dark:border-gray-800 dark:text-white py-3 px-4 text-center shadow-sm">
                    <p className="font-light text-sm">You are viewing a preview of this course. This is how it will appear to learners.</p>
                </div>

                <div className="px-4 sm:px-8 py-8 sm:py-12 flex-1 flex flex-col h-full">
                    <div className="max-w-5xl mx-auto w-full flex flex-col flex-1">
                        <Suspense fallback={<div className="text-sm text-gray-600 dark:text-gray-300">Loading...</div>}>
                            {modules.length > 0 ? (
                                <>
                                    <h1 className="text-2xl sm:text-4xl font-light mb-8 sm:mb-16">{courseData.name}</h1>
                                    <ClientPreviewWrapper
                                        modules={modules}
                                    />
                                </>
                            ) : (
                                <div className="flex items-center justify-center flex-1">
                                    <div className="flex flex-col items-center justify-center text-center max-w-md">
                                        <h1 className="text-4xl font-light mb-6">Your learning adventure awaits!</h1>
                                        <p className="text-gray-600 dark:text-gray-300 text-lg">This course is still being crafted with care. Check back soon to begin your journey.</p>
                                    </div>
                                </div>
                            )}
                        </Suspense>
                    </div>
                </div>
            </div>
        );
    } catch (error) {
        console.error('Error fetching course data:', error);
        notFound();
    }
} 