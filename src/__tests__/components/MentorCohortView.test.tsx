import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import MentorCohortView from '../../components/MentorCohortView';
import { CohortWithDetails, CohortMember } from '@/types';

// Mock fetch globally
global.fetch = jest.fn();

// Mock Next.js router and search params
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockGet = jest.fn();

// Track the current URL state for the mock
let currentUrlParams = 'view=mentor&other=param';

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: (url: string, options?: any) => {
            mockReplace(url, options);
            // Update the current URL params when replace is called
            if (url.startsWith('?')) {
                currentUrlParams = url.substring(1);
            }
        },
    }),
    useSearchParams: () => ({
        get: (key: string) => {
            if (key === 'view') {
                const params = new URLSearchParams(currentUrlParams);
                return params.get('view');
            }
            return null;
        },
        toString: () => currentUrlParams,
    }),
}));

// Mock the CohortDashboard component
jest.mock('../../components/CohortDashboard', () => {
    return function MockCohortDashboard(props: any) {
        return (
            <div data-testid="cohort-dashboard" data-props={JSON.stringify({
                ...props,
                // Remove function props to avoid serialization issues
                onActiveCourseChange: props.onActiveCourseChange ? 'function' : undefined
            })}>
                CohortDashboard Mock
            </div>
        );
    };
});

// Mock the LearnerCohortView component
jest.mock('../../components/LearnerCohortView', () => {
    return function MockLearnerCohortView(props: any) {
        return (
            <div data-testid="learner-cohort-view" data-props={JSON.stringify({
                ...props,
                onCourseSelect: props.onCourseSelect ? 'function' : undefined
            })}>
                LearnerCohortView Mock
            </div>
        );
    };
});

// Mock environment variables
process.env.NEXT_PUBLIC_BACKEND_URL = 'http://test-api.example.com';

describe('MentorCohortView Component', () => {
    const mockCohort: CohortWithDetails = {
        id: 1,
        name: 'Test Cohort',
        joined_at: '2024-01-01',
        members: [],
        org_id: 123,
        groups: [],
        courses: [
            { id: 1, name: 'Course 1' },
            { id: 2, name: 'Course 2' }
        ]
    };

    const mockCohortMembers: CohortMember[] = [
        { id: 1, email: 'learner1@test.com', role: 'learner' },
        { id: 2, email: 'learner2@test.com', role: 'learner' },
        { id: 3, email: 'mentor@test.com', role: 'mentor' }
    ];

    const defaultProps = {
        cohort: mockCohort,
        activeCourseIndex: 0,
        schoolId: '123',
        onActiveCourseChange: jest.fn(),
        batchId: 456,
        courseModules: [],
        completedTaskIds: {},
        completedQuestionIds: {},
        courses: []
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset URL state
        currentUrlParams = 'view=mentor&other=param';

        // Default successful fetch mock
        (global.fetch as jest.Mock).mockImplementation((url: string) => {
            if (url.includes('/cohorts/')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        members: mockCohortMembers
                    })
                });
            }
            if (url.includes('/organizations/')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        slug: 'test-school'
                    })
                });
            }
            return Promise.reject(new Error('Unhandled URL in mock'));
        });

        // Default search params mock
        mockGet.mockReturnValue('mentor');
    });

    describe('Rendering', () => {
        it('renders loading state initially', async () => {
            // Create a hanging promise to test loading state
            let resolvePromise: (value: any) => void;
            const hangingPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });

            (global.fetch as jest.Mock).mockImplementation(() => hangingPromise);

            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            // Should show loading spinner (initially loading is true)
            const spinnerDiv = document.querySelector('.animate-spin');
            expect(spinnerDiv).toBeInTheDocument();

            // Should not show CohortDashboard yet
            expect(screen.queryByTestId('cohort-dashboard')).not.toBeInTheDocument();

            // Clean up by resolving the promise
            await act(async () => {
                resolvePromise!({
                    ok: true,
                    json: () => Promise.resolve({ members: mockCohortMembers })
                });
            });
        });

        it('renders placeholder when batchId is null', () => {
            render(<MentorCohortView {...defaultProps} batchId={null} />);

            expect(screen.getByText('No learners assigned yet')).toBeInTheDocument();
            expect(screen.getByText('You will see their progress here once they are assigned to you')).toBeInTheDocument();
        });

        it('renders CohortDashboard after successful data fetch', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
            });
        });
    });

    describe('Data Fetching', () => {
        it('fetches cohort members with correct batch_id', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://test-api.example.com/cohorts/1?batch_id=456'
                );
            });
        });

        it('fetches school details', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://test-api.example.com/organizations/123'
                );
            });
        });

        it('handles cohort members fetch error', async () => {
            (global.fetch as jest.Mock).mockImplementation((url: string) => {
                if (url.includes('/cohorts/')) {
                    return Promise.resolve({
                        ok: false,
                        status: 500
                    });
                }
                if (url.includes('/organizations/')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ slug: 'test-school' })
                    });
                }
                return Promise.reject(new Error('Unhandled URL'));
            });

            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByText('Failed to load cohort members.')).toBeInTheDocument();
            });
        });

        it('verifies fetch is called for both endpoints', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://test-api.example.com/cohorts/1?batch_id=456'
                );
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://test-api.example.com/organizations/123'
                );
            });
        });
    });

    describe('Props Passing', () => {
        it('passes correct props to CohortDashboard', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                const dashboard = screen.getByTestId('cohort-dashboard');
                const props = JSON.parse(dashboard.getAttribute('data-props') || '{}');

                expect(props.cohort.id).toBe(1);
                expect(props.cohort.members).toHaveLength(3);
                expect(props.cohortId).toBe('1');
                expect(props.schoolId).toBe('123');
                expect(props.schoolSlug).toBe('test-school');
                expect(props.view).toBe('mentor');
                expect(props.activeCourseIndex).toBe(0);
                expect(props.batchId).toBe(456);
            });
        });

        it('uses default activeCourseIndex when not provided', async () => {
            const propsWithoutIndex = { ...defaultProps };
            delete (propsWithoutIndex as any).activeCourseIndex;

            await act(async () => {
                render(<MentorCohortView {...propsWithoutIndex} />);
            });

            await waitFor(() => {
                const dashboard = screen.getByTestId('cohort-dashboard');
                const props = JSON.parse(dashboard.getAttribute('data-props') || '{}');
                expect(props.activeCourseIndex).toBe(0);
            });
        });

        it('calls onActiveCourseChange callback when provided', async () => {
            const mockCallback = jest.fn();

            await act(async () => {
                render(<MentorCohortView {...defaultProps} onActiveCourseChange={mockCallback} />);
            });

            await waitFor(() => {
                const dashboard = screen.getByTestId('cohort-dashboard');
                const props = JSON.parse(dashboard.getAttribute('data-props') || '{}');
                expect(props.onActiveCourseChange).toBe('function');
            });
        });
    });

    describe('Edge Cases', () => {
        it('handles undefined cohort id', async () => {
            const invalidCohort = { ...mockCohort, id: undefined } as any;

            await act(async () => {
                render(<MentorCohortView {...defaultProps} cohort={invalidCohort} />);
            });

            // Should still call fetchSchoolSlug but not fetchCohortMembers
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://test-api.example.com/organizations/123'
                );
            });

            // Shouldn't call the cohort members endpoint
            expect(global.fetch).not.toHaveBeenCalledWith(
                expect.stringContaining('/cohorts/')
            );
        });

        it('handles network errors gracefully', async () => {
            (global.fetch as jest.Mock).mockImplementation((url: string) => {
                if (url.includes('/cohorts/')) {
                    return Promise.reject(new Error('Network error'));
                }
                if (url.includes('/organizations/')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ slug: 'test-school' })
                    });
                }
                return Promise.reject(new Error('Unhandled URL'));
            });

            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            // fetchCohortMembers fails, so membersError will be set
            await waitFor(() => {
                expect(screen.getByText('Failed to load cohort members.')).toBeInTheDocument();
            });
        });

        it('updates when batchId changes', async () => {
            const { rerender } = await act(async () => {
                return render(<MentorCohortView {...defaultProps} batchId={456} />);
            });

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://test-api.example.com/cohorts/1?batch_id=456'
                );
            });

            jest.clearAllMocks();

            // Change batchId
            await act(async () => {
                rerender(<MentorCohortView {...defaultProps} batchId={789} />);
            });

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://test-api.example.com/cohorts/1?batch_id=789'
                );
            });
        });

        it('updates when cohort id changes', async () => {
            const { rerender } = await act(async () => {
                return render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://test-api.example.com/cohorts/1?batch_id=456'
                );
            });

            jest.clearAllMocks();

            const newCohort = { ...mockCohort, id: 2 };

            // Change cohort
            await act(async () => {
                rerender(<MentorCohortView {...defaultProps} cohort={newCohort} />);
            });

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://test-api.example.com/cohorts/2?batch_id=456'
                );
            });
        });
    });

    describe('Loading States', () => {
        it('shows loading spinner while fetching data', async () => {
            // Make fetch hang to test loading state
            const hangingPromise = new Promise(() => { }); // Never resolves
            (global.fetch as jest.Mock).mockImplementation(() => hangingPromise);

            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            // Should show loading spinner
            const spinnerDiv = document.querySelector('.animate-spin');
            expect(spinnerDiv).toBeInTheDocument();
        });

        it('hides loading spinner after data loads', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
            });

            // Loading should be done
            const spinnerDiv = document.querySelector('.animate-spin');
            expect(spinnerDiv).not.toBeInTheDocument();
        });
    });

    describe('Component Lifecycle', () => {
        it('handles component unmount during fetch', async () => {
            // This test ensures no memory leaks or state updates after unmount
            let resolvePromise: (value: any) => void;
            const hangingPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });

            (global.fetch as jest.Mock).mockImplementation(() => hangingPromise);

            const { unmount } = await act(async () => {
                return render(<MentorCohortView {...defaultProps} />);
            });

            // Unmount before promise resolves
            unmount();

            // Now resolve the promise - should not cause any errors
            await act(async () => {
                resolvePromise!({
                    ok: true,
                    json: () => Promise.resolve({ members: mockCohortMembers })
                });
            });

            // No assertions needed - just ensuring no errors occur
        });

        it('handles fetch response after component props change', async () => {
            let resolvePromise: (value: any) => void;
            const delayedPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });

            (global.fetch as jest.Mock).mockImplementation(() => delayedPromise);

            const { rerender } = await act(async () => {
                return render(<MentorCohortView {...defaultProps} batchId={456} />);
            });

            // Change props before first fetch completes
            await act(async () => {
                rerender(<MentorCohortView {...defaultProps} batchId={789} />);
            });

            // Resolve the original promise
            await act(async () => {
                resolvePromise!({
                    ok: true,
                    json: () => Promise.resolve({ members: mockCohortMembers })
                });
            });

            // Component should handle this gracefully
            expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
        });
    });

    describe('View Mode Toggle', () => {
        it('renders view mode toggle buttons', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByText('Mentor View')).toBeInTheDocument();
                expect(screen.getByText('Learner View')).toBeInTheDocument();
            });
        });

        it('initializes with mentor view by default when no URL param', async () => {
            mockGet.mockReturnValue(null);

            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
                expect(screen.queryByTestId('learner-cohort-view')).not.toBeInTheDocument();
            });
        });

        it('initializes with learner view when URL param is learner', async () => {
            currentUrlParams = 'view=learner&other=param';

            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('learner-cohort-view')).toBeInTheDocument();
            });
        });

        it('switches to learner view when learner button is clicked', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
            });

            // Click the learner view button
            const learnerButton = screen.getByText('Learner View');
            await act(async () => {
                fireEvent.click(learnerButton);
            });

            // Wait for the component to re-render with learner view
            await waitFor(() => {
                expect(screen.getByTestId('learner-cohort-view')).toBeInTheDocument();
            }, { timeout: 3000 });

            expect(screen.queryByTestId('cohort-dashboard')).not.toBeInTheDocument();
        });

        it('switches to mentor view when mentor button is clicked', async () => {
            currentUrlParams = 'view=learner&other=param';

            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('learner-cohort-view')).toBeInTheDocument();
            });

            // Click the mentor view button
            const mentorButton = screen.getByText('Mentor View');
            await act(async () => {
                fireEvent.click(mentorButton);
            });

            // Wait for the component to re-render with mentor view
            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
            }, { timeout: 3000 });

            expect(screen.queryByTestId('learner-cohort-view')).not.toBeInTheDocument();
        });

        it('updates URL when view mode changes', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
            });

            await act(async () => {
                fireEvent.click(screen.getByText('Learner View'));
            });

            expect(mockReplace).toHaveBeenCalledWith('?view=learner&other=param', { scroll: false });
        });

        it('syncs with URL changes when search params change', async () => {
            const { rerender } = await act(async () => {
                return render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
            });

            // Simulate URL change to learner
            currentUrlParams = 'view=learner&other=param';

            await act(async () => {
                rerender(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('learner-cohort-view')).toBeInTheDocument();
            });
        });

        it('handles invalid URL view parameter gracefully', async () => {
            currentUrlParams = 'view=invalid&other=param';

            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            // Should default to mentor view when invalid parameter
            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
            });
        });

        it('applies correct styling to active mentor button', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                const mentorButton = screen.getByText('Mentor View').closest('button');
                expect(mentorButton).toHaveClass('bg-white', 'text-black');
            });
        });

        it('applies correct styling to active learner button', async () => {
            currentUrlParams = 'view=learner&other=param';

            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                const learnerButton = screen.getByText('Learner View').closest('button');
                expect(learnerButton).toHaveClass('bg-white', 'text-black');
            });
        });

        it('applies correct styling to inactive buttons', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                const learnerButton = screen.getByText('Learner View').closest('button');
                expect(learnerButton).toHaveClass('text-gray-700', 'dark:text-white');
                expect(learnerButton).not.toHaveClass('bg-white', 'text-black');
            });
        });

        it('passes correct props to LearnerCohortView', async () => {
            const propsWithData = {
                ...defaultProps,
                courseModules: [{ id: '1', title: 'Module 1', position: 1, items: [] }],
                completedTaskIds: { 'task1': true },
                completedQuestionIds: { 'quiz1': { 'q1': true } },
                courses: [{ id: 1, name: 'Course 1' }]
            };

            currentUrlParams = 'view=learner&other=param';

            await act(async () => {
                render(<MentorCohortView {...propsWithData} />);
            });

            await waitFor(() => {
                const learnerView = screen.getByTestId('learner-cohort-view');
                const props = JSON.parse(learnerView.getAttribute('data-props') || '{}');

                expect(props.courseTitle).toBe('Course 1');
                expect(props.modules).toEqual([{ id: '1', title: 'Module 1', position: 1, items: [] }]);
                expect(props.schoolId).toBe('123');
                expect(props.cohortId).toBe('1');
                expect(props.streakDays).toBe(2);
                expect(props.activeDays).toEqual(['M', 'T']);
                expect(props.completedTaskIds).toEqual({ 'task1': true });
                expect(props.completedQuestionIds).toEqual({ 'quiz1': { 'q1': true } });
                expect(props.courses).toEqual([{ id: 1, name: 'Course 1' }]);
                expect(props.activeCourseIndex).toBe(0);
            });
        });

        it('handles empty course title when multiple courses exist', async () => {
            const propsWithMultipleCourses = {
                ...defaultProps,
                courses: [
                    { id: 1, name: 'Course 1' },
                    { id: 2, name: 'Course 2' }
                ]
            };

            currentUrlParams = 'view=learner&other=param';

            await act(async () => {
                render(<MentorCohortView {...propsWithMultipleCourses} />);
            });

            await waitFor(() => {
                const learnerView = screen.getByTestId('learner-cohort-view');
                const props = JSON.parse(learnerView.getAttribute('data-props') || '{}');
                expect(props.courseTitle).toBe('');
            });
        });

        it('handles undefined course name gracefully', async () => {
            const propsWithUndefinedCourse = {
                ...defaultProps,
                courses: [{ id: 1, name: '' }]
            };

            currentUrlParams = 'view=learner&other=param';

            await act(async () => {
                render(<MentorCohortView {...propsWithUndefinedCourse} />);
            });

            await waitFor(() => {
                const learnerView = screen.getByTestId('learner-cohort-view');
                const props = JSON.parse(learnerView.getAttribute('data-props') || '{}');
                expect(props.courseTitle).toBe('');
            });
        });

        it('handles empty courses array', async () => {
            const propsWithEmptyCourses = {
                ...defaultProps,
                courses: []
            };

            currentUrlParams = 'view=learner&other=param';

            await act(async () => {
                render(<MentorCohortView {...propsWithEmptyCourses} />);
            });

            await waitFor(() => {
                const learnerView = screen.getByTestId('learner-cohort-view');
                const props = JSON.parse(learnerView.getAttribute('data-props') || '{}');
                expect(props.courseTitle).toBe('');
            });
        });

        it('maintains view mode state during data refetch', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
            });

            // Switch to learner view
            const learnerButton = screen.getByText('Learner View');
            await act(async () => {
                fireEvent.click(learnerButton);
            });

            await waitFor(() => {
                expect(screen.getByTestId('learner-cohort-view')).toBeInTheDocument();
            });

            // Simulate data refetch by changing cohort
            const newCohort = { ...mockCohort, id: 2 };
            await act(async () => {
                render(<MentorCohortView {...defaultProps} cohort={newCohort} />);
            });

            // Should still be in learner view (check for the latest one)
            await waitFor(() => {
                const learnerViews = screen.getAllByTestId('learner-cohort-view');
                expect(learnerViews.length).toBeGreaterThan(0);
                // Check that the latest one has the new cohort ID
                const latestProps = JSON.parse(learnerViews[learnerViews.length - 1].getAttribute('data-props') || '{}');
                expect(latestProps.cohortId).toBe('2');
            });
        });

        it('handles rapid view mode toggles correctly', async () => {
            await act(async () => {
                render(<MentorCohortView {...defaultProps} />);
            });

            await waitFor(() => {
                expect(screen.getByTestId('cohort-dashboard')).toBeInTheDocument();
            });

            // Rapidly toggle between views
            const learnerButton = screen.getByText('Learner View');
            const mentorButton = screen.getByText('Mentor View');

            await act(async () => {
                fireEvent.click(learnerButton);
                fireEvent.click(mentorButton);
                fireEvent.click(learnerButton);
            });

            await waitFor(() => {
                expect(screen.getByTestId('learner-cohort-view')).toBeInTheDocument();
            }, { timeout: 3000 });

            // Should have called router.replace multiple times
            expect(mockReplace).toHaveBeenCalledTimes(3);
        });
    });
}); 