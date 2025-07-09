import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ClientLearnerViewWrapper from './ClientLearnerViewWrapper';
import { getPublishedCourseModules } from '@/lib/server-api';


export async function generateMetadata(
    { params }: { params: { id: string, cohortId: string, courseId: string, learnerId: string } }
): Promise<Metadata> {
    try {
        // Fetch course and learner data
        const [courseResponse, learnerResponse] = await Promise.all([
            fetch(`${process.env.BACKEND_URL}/courses/${params.courseId}`, {
                cache: 'no-store'
            }),
            fetch(`${process.env.BACKEND_URL}/users/${params.learnerId}`, {
                cache: 'no-store'
            })
        ]);

        if (!courseResponse.ok || !learnerResponse.ok) {
            return {
                title: 'Admin Learner View - Not Found',
                description: 'The requested resource could not be found.'
            };
        }

        const course = await courseResponse.json();
        const learner = await learnerResponse.json();

        return {
            title: `Viewing ${course.name} as ${learner.email || `Learner #${params.learnerId}`}`,
            description: `Admin view of course "${course.name}" as experienced by ${learner.email || `Learner #${params.learnerId}`}`
        };
    } catch (error) {
        return {
            title: 'Admin Learner View',
            description: 'Admin view of a course as experienced by a learner'
        };
    }
}

export default async function AdminLearnerViewPage({
    params,
    searchParams
}: {
    params: { id: string, courseId: string, learnerId: string }
    searchParams: { cohortId: string }
}) {
    const { id: schoolId, courseId, learnerId } = params;
    const { cohortId } = searchParams || {};

    try {
        // Use the new getPublishedCourseModules function to fetch and transform course data
        const { courseData, modules } = await getPublishedCourseModules(courseId);

        // Fetch learner data
        const learnerResponse = await fetch(`${process.env.BACKEND_URL}/users/${learnerId}`, {
            cache: 'no-store'
        });

        let learnerName = ''

        if (learnerResponse.ok) {
            const learnerData = await learnerResponse.json();
            learnerName = learnerName || learnerData.email;
        }

        return (
            <div className="min-h-screen bg-black">
                {/* Admin learner view banner */}
                <div className="bg-[#111111] border-b border-gray-800 text-white py-3 px-4 flex justify-center items-center shadow-sm">
                    <p className="font-light text-sm">
                        You are viewing this course as <span className="font-medium">{learnerName}</span>
                    </p>
                </div>

                <div className="px-4 sm:px-8 py-8 sm:py-12 flex-1 flex flex-col h-full">
                    <div className="max-w-5xl mx-auto w-full flex flex-col flex-1">
                        <Suspense fallback={<div>Loading...</div>}>
                            {modules.length > 0 ? (
                                <>
                                    <h1 className="text-2xl sm:text-4xl font-light text-white mb-8 sm:mb-16">{courseData.name}</h1>
                                    <ClientLearnerViewWrapper
                                        modules={modules}
                                        learnerId={learnerId}
                                        cohortId={cohortId}
                                        courseId={courseId}
                                        isAdminView={true}
                                    />
                                </>
                            ) : (
                                <div className="flex items-center justify-center flex-1">
                                    <div className="flex flex-col items-center justify-center text-center max-w-md">
                                        <h1 className="text-4xl font-light text-white mb-6">
                                            No content available
                                        </h1>
                                        <p className="text-gray-400 text-lg">
                                            This course doesn't have any content yet.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </Suspense>
                    </div>
                </div>
            </div>
        );
    } catch (error) {
        console.error('Error fetching data:', error);
        notFound();
    }
} 