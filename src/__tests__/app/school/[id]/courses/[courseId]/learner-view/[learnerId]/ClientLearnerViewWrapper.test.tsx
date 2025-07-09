import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ClientLearnerViewWrapper from '@/app/school/[id]/courses/[courseId]/learner-view/[learnerId]/ClientLearnerViewWrapper';
import { Module } from '@/types/course';

// Mock LearnerCourseView component
jest.mock('@/components/LearnerCourseView', () => {
    return jest.fn(({ modules, completedTaskIds, completedQuestionIds, viewOnly, learnerId, isAdminView }) => (
        <div data-testid="learner-course-view">
            <div data-testid="modules">{JSON.stringify(modules)}</div>
            <div data-testid="completed-task-ids">{JSON.stringify(completedTaskIds)}</div>
            <div data-testid="completed-question-ids">{JSON.stringify(completedQuestionIds)}</div>
            <div data-testid="view-only">{viewOnly.toString()}</div>
            <div data-testid="learner-id">{learnerId}</div>
            <div data-testid="is-admin-view">{isAdminView.toString()}</div>
        </div>
    ));
});

// Mock getCompletionData API
jest.mock('@/lib/api', () => ({
    getCompletionData: jest.fn()
}));

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = jest.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
});

const { getCompletionData } = require('@/lib/api');
const mockLearnerCourseView = require('@/components/LearnerCourseView');

describe('ClientLearnerViewWrapper', () => {
    const mockModules: Module[] = [
        {
            id: 'module-1',
            title: 'Test Module 1',
            items: [],
            position: 1
        },
        {
            id: 'module-2',
            title: 'Test Module 2',
            items: [],
            position: 2
        }
    ];

    const defaultProps = {
        modules: mockModules,
        learnerId: 'test-learner-123',
        cohortId: '456',
        courseId: 'course-789',
        isAdminView: true
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    describe('Loading state', () => {
        it('should show loading spinner when fetching data', () => {
            getCompletionData.mockImplementation(() => new Promise(() => { })); // Never resolves

            const { container } = render(<ClientLearnerViewWrapper {...defaultProps} />);

            const loadingContainer = container.querySelector('.flex.justify-center.items-center.h-64');
            expect(loadingContainer).toBeInTheDocument();
            expect(loadingContainer).toHaveClass('flex', 'justify-center', 'items-center', 'h-64');

            const spinner = loadingContainer?.querySelector('.animate-spin');
            expect(spinner).toBeInTheDocument();
            expect(spinner).toHaveClass('w-12', 'h-12', 'border-t-2', 'border-white', 'rounded-full', 'animate-spin');
        });

        it('should not render LearnerCourseView during loading', () => {
            getCompletionData.mockImplementation(() => new Promise(() => { })); // Never resolves

            render(<ClientLearnerViewWrapper {...defaultProps} />);

            expect(screen.queryByTestId('learner-course-view')).not.toBeInTheDocument();
        });
    });

    describe('Error state', () => {
        const mockError = new Error('API Error');

        beforeEach(() => {
            getCompletionData.mockRejectedValue(mockError);
        });

        it('should display error message when API call fails', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Failed to load learner's progress data. Please try again.")).toBeInTheDocument();
            });
        });

        it('should render error container with correct styling', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                const errorContainer = screen.getByText("Failed to load learner's progress data. Please try again.").closest('div');
                expect(errorContainer).toHaveClass('bg-red-900/20', 'border', 'border-red-800', 'p-4', 'rounded-lg', 'text-center');
            });
        });

        it('should apply correct text styling to error message', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                const errorText = screen.getByText("Failed to load learner's progress data. Please try again.");
                expect(errorText).toHaveClass('text-red-400', 'mb-2');
            });
        });

        it('should not render LearnerCourseView when there is an error', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Failed to load learner's progress data. Please try again.")).toBeInTheDocument();
            });

            expect(screen.queryByTestId('learner-course-view')).not.toBeInTheDocument();
        });

        it('should log error to console', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(console.error).toHaveBeenCalledWith("Error fetching learner progress:", mockError);
            });
        });
    });

    describe('Successful data loading', () => {
        const mockCompletionData = {
            taskCompletions: { 'task-1': true, 'task-2': false },
            questionCompletions: {
                'quiz-1': { 'question-1': true, 'question-2': false },
                'quiz-2': { 'question-3': true }
            }
        };

        beforeEach(() => {
            getCompletionData.mockResolvedValue(mockCompletionData);
        });

        it('should render LearnerCourseView with correct props after successful data fetch', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('learner-course-view')).toBeInTheDocument();
            });

            expect(mockLearnerCourseView).toHaveBeenCalledWith({
                modules: mockModules,
                completedTaskIds: mockCompletionData.taskCompletions,
                completedQuestionIds: mockCompletionData.questionCompletions,
                viewOnly: true,
                learnerId: 'test-learner-123',
                isAdminView: true
            }, undefined);
        });

        it('should pass modules prop correctly', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('modules')).toHaveTextContent(JSON.stringify(mockModules));
            });
        });

        it('should pass completed task IDs correctly', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('completed-task-ids')).toHaveTextContent(
                    JSON.stringify(mockCompletionData.taskCompletions)
                );
            });
        });

        it('should pass completed question IDs correctly', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('completed-question-ids')).toHaveTextContent(
                    JSON.stringify(mockCompletionData.questionCompletions)
                );
            });
        });

        it('should always set viewOnly to true', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('view-only')).toHaveTextContent('true');
            });
        });

        it('should pass learner ID correctly', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('learner-id')).toHaveTextContent('test-learner-123');
            });
        });

        it('should pass isAdminView prop correctly', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('is-admin-view')).toHaveTextContent('true');
            });
        });
    });

    describe('API call parameters', () => {
        beforeEach(() => {
            getCompletionData.mockResolvedValue({
                taskCompletions: {},
                questionCompletions: {}
            });
        });

        it('should call getCompletionData with correct parameters', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledWith(456, 'test-learner-123');
            });
        });

        it('should parse cohortId as integer', async () => {
            const props = { ...defaultProps, cohortId: '999' };
            render(<ClientLearnerViewWrapper {...props} />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledWith(999, 'test-learner-123');
            });
        });

        it('should call API only once on mount', async () => {
            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('useEffect dependencies', () => {
        beforeEach(() => {
            getCompletionData.mockResolvedValue({
                taskCompletions: {},
                questionCompletions: {}
            });
        });

        it('should refetch data when learnerId changes', async () => {
            const { rerender } = render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(1);
            });

            rerender(<ClientLearnerViewWrapper {...defaultProps} learnerId="new-learner-456" />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(2);
                expect(getCompletionData).toHaveBeenLastCalledWith(456, 'new-learner-456');
            });
        });

        it('should refetch data when courseId changes', async () => {
            const { rerender } = render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(1);
            });

            rerender(<ClientLearnerViewWrapper {...defaultProps} courseId="new-course-123" />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(2);
            });
        });

        it('should not refetch data when cohortId changes', async () => {
            const { rerender } = render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(1);
            });

            rerender(<ClientLearnerViewWrapper {...defaultProps} cohortId="new-cohort-789" />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(1);
            });
        });

        it('should not refetch data when modules change', async () => {
            const { rerender } = render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(1);
            });

            const newModules = [{ id: 'new-module', title: 'New Module', items: [], position: 1 }];
            rerender(<ClientLearnerViewWrapper {...defaultProps} modules={newModules} />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(1);
            });
        });

        it('should not refetch data when isAdminView changes', async () => {
            const { rerender } = render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(1);
            });

            rerender(<ClientLearnerViewWrapper {...defaultProps} isAdminView={false} />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('Prop variations', () => {
        beforeEach(() => {
            getCompletionData.mockResolvedValue({
                taskCompletions: {},
                questionCompletions: {}
            });
        });

        it('should work with isAdminView set to false', async () => {
            const props = { ...defaultProps, isAdminView: false };
            render(<ClientLearnerViewWrapper {...props} />);

            await waitFor(() => {
                expect(screen.getByTestId('is-admin-view')).toHaveTextContent('false');
            });
        });

        it('should work with empty modules array', async () => {
            const props = { ...defaultProps, modules: [] };
            render(<ClientLearnerViewWrapper {...props} />);

            await waitFor(() => {
                expect(screen.getByTestId('modules')).toHaveTextContent('[]');
            });
        });

        it('should work with different learner IDs', async () => {
            const props = { ...defaultProps, learnerId: 'different-learner-999' };
            render(<ClientLearnerViewWrapper {...props} />);

            await waitFor(() => {
                expect(screen.getByTestId('learner-id')).toHaveTextContent('different-learner-999');
            });
        });

        it('should work with single module', async () => {
            const singleModule = [mockModules[0]];
            const props = { ...defaultProps, modules: singleModule };
            render(<ClientLearnerViewWrapper {...props} />);

            await waitFor(() => {
                expect(screen.getByTestId('modules')).toHaveTextContent(JSON.stringify(singleModule));
            });
        });
    });

    describe('Empty data handling', () => {
        it('should handle empty completion data', async () => {
            getCompletionData.mockResolvedValue({
                taskCompletions: {},
                questionCompletions: {}
            });

            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('completed-task-ids')).toHaveTextContent('{}');
                expect(screen.getByTestId('completed-question-ids')).toHaveTextContent('{}');
            });
        });

        it('should handle null completion data gracefully', async () => {
            getCompletionData.mockResolvedValue({
                taskCompletions: null,
                questionCompletions: null
            });

            render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('completed-task-ids')).toHaveTextContent('null');
                expect(screen.getByTestId('completed-question-ids')).toHaveTextContent('null');
            });
        });
    });

    describe('State management', () => {
        it('should reset error state when refetching data', async () => {
            getCompletionData.mockRejectedValueOnce(new Error('First error'));

            const { rerender } = render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText("Failed to load learner's progress data. Please try again.")).toBeInTheDocument();
            });

            getCompletionData.mockResolvedValue({
                taskCompletions: {},
                questionCompletions: {}
            });

            rerender(<ClientLearnerViewWrapper {...defaultProps} learnerId="new-learner" />);

            await waitFor(() => {
                expect(screen.queryByText("Failed to load learner's progress data. Please try again.")).not.toBeInTheDocument();
                expect(screen.getByTestId('learner-course-view')).toBeInTheDocument();
            });
        });

        it('should set loading state during refetch', async () => {
            getCompletionData.mockResolvedValue({
                taskCompletions: {},
                questionCompletions: {}
            });

            const { rerender, container } = render(<ClientLearnerViewWrapper {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('learner-course-view')).toBeInTheDocument();
            });

            getCompletionData.mockImplementation(() => new Promise(() => { })); // Never resolves

            rerender(<ClientLearnerViewWrapper {...defaultProps} learnerId="new-learner" />);

            expect(screen.queryByTestId('learner-course-view')).not.toBeInTheDocument();

            const spinner = container.querySelector('.animate-spin');
            expect(spinner).toBeInTheDocument();
        });
    });
}); 