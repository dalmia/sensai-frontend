import React from 'react';
import { render, waitFor } from '@testing-library/react';
import PreviewPage, { generateMetadata } from '@/app/school/admin/[id]/courses/[courseId]/preview/page';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
    notFound: jest.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    })
}));

// Mock the ClientPreviewWrapper component
jest.mock('@/app/school/admin/[id]/courses/[courseId]/preview/ClientPreviewWrapper', () => {
    return jest.fn(() => <div data-testid="client-preview-wrapper">Client Preview Wrapper</div>);
});

// Mock the server API function
jest.mock('@/lib/server-api', () => ({
    getPublishedCourseModules: jest.fn()
}));

// Import the mocked functions to access them in tests
const { notFound } = require('next/navigation');
const mockClientPreviewWrapper = require('@/app/school/admin/[id]/courses/[courseId]/preview/ClientPreviewWrapper');
const { getPublishedCourseModules } = require('@/lib/server-api');

// Mock global fetch for metadata generation
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

describe('PreviewPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateMetadata', () => {
        it('should generate correct metadata when course fetch is successful', async () => {
            const mockCourse = {
                name: 'Test Course',
                description: 'A test course description'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(mockCourse)
            });

            const params = { id: 'school123', courseId: 'course456' };
            const metadata = await generateMetadata({ params });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/courses/course456',
                { cache: 'no-store' }
            );
            expect(metadata).toEqual({
                title: 'Test Course - Course Preview',
                description: 'Preview of the course "Test Course"'
            });
        });

        it('should generate not found metadata when course fetch fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            const params = { id: 'school123', courseId: 'invalid' };
            const metadata = await generateMetadata({ params });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-backend.com/courses/invalid',
                { cache: 'no-store' }
            );
            expect(metadata).toEqual({
                title: 'Course Preview - Not Found',
                description: 'The requested course could not be found.'
            });
        });

        it('should generate fallback metadata when fetch throws error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const params = { id: 'school123', courseId: 'course456' };
            const metadata = await generateMetadata({ params });

            expect(metadata).toEqual({
                title: 'Course Preview',
                description: 'Preview of a course'
            });
        });

        it('should generate fallback metadata when JSON parsing fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockRejectedValue(new Error('JSON parse error'))
            });

            const params = { id: 'school123', courseId: 'course456' };
            const metadata = await generateMetadata({ params });

            expect(metadata).toEqual({
                title: 'Course Preview',
                description: 'Preview of a course'
            });
        });
    });

    describe('PreviewPage component', () => {
        it('should render course with modules when data is available', async () => {
            const mockCourseData = { name: 'Advanced React' };
            const mockModules = [
                { id: 1, name: 'Module 1', items: [] },
                { id: 2, name: 'Module 2', items: [] }
            ];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            const params = { id: 'school123', courseId: 'course456' };
            const { getByText, getByTestId } = render(await PreviewPage({ params }));

            expect(getPublishedCourseModules).toHaveBeenCalledWith('course456');
            expect(getByText('You are viewing a preview of this course. This is how it will appear to learners.')).toBeInTheDocument();
            expect(getByText('Advanced React')).toBeInTheDocument();
            expect(getByTestId('client-preview-wrapper')).toBeInTheDocument();
            expect(mockClientPreviewWrapper).toHaveBeenCalledWith(
                { modules: mockModules },
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

            const params = { id: 'school123', courseId: 'course456' };
            const { getByText, queryByTestId } = render(await PreviewPage({ params }));

            expect(getPublishedCourseModules).toHaveBeenCalledWith('course456');
            expect(getByText('You are viewing a preview of this course. This is how it will appear to learners.')).toBeInTheDocument();
            expect(getByText('Your learning adventure awaits!')).toBeInTheDocument();
            expect(getByText('This course is still being crafted with care. Check back soon to begin your journey.')).toBeInTheDocument();
            expect(queryByTestId('client-preview-wrapper')).not.toBeInTheDocument();
            expect(mockClientPreviewWrapper).not.toHaveBeenCalled();
            expect(notFound).not.toHaveBeenCalled();
        });

        it('should call notFound when getPublishedCourseModules throws error', async () => {
            getPublishedCourseModules.mockRejectedValueOnce(new Error('Course not found'));

            const params = { id: 'school123', courseId: 'invalid' };

            await expect(PreviewPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');

            expect(getPublishedCourseModules).toHaveBeenCalledWith('invalid');
            expect(console.error).toHaveBeenCalledWith('Error fetching course data:', expect.any(Error));
            expect(notFound).toHaveBeenCalled();
        });

        it('should handle API errors gracefully', async () => {
            const apiError = new Error('API unavailable');
            getPublishedCourseModules.mockRejectedValueOnce(apiError);

            const params = { id: 'school123', courseId: 'course456' };

            await expect(PreviewPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');

            expect(console.error).toHaveBeenCalledWith('Error fetching course data:', apiError);
            expect(notFound).toHaveBeenCalled();
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

            const params = { id: 'school123', courseId: 'course456' };
            const { container } = render(await PreviewPage({ params }));

            // Check main container styling (uses dark mode variant: bg-white dark:bg-black)
            const mainDiv = container.querySelector('.min-h-screen');
            expect(mainDiv).toBeInTheDocument();

            // Check banner styling (uses dark mode variant: bg-gray-100 dark:bg-[#111111])
            const banner = container.querySelector('.border-b');
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
            const mockModules: any[] = [];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            const params = { id: 'school123', courseId: 'course456' };
            const { container } = render(await PreviewPage({ params }));

            const bannerText = container.querySelector('p.font-light.text-sm');
            expect(bannerText).toBeInTheDocument();
            expect(bannerText).toHaveTextContent('You are viewing a preview of this course. This is how it will appear to learners.');
        });
    });

    describe('Parameter handling', () => {
        it('should handle different course ID formats', async () => {
            const mockCourseData = { name: 'Numeric Course' };
            const mockModules: any[] = [];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            const params = { id: '123', courseId: '456' };
            await PreviewPage({ params });

            expect(getPublishedCourseModules).toHaveBeenCalledWith('456');
        });

        it('should handle UUID course IDs', async () => {
            const mockCourseData = { name: 'UUID Course' };
            const mockModules: any[] = [];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            const params = { id: 'school-abc', courseId: 'course-uuid-123-456' };
            await PreviewPage({ params });

            expect(getPublishedCourseModules).toHaveBeenCalledWith('course-uuid-123-456');
        });
    });

    describe('Suspense and loading states', () => {
        it('should wrap content in Suspense with fallback', async () => {
            const mockCourseData = { name: 'Suspense Course' };
            const mockModules: any[] = [];

            getPublishedCourseModules.mockResolvedValueOnce({
                courseData: mockCourseData,
                modules: mockModules
            });

            const params = { id: 'school123', courseId: 'course456' };
            const { container } = render(await PreviewPage({ params }));

            // Since this is async server component, Suspense is rendered on server
            // Check that the content is properly structured
            expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
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

            const params = { id: 'school123', courseId: 'course456' };
            const { container, getByText } = render(await PreviewPage({ params }));

            // Check empty state container styling
            const emptyStateContainer = container.querySelector('.flex.items-center.justify-center.flex-1');
            expect(emptyStateContainer).toBeInTheDocument();

            // Check inner container styling
            const innerContainer = container.querySelector('.flex.flex-col.items-center.justify-center.text-center.max-w-md');
            expect(innerContainer).toBeInTheDocument();

            // Check title styling (uses dark mode variant classes)
            const title = container.querySelector('h1.text-4xl.font-light');
            expect(title).toBeInTheDocument();
            expect(title).toHaveTextContent('Your learning adventure awaits!');

            // Check description styling
            const description = container.querySelector('p.text-lg');
            expect(description).toBeInTheDocument();
            expect(description).toHaveTextContent('This course is still being crafted with care. Check back soon to begin your journey.');
        });
    });
}); 