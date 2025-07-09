import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Home from '@/app/page';
import { useCourses, useSchools } from '@/lib/api';

// Mock dependencies
jest.mock('next-auth/react', () => ({
    useSession: jest.fn(),
}));

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
    useCourses: jest.fn(),
    useSchools: jest.fn(),
}));

jest.mock('@/components/layout/header', () => ({
    Header: function MockHeader({ showCreateCourseButton, showTryDemoButton }: any) {
        return (
            <header data-testid="header">
                <div data-testid="show-create-course-button">{showCreateCourseButton.toString()}</div>
                <div data-testid="show-try-demo-button">{showTryDemoButton.toString()}</div>
            </header>
        );
    }
}));
jest.mock('@/components/CourseCard', () => {
    return function MockCourseCard({ course }: any) {
        return <div data-testid={`course-card-${course.id}`}>{course.title}</div>;
    };
});
jest.mock('@/components/CreateCourseDialog', () => {
    return function MockCreateCourseDialog({ open, onClose, onSuccess, schoolId }: any) {
        return open ? (
            <div data-testid="create-course-dialog">
                <button onClick={() => onSuccess({ id: 'new-course', name: 'New Course' })}>
                    Success
                </button>
                <button onClick={onClose}>Close</button>
                <div data-testid="dialog-school-id">{schoolId}</div>
            </div>
        ) : null;
    };
});

const mockPush = jest.fn();
const mockUpdate = jest.fn();

describe('Home Page', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock hooks
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            prefetch: jest.fn(),
            replace: jest.fn(),
            back: jest.fn(),
            forward: jest.fn(),
            refresh: jest.fn(),
        });
    });

    describe('Loading State', () => {
        it('should show loading spinner when courses are loading', () => {
            (useSession as jest.Mock).mockReturnValue({
                data: null,
                status: 'loading',
                update: mockUpdate
            });
            (useCourses as jest.Mock).mockReturnValue({ courses: [], isLoading: true, error: null });
            (useSchools as jest.Mock).mockReturnValue({ schools: [], isLoading: false, error: null });

            render(<Home />);

            expect(screen.getByTestId('header')).toBeInTheDocument();
            expect(screen.getByRole('main')).toBeInTheDocument();
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });
    });

    describe('No Courses State', () => {
        beforeEach(() => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useCourses as jest.Mock).mockReturnValue({ courses: [], isLoading: false, error: null });
            (useSchools as jest.Mock).mockReturnValue({ schools: [], isLoading: false, error: null });
        });

        it('should show welcome message when user has no courses', () => {
            render(<Home />);

            expect(screen.getByText('What if your next big idea became a course?')).toBeInTheDocument();
            expect(screen.getByText('It might be easier than you think')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Create course' })).toBeInTheDocument();
        });

        it('should navigate to school creation when create course is clicked and no school exists', () => {
            render(<Home />);

            const createButton = screen.getByRole('button', { name: 'Create course' });
            fireEvent.click(createButton);

            expect(mockPush).toHaveBeenCalledWith('/school/admin/create');
        });

        it('should open create course dialog when school exists', () => {
            (useSchools as jest.Mock).mockReturnValue({
                schools: [{ id: 'school-1', name: 'Test School' }],
                isLoading: false,
                error: null
            });

            render(<Home />);

            const createButton = screen.getByRole('button', { name: 'Create course' });
            fireEvent.click(createButton);

            expect(screen.getByTestId('create-course-dialog')).toBeInTheDocument();
            expect(screen.getByTestId('dialog-school-id')).toHaveTextContent('school-1');
        });
    });

    describe('Courses Display', () => {
        const mockTeachingCourses = [
            {
                id: 'course-1',
                title: 'Teaching Course 1',
                role: 'admin',
                org: { id: 1, name: 'Test Org', slug: 'test-org' },
                description: 'Test course description',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'course-2',
                title: 'Teaching Course 2',
                role: 'admin',
                org: undefined,
                description: 'Test course description',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        ];

        const mockLearningCourses = [
            {
                id: 'course-3',
                title: 'Learning Course 1',
                role: 'student',
                org: undefined,
                description: 'Test course description',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'course-4',
                title: 'Learning Course 2',
                role: 'student',
                org: undefined,
                description: 'Test course description',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        ];

        const mockMentoringCourses = [
            {
                id: 'course-5',
                title: 'Mentoring Course 1',
                role: 'mentor',
                org: { id: 2, name: 'Mentor Org', slug: 'mentor-org' },
                description: 'Test mentoring course description',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'course-6',
                title: 'Mentoring Course 2',
                role: 'mentor',
                org: undefined,
                description: 'Test mentoring course description',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        ];

        beforeEach(() => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [{ id: 'school-1', name: 'Test School' }],
                isLoading: false,
                error: null
            });
        });

        describe('Teaching Courses Only', () => {
            beforeEach(() => {
                (useCourses as jest.Mock).mockReturnValue({
                    courses: mockTeachingCourses,
                    isLoading: false,
                    error: null
                });
            });

            it('should display teaching courses without tabs', () => {
                render(<Home />);

                expect(screen.getByText('Your courses')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-1')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-2')).toBeInTheDocument();

                // Should not show tabs
                expect(screen.queryByText('Created by you')).not.toBeInTheDocument();
                expect(screen.queryByText('Enrolled courses')).not.toBeInTheDocument();
            });

            it('should format course titles with org slug', () => {
                render(<Home />);

                expect(screen.getByText('@test-org/Teaching Course 1')).toBeInTheDocument();
                expect(screen.getByText('Teaching Course 2')).toBeInTheDocument();
            });
        });

        describe('Learning Courses Only', () => {
            beforeEach(() => {
                (useCourses as jest.Mock).mockReturnValue({
                    courses: mockLearningCourses,
                    isLoading: false,
                    error: null
                });
            });

            it('should display learning courses without tabs', () => {
                render(<Home />);

                expect(screen.getByText('Your courses')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-3')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-4')).toBeInTheDocument();

                // Should not show tabs
                expect(screen.queryByText('Created by you')).not.toBeInTheDocument();
                expect(screen.queryByText('Enrolled courses')).not.toBeInTheDocument();
            });
        });

        describe('Mentoring Courses Only', () => {
            beforeEach(() => {
                (useCourses as jest.Mock).mockReturnValue({
                    courses: mockMentoringCourses,
                    isLoading: false,
                    error: null
                });
            });

            it('should display mentoring courses without tabs', () => {
                render(<Home />);

                expect(screen.getByText('Courses you are mentoring')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-5')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-6')).toBeInTheDocument();

                // Should not show tabs
                expect(screen.queryByText('Created by you')).not.toBeInTheDocument();
                expect(screen.queryByText('Enrolled courses')).not.toBeInTheDocument();
                expect(screen.queryByText('Mentored by you')).not.toBeInTheDocument();
            });

            it('should format mentoring course titles with org slug', () => {
                render(<Home />);

                expect(screen.getByText('@mentor-org/Mentoring Course 1')).toBeInTheDocument();
                expect(screen.getByText('Mentoring Course 2')).toBeInTheDocument();
            });
        });

        describe('Teaching and Mentoring Courses', () => {
            beforeEach(() => {
                (useCourses as jest.Mock).mockReturnValue({
                    courses: [...mockTeachingCourses, ...mockMentoringCourses],
                    isLoading: false,
                    error: null
                });
            });

            it('should show tabs when user has teaching and mentoring courses', () => {
                render(<Home />);

                expect(screen.getByText('Created by you')).toBeInTheDocument();
                expect(screen.getByText('Mentored by you')).toBeInTheDocument();

                // Should not show "Your courses" heading
                expect(screen.queryByText('Your courses')).not.toBeInTheDocument();
                expect(screen.queryByText('Enrolled courses')).not.toBeInTheDocument();
            });

            it('should default to teaching tab when both teaching and mentoring exist', () => {
                render(<Home />);

                const teachingTab = screen.getByText('Created by you').closest('button');
                const mentoringTab = screen.getByText('Mentored by you').closest('button');

                expect(teachingTab).toHaveClass('bg-[#333333]');
                expect(mentoringTab).toHaveClass('text-gray-400');

                // Should show teaching courses
                expect(screen.getByTestId('course-card-course-1')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-2')).toBeInTheDocument();
                expect(screen.queryByTestId('course-card-course-5')).not.toBeInTheDocument();
            });

            it('should switch to mentoring tab when clicked', () => {
                render(<Home />);

                const mentoringTab = screen.getByText('Mentored by you').closest('button');
                fireEvent.click(mentoringTab!);

                expect(mentoringTab).toHaveClass('bg-[#333333]');

                // Should show mentoring courses
                expect(screen.getByTestId('course-card-course-5')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-6')).toBeInTheDocument();
                expect(screen.queryByTestId('course-card-course-1')).not.toBeInTheDocument();
            });
        });

        describe('Mentoring and Learning Courses', () => {
            beforeEach(() => {
                (useCourses as jest.Mock).mockReturnValue({
                    courses: [...mockMentoringCourses, ...mockLearningCourses],
                    isLoading: false,
                    error: null
                });
            });

            it('should show tabs when user has mentoring and learning courses', () => {
                render(<Home />);

                expect(screen.getByText('Mentored by you')).toBeInTheDocument();
                expect(screen.getByText('Enrolled courses')).toBeInTheDocument();

                // Should not show "Your courses" heading
                expect(screen.queryByText('Your courses')).not.toBeInTheDocument();
                expect(screen.queryByText('Created by you')).not.toBeInTheDocument();
            });

            it('should default to mentoring tab when only mentoring and learning exist', () => {
                render(<Home />);

                const mentoringTab = screen.getByText('Mentored by you').closest('button');
                const learningTab = screen.getByText('Enrolled courses').closest('button');

                expect(mentoringTab).toHaveClass('bg-[#333333]');
                expect(learningTab).toHaveClass('text-gray-400');

                // Should show mentoring courses
                expect(screen.getByTestId('course-card-course-5')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-6')).toBeInTheDocument();
                expect(screen.queryByTestId('course-card-course-3')).not.toBeInTheDocument();
            });

            it('should switch to learning tab when clicked', () => {
                render(<Home />);

                const learningTab = screen.getByText('Enrolled courses').closest('button');
                fireEvent.click(learningTab!);

                expect(learningTab).toHaveClass('bg-[#333333]');

                // Should show learning courses
                expect(screen.getByTestId('course-card-course-3')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-4')).toBeInTheDocument();
                expect(screen.queryByTestId('course-card-course-5')).not.toBeInTheDocument();
            });
        });

        describe('All Three Course Types', () => {
            beforeEach(() => {
                (useCourses as jest.Mock).mockReturnValue({
                    courses: [...mockTeachingCourses, ...mockMentoringCourses, ...mockLearningCourses],
                    isLoading: false,
                    error: null
                });
            });

            it('should show all three tabs when user has all course types', () => {
                render(<Home />);

                expect(screen.getByText('Created by you')).toBeInTheDocument();
                expect(screen.getByText('Mentored by you')).toBeInTheDocument();
                expect(screen.getByText('Enrolled courses')).toBeInTheDocument();

                // Should not show "Your courses" heading
                expect(screen.queryByText('Your courses')).not.toBeInTheDocument();
            });

            it('should default to teaching tab when all course types exist', () => {
                render(<Home />);

                const teachingTab = screen.getByText('Created by you').closest('button');
                const mentoringTab = screen.getByText('Mentored by you').closest('button');
                const learningTab = screen.getByText('Enrolled courses').closest('button');

                expect(teachingTab).toHaveClass('bg-[#333333]');
                expect(mentoringTab).toHaveClass('text-gray-400');
                expect(learningTab).toHaveClass('text-gray-400');

                // Should show teaching courses
                expect(screen.getByTestId('course-card-course-1')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-2')).toBeInTheDocument();
                expect(screen.queryByTestId('course-card-course-5')).not.toBeInTheDocument();
                expect(screen.queryByTestId('course-card-course-3')).not.toBeInTheDocument();
            });

            it('should switch between all three tabs correctly', () => {
                render(<Home />);

                // Switch to mentoring tab
                const mentoringTab = screen.getByText('Mentored by you').closest('button');
                fireEvent.click(mentoringTab!);

                expect(mentoringTab).toHaveClass('bg-[#333333]');
                expect(screen.getByTestId('course-card-course-5')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-6')).toBeInTheDocument();

                // Switch to learning tab
                const learningTab = screen.getByText('Enrolled courses').closest('button');
                fireEvent.click(learningTab!);

                expect(learningTab).toHaveClass('bg-[#333333]');
                expect(screen.getByTestId('course-card-course-3')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-4')).toBeInTheDocument();

                // Switch back to teaching tab
                const teachingTab = screen.getByText('Created by you').closest('button');
                fireEvent.click(teachingTab!);

                expect(teachingTab).toHaveClass('bg-[#333333]');
                expect(screen.getByTestId('course-card-course-1')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-2')).toBeInTheDocument();
            });
        });

        describe('Both Teaching and Learning Courses', () => {
            beforeEach(() => {
                (useCourses as jest.Mock).mockReturnValue({
                    courses: [...mockTeachingCourses, ...mockLearningCourses],
                    isLoading: false,
                    error: null
                });
            });

            it('should show tabs when user has both teaching and learning courses', () => {
                render(<Home />);

                expect(screen.getByText('Created by you')).toBeInTheDocument();
                expect(screen.getByText('Enrolled courses')).toBeInTheDocument();

                // Should not show "Your courses" heading
                expect(screen.queryByText('Your courses')).not.toBeInTheDocument();
                expect(screen.queryByText('Mentored by you')).not.toBeInTheDocument();
            });

            it('should default to teaching tab when both teaching and learning exist', () => {
                render(<Home />);

                const teachingTab = screen.getByText('Created by you').closest('button');
                const learningTab = screen.getByText('Enrolled courses').closest('button');

                expect(teachingTab).toHaveClass('bg-[#333333]');
                expect(learningTab).toHaveClass('text-gray-400');

                // Should show teaching courses
                expect(screen.getByTestId('course-card-course-1')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-2')).toBeInTheDocument();
                expect(screen.queryByTestId('course-card-course-3')).not.toBeInTheDocument();
            });

            it('should switch to learning tab when clicked', () => {
                render(<Home />);

                const learningTab = screen.getByText('Enrolled courses').closest('button');
                fireEvent.click(learningTab!);

                expect(learningTab).toHaveClass('bg-[#333333]');

                // Should show learning courses
                expect(screen.getByTestId('course-card-course-3')).toBeInTheDocument();
                expect(screen.getByTestId('course-card-course-4')).toBeInTheDocument();
                expect(screen.queryByTestId('course-card-course-1')).not.toBeInTheDocument();
            });
        });
    });

    describe('Header Props', () => {
        it('should show create course button when user has courses', () => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useCourses as jest.Mock).mockReturnValue({
                courses: [{
                    id: 'course-1',
                    title: 'Course 1',
                    role: 'admin',
                    org: undefined,
                    description: 'Test course description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }],
                isLoading: false,
                error: null
            });
            (useSchools as jest.Mock).mockReturnValue({ schools: [], isLoading: false, error: null });

            render(<Home />);

            expect(screen.getByTestId('show-create-course-button')).toHaveTextContent('true');
        });

        it('should show create course button when user has school', () => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useCourses as jest.Mock).mockReturnValue({ courses: [], isLoading: false, error: null });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [{ id: 'school-1', name: 'Test School' }],
                isLoading: false,
                error: null
            });

            render(<Home />);

            expect(screen.getByTestId('show-create-course-button')).toHaveTextContent('true');
        });

        it('should show try demo button when user has no learning courses', () => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useCourses as jest.Mock).mockReturnValue({
                courses: [{
                    id: 'course-1',
                    title: 'Course 1',
                    role: 'admin',
                    org: undefined,
                    description: 'Test course description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }],
                isLoading: false,
                error: null
            });
            (useSchools as jest.Mock).mockReturnValue({ schools: [], isLoading: false, error: null });

            render(<Home />);

            expect(screen.getByTestId('show-try-demo-button')).toHaveTextContent('true');
        });

        it('should not show try demo button when user has learning courses', () => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useCourses as jest.Mock).mockReturnValue({
                courses: [{
                    id: 'course-1',
                    title: 'Course 1',
                    role: 'student',
                    org: undefined,
                    description: 'Test course description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }],
                isLoading: false,
                error: null
            });
            (useSchools as jest.Mock).mockReturnValue({ schools: [], isLoading: false, error: null });

            render(<Home />);

            expect(screen.getByTestId('show-try-demo-button')).toHaveTextContent('false');
        });
    });

    describe('Create Course Dialog', () => {
        beforeEach(() => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useCourses as jest.Mock).mockReturnValue({ courses: [], isLoading: false, error: null });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [{ id: 'school-1', name: 'Test School' }],
                isLoading: false,
                error: null
            });
        });

        it('should handle course creation success', () => {
            render(<Home />);

            const createButton = screen.getByRole('button', { name: 'Create course' });
            fireEvent.click(createButton);

            const successButton = screen.getByRole('button', { name: 'Success' });
            fireEvent.click(successButton);

            expect(mockPush).toHaveBeenCalledWith('/school/admin/school-1/courses/new-course');
        });

        it('should close dialog when close button is clicked', () => {
            render(<Home />);

            const createButton = screen.getByRole('button', { name: 'Create course' });
            fireEvent.click(createButton);

            expect(screen.getByTestId('create-course-dialog')).toBeInTheDocument();

            const closeButton = screen.getByRole('button', { name: 'Close' });
            fireEvent.click(closeButton);

            expect(screen.queryByTestId('create-course-dialog')).not.toBeInTheDocument();
        });

        it('should redirect to school creation on success when no school exists', () => {
            (useSchools as jest.Mock).mockReturnValue({ schools: [], isLoading: false, error: null });

            render(<Home />);

            const createButton = screen.getByRole('button', { name: 'Create course' });
            fireEvent.click(createButton);

            expect(mockPush).toHaveBeenCalledWith('/school/admin/create');
        });
    });

    describe('Initial Tab Selection', () => {
        it('should default to learning tab when user only has learning courses', () => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useCourses as jest.Mock).mockReturnValue({
                courses: [{
                    id: 'course-1',
                    title: 'Course 1',
                    role: 'student',
                    org: undefined,
                    description: 'Test course description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }],
                isLoading: false,
                error: null
            });
            (useSchools as jest.Mock).mockReturnValue({ schools: [], isLoading: false, error: null });

            // Mock useState to verify initial state
            const setStateMock = jest.fn();
            const useStateSpy = jest.spyOn(React, 'useState');
            useStateSpy.mockImplementation(((initial: any) => {
                if (initial === 'learning') {
                    return ['learning', setStateMock];
                }
                return [initial, setStateMock];
            }) as any);

            render(<Home />);

            // The component should calculate initialActiveTab as 'learning'
            expect(screen.getByText('Your courses')).toBeInTheDocument();

            useStateSpy.mockRestore();
        });

        it('should default to mentoring tab when user only has mentoring courses', () => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useCourses as jest.Mock).mockReturnValue({
                courses: [{
                    id: 'course-1',
                    title: 'Course 1',
                    role: 'mentor',
                    org: undefined,
                    description: 'Test course description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }],
                isLoading: false,
                error: null
            });
            (useSchools as jest.Mock).mockReturnValue({ schools: [], isLoading: false, error: null });

            // Mock useState to verify initial state
            const setStateMock = jest.fn();
            const useStateSpy = jest.spyOn(React, 'useState');
            useStateSpy.mockImplementation(((initial: any) => {
                if (initial === 'mentoring') {
                    return ['mentoring', setStateMock];
                }
                return [initial, setStateMock];
            }) as any);

            render(<Home />);

            // The component should calculate initialActiveTab as 'mentoring'
            expect(screen.getByText('Courses you are mentoring')).toBeInTheDocument();

            useStateSpy.mockRestore();
        });
    });

    describe('Tab Change Logic', () => {
        it('should switch to first available tab when current tab becomes unavailable', async () => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [{ id: 'school-1', name: 'Test School' }],
                isLoading: false,
                error: null
            });

            // Mock initial teaching courses
            (useCourses as jest.Mock).mockReturnValue({
                courses: [{
                    id: 'course-1',
                    title: 'Teaching Course 1',
                    role: 'admin',
                    org: undefined,
                    description: 'Test course description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }],
                isLoading: false,
                error: null
            });

            // Start with teaching courses (active tab will be 'teaching')
            const { rerender } = render(<Home />);

            expect(screen.getByText('Your courses')).toBeInTheDocument();

            // Now change to mentoring courses only (teaching tab should switch to mentoring)
            (useCourses as jest.Mock).mockReturnValue({
                courses: [{
                    id: 'course-2',
                    title: 'Mentoring Course 1',
                    role: 'mentor',
                    org: undefined,
                    description: 'Test course description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }],
                isLoading: false,
                error: null
            });

            rerender(<Home />);

            await waitFor(() => {
                expect(screen.getByText('Courses you are mentoring')).toBeInTheDocument();
            });
        });

        it('should handle empty tabs array gracefully', async () => {
            (useSession as jest.Mock).mockReturnValue({
                data: {
                    user: { id: 'test-user' },
                    expires: '2024-12-31T23:59:59.999Z'
                },
                status: 'authenticated',
                update: mockUpdate
            });
            (useSchools as jest.Mock).mockReturnValue({
                schools: [{ id: 'school-1', name: 'Test School' }],
                isLoading: false,
                error: null
            });

            // Start with some courses
            (useCourses as jest.Mock).mockReturnValue({
                courses: [{
                    id: 'course-1',
                    title: 'Teaching Course 1',
                    role: 'admin',
                    org: undefined,
                    description: 'Test course description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }],
                isLoading: false,
                error: null
            });

            const { rerender } = render(<Home />);

            // Change to no courses
            (useCourses as jest.Mock).mockReturnValue({
                courses: [],
                isLoading: false,
                error: null
            });

            rerender(<Home />);

            await waitFor(() => {
                expect(screen.getByText('What if your next big idea became a course?')).toBeInTheDocument();
            });
        });
    });
}); 