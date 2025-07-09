import React from 'react';
import { render, waitFor } from '@testing-library/react';
import AdminLearnerViewPage, { generateMetadata } from '@/app/school/[id]/courses/[courseId]/learner-view/[learnerId]/page';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
    notFound: jest.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    })
}));

// Mock the ClientLearnerViewWrapper component
jest.mock('@/app/school/admin/[id]/courses/[courseId]/learner-view/[learnerId]/ClientLearnerViewWrapper', () => {
    return jest.fn(() => <div data-testid="client-learner-view-wrapper">Client Learner View Wrapper</div>);
});

// Mock the server API function
jest.mock('@/lib/server-api', () => ({
    getPublishedCourseModules: jest.fn()
}));

// Import the mocked functions to access them in tests
const { notFound } = require('next/navigation');
const mockClientLearnerViewWrapper = require('@/app/school/admin/[id]/courses/[courseId]/learner-view/[learnerId]/ClientLearnerViewWrapper');
const { getPublishedCourseModules } = require('@/lib/server-api');

// Mock global fetch for metadata generation and learner data
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = jest.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
});

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
    process.env = {
        ...originalEnv,
        BACKEND_URL: 'https://test-backend.com'
    };
});

afterAll(() => {
    process.env = originalEnv;
});

describe('AdminLearnerViewPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateMetadata function', () => {
        it('should generate correct metadata when both course and learner fetch succeed', async () => {
            const mockCourseData = { name: 'Advanced React Course' };
            const mockLearnerData = { email: 'learner@example.com' };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockCourseData)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockLearnerData)
                });

            const params = { id: 'school123', cohortId: 'cohort456', courseId: 'course789', learnerId: 'learner101' };
            const metadata = await generateMetadata({ params });

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch).toHaveBeenNthCalledWith(1,
                'https://test-backend.com/courses/course789',
                { cache: 'no-store' }
            );
            expect(mockFetch).toHaveBeenNthCalledWith(2,
                'https://test-backend.com/users/learner101',
                { cache: 'no-store' }
            );
            expect(metadata).toEqual({
                title: 'Viewing Advanced React Course as learner@example.com',
                description: 'Admin view of course "Advanced React Course" as experienced by learner@example.com'
            });
        });

        it('should generate fallback metadata with learner ID when learner has no email', async () => {
            const mockCourseData = { name: 'Test Course' };
            const mockLearnerData = { id: 'learner101' }; // No email

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockCourseData)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockLearnerData)
                });

            const params = { id: 'school', cohortId: 'cohort', courseId: 'course', learnerId: 'learner101' };
            const metadata = await generateMetadata({ params });

            expect(metadata).toEqual({
                title: 'Viewing Test Course as Learner #learner101',
                description: 'Admin view of course "Test Course" as experienced by Learner #learner101'
            });
        });

        it('should generate not found metadata when course fetch fails', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 404
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue({ email: 'test@example.com' })
                });

            const params = { id: 'school', cohortId: 'cohort', courseId: 'invalid', learnerId: 'learner' };
            const metadata = await generateMetadata({ params });

            expect(metadata).toEqual({
                title: 'Admin Learner View - Not Found',
                description: 'The requested resource could not be found.'
            });
        });

        it('should generate not found metadata when learner fetch fails', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue({ name: 'Test Course' })
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 404
                });

            const params = { id: 'school', cohortId: 'cohort', courseId: 'course', learnerId: 'invalid' };
            const metadata = await generateMetadata({ params });

            expect(metadata).toEqual({
                title: 'Admin Learner View - Not Found',
                description: 'The requested resource could not be found.'
            });
        });

        it('should generate fallback metadata when fetch throws error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const params = { id: 'school', cohortId: 'cohort', courseId: 'course', learnerId: 'learner' };
            const metadata = await generateMetadata({ params });

            expect(metadata).toEqual({
                title: 'Admin Learner View',
                description: 'Admin view of a course as experienced by a learner'
            });
        });

        it('should handle JSON parsing errors gracefully', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockRejectedValue(new Error('JSON parse error'))
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue({ email: 'test@example.com' })
                });

            const params = { id: 'school', cohortId: 'cohort', courseId: 'course', learnerId: 'learner' };
            const metadata = await generateMetadata({ params });

            expect(metadata).toEqual({
                title: 'Admin Learner View',
                description: 'Admin view of a course as experienced by a learner'
            });
        });
    });

    describe('AdminLearnerViewPage component', () => {
        it('should render course with modules when data is available', async () => {
            const mockCourseData = { name: 'React Fundamentals' };
            const mockModules = [
                { id: 1, name: 'Module 1', items: [] },
                { id: 2, name: 'Module 2', items: [] }
            ];
            const mockLearnerData = { email: 'student@example.com' };

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(mockLearnerData)
            });

            const params = { id: 'school123', courseId: 'course456', learnerId: 'learner789' };
            const searchParams = { cohortId: 'cohort101' };
            const { getByText, getByTestId } = render(await AdminLearnerViewPage({ params, searchParams }));

            expect(getPublishedCourseModules).toHaveBeenCalledWith('course456');
            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/users/learner789',
                { cache: 'no-store' }
            );
            expect(getByText((content, element) => {
                // Check if this is the specific p element with the banner text
                return element?.tagName === 'P' &&
                    element?.className === 'font-light text-sm' &&
                    element?.textContent === 'You are viewing this course as student@example.com';
            })).toBeInTheDocument();
            expect(getByText('React Fundamentals')).toBeInTheDocument();
            expect(getByTestId('client-learner-view-wrapper')).toBeInTheDocument();
            expect(mockClientLearnerViewWrapper).toHaveBeenCalledWith(
                {
                    modules: mockModules,
                    learnerId: 'learner789',
                    cohortId: 'cohort101',
                    courseId: 'course456',
                    isAdminView: true
                },
                undefined
            );
            expect(notFound).not.toHaveBeenCalled();
        });

        it('should render empty state when no modules available', async () => {
            const mockCourseData = { name: 'Empty Course' };
            const mockModules: any[] = [];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ email: 'student@example.com' })
            });

            const params = { id: 'school123', courseId: 'course456', learnerId: 'learner789' };
            const searchParams = { cohortId: 'cohort101' };
            const { getByText, queryByTestId } = render(await AdminLearnerViewPage({ params, searchParams }));

            expect(getByText((content, element) => {
                // Check if this is the specific p element with the banner text
                return element?.tagName === 'P' &&
                    element?.className === 'font-light text-sm' &&
                    element?.textContent === 'You are viewing this course as student@example.com';
            })).toBeInTheDocument();
            expect(getByText('No content available')).toBeInTheDocument();
            expect(getByText('This course doesn\'t have any content yet.')).toBeInTheDocument();
            expect(queryByTestId('client-learner-view-wrapper')).not.toBeInTheDocument();
            expect(mockClientLearnerViewWrapper).not.toHaveBeenCalled();
            expect(notFound).not.toHaveBeenCalled();
        });

        it('should handle learner fetch failure gracefully', async () => {
            const mockCourseData = { name: 'Test Course' };
            const mockModules = [{ id: 1, name: 'Module 1', items: [] }];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            const params = { id: 'school123', courseId: 'course456', learnerId: 'invalid' };
            const searchParams = { cohortId: 'cohort101' };
            const { getByText, getByTestId } = render(await AdminLearnerViewPage({ params, searchParams }));

            expect(getByText('You are viewing this course as')).toBeInTheDocument();
            expect(getByText('Test Course')).toBeInTheDocument();
            expect(getByTestId('client-learner-view-wrapper')).toBeInTheDocument();
        });

        it('should call notFound when getPublishedCourseModules throws error', async () => {
            getPublishedCourseModules.mockRejectedValueOnce(new Error('Course not found'));

            const params = { id: 'school123', courseId: 'invalid', learnerId: 'learner789' };
            const searchParams = { cohortId: 'cohort101' };

            await expect(AdminLearnerViewPage({ params, searchParams })).rejects.toThrow('NEXT_NOT_FOUND');

            expect(getPublishedCourseModules).toHaveBeenCalledWith('invalid');
            expect(console.error).toHaveBeenCalledWith('Error fetching data:', expect.any(Error));
            expect(notFound).toHaveBeenCalled();
        });

        it('should handle missing searchParams gracefully', async () => {
            const mockCourseData = { name: 'Test Course' };
            const mockModules = [{ id: 1, name: 'Module 1', items: [] }];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ email: 'test@example.com' })
            });

            const params = { id: 'school123', courseId: 'course456', learnerId: 'learner789' };
            const searchParams = undefined as any;
            const { getByTestId } = render(await AdminLearnerViewPage({ params, searchParams }));

            expect(getByTestId('client-learner-view-wrapper')).toBeInTheDocument();
            expect(mockClientLearnerViewWrapper).toHaveBeenCalledWith(
                expect.objectContaining({
                    cohortId: undefined
                }),
                undefined
            );
        });
    });

    describe('Component structure and styling', () => {
        it('should render correct HTML structure with styling classes', async () => {
            const mockCourseData = { name: 'Styled Course' };
            const mockModules = [{ id: 1, name: 'Module 1', items: [] }];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ email: 'student@example.com' })
            });

            const params = { id: 'school123', courseId: 'course456', learnerId: 'learner789' };
            const searchParams = { cohortId: 'cohort101' };
            const { container } = render(await AdminLearnerViewPage({ params, searchParams }));

            // Check main container styling
            const mainDiv = container.querySelector('.min-h-screen.bg-black');
            expect(mainDiv).toBeInTheDocument();

            // Check banner styling
            const banner = container.querySelector('.bg-\\[\\#111111\\].border-b.border-gray-800');
            expect(banner).toBeInTheDocument();

            // Check content container styling
            const contentContainer = container.querySelector('.px-4.sm\\:px-8.py-8.sm\\:py-12');
            expect(contentContainer).toBeInTheDocument();

            // Check max-width container
            const maxWidthContainer = container.querySelector('.max-w-5xl.mx-auto');
            expect(maxWidthContainer).toBeInTheDocument();
        });

        it('should render banner with correct text and styling', async () => {
            const mockCourseData = { name: 'Test Course' };
            const mockModules = [{ id: 1, name: 'Module 1', items: [] }];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ email: 'admin@example.com' })
            });

            const params = { id: 'school123', courseId: 'course456', learnerId: 'learner789' };
            const searchParams = { cohortId: 'cohort101' };
            const { container } = render(await AdminLearnerViewPage({ params, searchParams }));

            const bannerText = container.querySelector('p.font-light.text-sm');
            expect(bannerText).toBeInTheDocument();
            expect(bannerText).toHaveTextContent('You are viewing this course as admin@example.com');

            const bannerSpan = container.querySelector('span.font-medium');
            expect(bannerSpan).toBeInTheDocument();
            expect(bannerSpan).toHaveTextContent('admin@example.com');
        });
    });

    describe('Parameter handling', () => {
        it('should handle different parameter formats', async () => {
            const mockCourseData = { name: 'Param Test Course' };
            const mockModules = [{ id: 1, name: 'Module 1', items: [] }];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ email: 'test@example.com' })
            });

            const params = { id: '123', courseId: '456', learnerId: '789' };
            const searchParams = { cohortId: '101' };
            await AdminLearnerViewPage({ params, searchParams });

            expect(getPublishedCourseModules).toHaveBeenCalledWith('456');
            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/users/789',
                { cache: 'no-store' }
            );
        });

        it('should handle UUID parameters', async () => {
            const mockCourseData = { name: 'UUID Course' };
            const mockModules = [{ id: 1, name: 'Module 1', items: [] }];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ email: 'uuid@example.com' })
            });

            const params = {
                id: 'school-uuid-123',
                courseId: 'course-uuid-456',
                learnerId: 'learner-uuid-789'
            };
            const searchParams = { cohortId: 'cohort-uuid-101' };
            await AdminLearnerViewPage({ params, searchParams });

            expect(getPublishedCourseModules).toHaveBeenCalledWith('course-uuid-456');
            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/users/learner-uuid-789',
                { cache: 'no-store' }
            );
        });
    });

    describe('Environment variable usage', () => {
        it('should use BACKEND_URL environment variable', async () => {
            process.env.BACKEND_URL = 'https://custom-backend.example.com';

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: { name: 'Test' },
                modules: []
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ email: 'test@example.com' })
            });

            const params = { id: 'school', courseId: 'course', learnerId: 'test-learner' };
            const searchParams = { cohortId: 'cohort' };
            await AdminLearnerViewPage({ params, searchParams });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://custom-backend.example.com/users/test-learner',
                { cache: 'no-store' }
            );
        });
    });

    describe('Error logging', () => {
        it('should log errors when data fetching fails', async () => {
            const fetchError = new Error('Data fetch failed');
            getPublishedCourseModules.mockRejectedValueOnce(fetchError);

            const params = { id: 'school', courseId: 'course', learnerId: 'learner' };
            const searchParams = { cohortId: 'cohort' };

            await expect(AdminLearnerViewPage({ params, searchParams })).rejects.toThrow('NEXT_NOT_FOUND');

            expect(console.error).toHaveBeenCalledWith('Error fetching data:', fetchError);
        });

        it('should not log errors when data fetching succeeds', async () => {
            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: { name: 'Success Course' },
                modules: []
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ email: 'success@example.com' })
            });

            const params = { id: 'school', courseId: 'course', learnerId: 'learner' };
            const searchParams = { cohortId: 'cohort' };
            await AdminLearnerViewPage({ params, searchParams });

            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('Empty state rendering', () => {
        it('should render empty state with correct styling and text', async () => {
            const mockCourseData = { name: 'Empty Course' };
            const mockModules: any[] = [];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ email: 'empty@example.com' })
            });

            const params = { id: 'school123', courseId: 'course456', learnerId: 'learner789' };
            const searchParams = { cohortId: 'cohort101' };
            const { container } = render(await AdminLearnerViewPage({ params, searchParams }));

            // Check empty state container styling
            const emptyStateContainer = container.querySelector('.flex.items-center.justify-center.flex-1');
            expect(emptyStateContainer).toBeInTheDocument();

            // Check inner container styling
            const innerContainer = container.querySelector('.flex.flex-col.items-center.justify-center.text-center.max-w-md');
            expect(innerContainer).toBeInTheDocument();

            // Check title styling
            const title = container.querySelector('h1.text-4xl.font-light.text-white.mb-6');
            expect(title).toBeInTheDocument();
            expect(title).toHaveTextContent('No content available');

            // Check description styling
            const description = container.querySelector('p.text-gray-400.text-lg');
            expect(description).toBeInTheDocument();
            expect(description).toHaveTextContent('This course doesn\'t have any content yet.');
        });
    });
}); 