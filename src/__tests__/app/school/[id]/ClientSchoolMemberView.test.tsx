import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import ClientSchoolMemberView from '@/app/school/[id]/ClientSchoolMemberView';
import { useAuth } from '@/lib/auth';
import { useSchools, getCompletionData } from '@/lib/api';
import { transformCourseToModules } from '@/lib/course';

// Mock dependencies
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
    useSearchParams: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
    useSchools: jest.fn(),
    getCompletionData: jest.fn(),
}));

jest.mock('@/lib/course', () => ({
    transformCourseToModules: jest.fn(),
}));

jest.mock('@/components/layout/header', () => ({
    Header: function MockHeader({ showCreateCourseButton, centerSlot }: any) {
        return (
            <header data-testid="header">
                <div data-testid="show-create-course-button">{showCreateCourseButton.toString()}</div>
                <div data-testid="center-slot">{centerSlot}</div>
            </header>
        );
    }
}));

jest.mock('@/components/CohortCard', () => {
    return function MockCohortCard({ cohort }: any) {
        return <div data-testid={`cohort-card-${cohort.id}`}>{cohort.name}</div>;
    };
});

jest.mock('@/components/LearnerCohortView', () => {
    return function MockLearnerCohortView({
        courseTitle,
        modules,
        courses,
        onCourseSelect,
        activeCourseIndex,
        completedTaskIds,
        completedQuestionIds
    }: any) {
        return (
            <div data-testid="learner-cohort-view">
                <div data-testid="course-title">{courseTitle}</div>
                <div data-testid="modules-count">{modules?.length || 0}</div>
                <div data-testid="courses-count">{courses?.length || 0}</div>
                <div data-testid="active-course-index">{activeCourseIndex}</div>
                <div data-testid="completed-tasks-count">{Object.keys(completedTaskIds || {}).length}</div>
                <div data-testid="completed-questions-count">{Object.keys(completedQuestionIds || {}).length}</div>
                {onCourseSelect && courses?.length > 1 && (
                    <button
                        data-testid="course-select-trigger"
                        onClick={() => onCourseSelect(1)}
                    >
                        Select Course 1
                    </button>
                )}
            </div>
        );
    };
});

jest.mock('@/components/MentorCohortView', () => {
    return function MockMentorCohortView({ cohort, activeCourseIndex, onActiveCourseChange, batchId }: any) {
        return (
            <div data-testid="mentor-cohort-view">
                <div data-testid="cohort-name">{cohort?.name}</div>
                <div data-testid="active-course-index">{activeCourseIndex}</div>
                <div data-testid="batch-id">{batchId}</div>
                {onActiveCourseChange && (
                    <button
                        data-testid="course-change-trigger"
                        onClick={() => onActiveCourseChange(1)}
                    >
                        Change Course
                    </button>
                )}
            </div>
        );
    };
});

jest.mock('@/components/MemberSchoolViewHeader', () => {
    return function MockMemberSchoolViewHeader({ cohorts, activeCohort, onCohortSelect, batches, onBatchSelect }: any) {
        return (
            <div data-testid="member-school-view-header">
                <div data-testid="cohorts-count">{cohorts?.length || 0}</div>
                <div data-testid="active-cohort">{activeCohort?.name || 'none'}</div>
                <div data-testid="batches-count">{batches?.length || 0}</div>
                {onCohortSelect && (
                    <button
                        data-testid="cohort-select-trigger"
                        onClick={() => onCohortSelect({ id: 2, name: 'Test Cohort 2' })}
                    >
                        Select Cohort
                    </button>
                )}
                {onBatchSelect && (
                    <button
                        data-testid="batch-select-trigger"
                        onClick={() => onBatchSelect(123)}
                    >
                        Select Batch
                    </button>
                )}
            </div>
        );
    };
});

jest.mock('@/components/MobileDropdown', () => {
    return function MockMobileDropdown({ isOpen, onClose, title, options, onSelect, selectedId }: any) {
        return isOpen ? (
            <div data-testid="mobile-dropdown">
                <div data-testid="dropdown-title">{title}</div>
                <div data-testid="dropdown-options-count">{options?.length || 0}</div>
                <div data-testid="selected-id">{selectedId}</div>
                <button onClick={onClose} data-testid="dropdown-close">Close</button>
                {options?.map((option: any) => (
                    <button
                        key={option.id}
                        data-testid={`dropdown-option-${option.id}`}
                        onClick={() => onSelect(option)}
                    >
                        {option.value.name}
                    </button>
                ))}
            </div>
        ) : null;
    };
});

// Mock fetch
global.fetch = jest.fn();

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams();

describe('ClientSchoolMemberView', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock useRouter
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            replace: mockReplace,
            prefetch: jest.fn(),
            back: jest.fn(),
            forward: jest.fn(),
            refresh: jest.fn(),
        });

        // Mock useSearchParams
        (useSearchParams as jest.Mock).mockReturnValue({
            get: jest.fn((key: string) => mockSearchParams.get(key)),
        });

        // Mock transformCourseToModules
        (transformCourseToModules as jest.Mock).mockReturnValue([
            { id: 'module-1', title: 'Module 1', items: [] }
        ]);

        // Mock getCompletionData
        (getCompletionData as jest.Mock).mockResolvedValue({
            taskCompletions: { 'task-1': true },
            questionCompletions: { 'question-1': { 'q1': true } }
        });

        // Reset fetch mock
        (fetch as jest.MockedFunction<typeof fetch>).mockClear();
    });

    describe('Authentication States', () => {
        it('should show loading spinner when auth is loading', () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: null,
                isAuthenticated: false,
                isLoading: true
            });

            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });

            render(<ClientSchoolMemberView slug="test-school" />);

            expect(screen.getByTestId('header')).toBeInTheDocument();
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });

        it('should redirect to login when not authenticated', () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: null,
                isAuthenticated: false,
                isLoading: false
            });

            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });

            render(<ClientSchoolMemberView slug="test-school" />);

            expect(mockPush).toHaveBeenCalledWith('/login');
        });
    });

    describe('Loading States', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-1' },
                isAuthenticated: true,
                isLoading: false
            });

            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });
        });

        it('should show loading spinner when fetching school data', () => {
            // Mock successful school fetch but delay the response
            (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(() =>
                new Promise(() => { }) // Never resolves to simulate loading
            );

            render(<ClientSchoolMemberView slug="test-school" />);

            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });
    });

    describe('School Data Fetching', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-1' },
                isAuthenticated: true,
                isLoading: false
            });
        });

        it('should fetch school data and cohorts for regular user', async () => {
            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });

            // Mock school API response
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                // Mock user cohorts API response
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Cohort 1', joined_at: '2024-01-01' },
                        { id: 2, name: 'Cohort 2', joined_at: '2024-01-02' }
                    ])
                } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(fetch).toHaveBeenCalledWith(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/slug/test-school`
                );
                expect(fetch).toHaveBeenCalledWith(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/users/user-1/org/1/cohorts`
                );
            });
        });

        it('should fetch all cohorts for admin user', async () => {
            (useSchools as jest.Mock).mockReturnValue({
                schools: [{ id: '1', role: 'admin' }]
            });

            // Mock school API response
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                // Mock all cohorts API response for admin
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Cohort 1', joined_at: '2024-01-01' },
                        { id: 2, name: 'Cohort 2', joined_at: '2024-01-02' }
                    ])
                } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(fetch).toHaveBeenCalledWith(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/?org_id=1`
                );
            });
        });

        it('should show school not found when API returns error', async () => {
            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });

            // Mock API error
            (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
                ok: false,
                status: 404
            } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.getByText('School not found')).toBeInTheDocument();
            });
        });
    });

    describe('Admin Banner', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-1' },
                isAuthenticated: true,
                isLoading: false
            });
        });

        it('should show admin banner for admin users', async () => {
            (useSchools as jest.Mock).mockReturnValue({
                schools: [{ id: '1', role: 'admin' }]
            });

            // Mock successful API responses
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Cohort 1', joined_at: '2024-01-01' }
                    ])
                } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.getByText(/You are viewing all the cohorts/)).toBeInTheDocument();
            });
        });

        it('should not show admin banner for regular users', async () => {
            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });

            // Mock successful API responses
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Cohort 1', joined_at: '2024-01-01' }
                    ])
                } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.queryByText(/You are viewing all the cohorts/)).not.toBeInTheDocument();
            });
        });
    });

    describe('Cohort Management', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-1' },
                isAuthenticated: true,
                isLoading: false
            });

            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });
        });

        it('should show no cohorts message when user has no cohorts', async () => {
            // Mock school API response
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                // Mock empty cohorts response
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([])
                } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.getByText('No cohorts available')).toBeInTheDocument();
                expect(screen.getByText('You are not enrolled in any cohorts for this school')).toBeInTheDocument();
            });
        });

        it('should handle cohort selection from header', async () => {
            // Mock successful API responses
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Cohort 1', joined_at: '2024-01-01' },
                        { id: 2, name: 'Cohort 2', joined_at: '2024-01-02' }
                    ])
                } as Response)
                // Mock courses response
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Course 1', milestones: [] }
                    ])
                } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.getByTestId('active-cohort')).toHaveTextContent('Cohort 1');
            });

            // Click cohort select button
            const cohortSelectButton = screen.getByTestId('cohort-select-trigger');
            fireEvent.click(cohortSelectButton);

            await waitFor(() => {
                expect(screen.getByTestId('active-cohort')).toHaveTextContent('Test Cohort 2');
                expect(mockReplace).toHaveBeenCalledWith(
                    '/school/test-school?cohort_id=2',
                    { scroll: false }
                );
            });
        });
    });

    describe('Course Management', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-1' },
                isAuthenticated: true,
                isLoading: false
            });

            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });

            // Mock school and cohorts setup
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Cohort 1', joined_at: '2024-01-01' }
                    ])
                } as Response);
        });

        it('should show no courses message when cohort has no courses', async () => {
            // Mock empty courses response
            (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([])
            } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.getByText('No courses available')).toBeInTheDocument();
                expect(screen.getByText('There are no courses in this cohort yet')).toBeInTheDocument();
            });
        });

        it('should load and display courses', async () => {
            // Mock courses response
            (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([
                    { id: 1, name: 'Course 1', milestones: [] },
                    { id: 2, name: 'Course 2', milestones: [] }
                ])
            } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.getByTestId('learner-cohort-view')).toBeInTheDocument();
                expect(screen.getByTestId('courses-count')).toHaveTextContent('2');
            });
        });

        it('should handle course selection', async () => {
            // Mock courses response
            (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([
                    { id: 1, name: 'Course 1', milestones: [] },
                    { id: 2, name: 'Course 2', milestones: [] }
                ])
            } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.getByTestId('active-course-index')).toHaveTextContent('0');
            });

            // Click course select button
            const courseSelectButton = screen.getByTestId('course-select-trigger');
            fireEvent.click(courseSelectButton);

            await waitFor(() => {
                expect(screen.getByTestId('active-course-index')).toHaveTextContent('1');
                expect(mockReplace).toHaveBeenCalledWith(
                    '/school/test-school?course_id=2',
                    { scroll: false }
                );
            });
        });

        it('should show error message and retry button on courses fetch failure', async () => {
            // Mock courses API error
            (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
                ok: false,
                status: 500
            } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.getByText('Failed to load courses. Please try again.')).toBeInTheDocument();
                expect(screen.getByText('Try Again')).toBeInTheDocument();
            });

            // Test retry functionality
            const retryButton = screen.getByText('Try Again');

            // Mock successful retry
            (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([
                    { id: 1, name: 'Course 1', milestones: [] }
                ])
            } as Response);

            fireEvent.click(retryButton);

            await waitFor(() => {
                expect(screen.getByTestId('learner-cohort-view')).toBeInTheDocument();
            });
        });
    });

    describe('URL Parameter Handling', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-1' },
                isAuthenticated: true,
                isLoading: false
            });

            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });
        });

        it('should select cohort from URL parameters', async () => {
            // Mock search params to include cohort_id
            (useSearchParams as jest.Mock).mockReturnValue({
                get: jest.fn((key: string) => {
                    if (key === 'cohort_id') return '2';
                    return null;
                }),
            });

            // Mock API responses
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Cohort 1', joined_at: '2024-01-01' },
                        { id: 2, name: 'Cohort 2', joined_at: '2024-01-02' }
                    ])
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Course 1', milestones: [] }
                    ])
                } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.getByTestId('active-cohort')).toHaveTextContent('Cohort 2');
            });
        });

        it('should select course from URL parameters', async () => {
            // Mock search params to include course_id
            (useSearchParams as jest.Mock).mockReturnValue({
                get: jest.fn((key: string) => {
                    if (key === 'course_id') return '2';
                    return null;
                }),
            });

            // Mock API responses
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Cohort 1', joined_at: '2024-01-01' }
                    ])
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Course 1', milestones: [] },
                        { id: 2, name: 'Course 2', milestones: [] }
                    ])
                } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(screen.getByTestId('active-course-index')).toHaveTextContent('1');
            });
        });
    });

    describe('Completion Data', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-1' },
                isAuthenticated: true,
                isLoading: false
            });

            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });
        });

        it('should load and pass completion data to LearnerCohortView', async () => {
            // Mock successful API responses
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Cohort 1', joined_at: '2024-01-01' }
                    ])
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Course 1', milestones: [] }
                    ])
                } as Response);

            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                expect(getCompletionData).toHaveBeenCalledWith(1, 'user-1');
                expect(screen.getByTestId('completed-tasks-count')).toHaveTextContent('1');
                expect(screen.getByTestId('completed-questions-count')).toHaveTextContent('1');
            });
        });
    });

    describe('Mobile Interactions', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-1' },
                isAuthenticated: true,
                isLoading: false
            });

            (useSchools as jest.Mock).mockReturnValue({
                schools: []
            });

            // Mock successful setup
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        id: '1',
                        name: 'Test School',
                        slug: 'test-school'
                    })
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Cohort 1', joined_at: '2024-01-01' },
                        { id: 2, name: 'Cohort 2', joined_at: '2024-01-02' }
                    ])
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 1, name: 'Course 1', milestones: [] }
                    ])
                } as Response);
        });

        it('should handle back button click', async () => {
            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                // Find the back button by its class and icon presence
                const backButton = document.querySelector('button.mr-2.text-white');
                expect(backButton).toBeInTheDocument();
                fireEvent.click(backButton!);
                expect(mockPush).toHaveBeenCalledWith('/');
            });
        });

        it('should open mobile dropdown when switch button is clicked', async () => {
            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                const switchButton = screen.getByText('Switch');
                fireEvent.click(switchButton);
                expect(screen.getByTestId('mobile-dropdown')).toBeInTheDocument();
                expect(screen.getByTestId('dropdown-title')).toHaveTextContent('Switch Cohort');
            });
        });

        it('should handle cohort selection from mobile dropdown', async () => {
            render(<ClientSchoolMemberView slug="test-school" />);

            await waitFor(() => {
                const switchButton = screen.getByText('Switch');
                fireEvent.click(switchButton);
            });

            const cohortOption = screen.getByTestId('dropdown-option-2');
            fireEvent.click(cohortOption);

            await waitFor(() => {
                expect(mockReplace).toHaveBeenCalledWith(
                    '/school/test-school?cohort_id=2',
                    { scroll: false }
                );
            });
        });
    });
}); 