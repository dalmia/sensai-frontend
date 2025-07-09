import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CohortDashboard from '../../components/CohortDashboard';
import { CohortWithDetails, CohortMember, Course } from '@/types';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock the ClientLeaderboardView component
jest.mock('@/app/school/[id]/cohort/[cohortId]/leaderboard/ClientLeaderboardView', () => {
    return function MockClientLeaderboardView() {
        return <div data-testid="leaderboard-view">Leaderboard View Mock</div>;
    };
});

// Mock TaskTypeMetricCard
jest.mock('@/components/TaskTypeMetricCard', () => {
    return function MockTaskTypeMetricCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
        return (
            <div data-testid={`metric-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
                {title}: {value}
            </div>
        );
    };
});

// Mock Next.js Link component
jest.mock('next/link', () => {
    return function MockLink({ children, href }: { children: React.ReactNode, href: string }) {
        return <a href={href}>{children}</a>;
    };
});

describe('CohortDashboard Component', () => {
    // Sample cohort data for testing
    const mockCohort: CohortWithDetails = {
        id: 1,
        name: 'Test Cohort',
        org_id: 123,
        joined_at: new Date().toISOString(),
        groups: [],
        courses: [
            { id: 101, name: 'Course 1' } as Course,
            { id: 102, name: 'Course 2' } as Course
        ],
        members: [
            { id: 201, name: 'Student 1', email: 'student1@example.com', role: 'learner' } as CohortMember,
            { id: 202, name: 'Student 2', email: 'student2@example.com', role: 'learner' } as CohortMember,
            { id: 203, name: 'Instructor', email: 'instructor@example.com', role: 'mentor' } as CohortMember
        ]
    };

    // Sample metrics data
    const mockCourseMetrics = {
        average_completion: 0.65,
        num_tasks: 10,
        num_active_learners: 2,
        task_type_metrics: {
            quiz: {
                completion_rate: 0.7,
                count: 5,
                completions: { '201': 4, '202': 3 }
            },
            learning_material: {
                completion_rate: 0.6,
                count: 5,
                completions: { '201': 3, '202': 3 }
            }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockImplementation(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockCourseMetrics)
            })
        );
    });

    it('renders empty state when there are no learners', async () => {
        const cohortWithNoLearners: CohortWithDetails = {
            ...mockCohort,
            members: [
                { id: 203, name: 'Instructor', email: 'instructor@example.com', role: 'mentor' } as CohortMember
            ]
        };

        render(
            <CohortDashboard
                cohort={cohortWithNoLearners}
                cohortId="1"
                schoolId="school1"
                schoolSlug="school1"
            />
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.getByText('No learners in this cohort yet')).toBeInTheDocument();
        });

        expect(screen.getByText('Add learners to this cohort to view usage data and metrics')).toBeInTheDocument();
        expect(screen.getByText('Add learners')).toBeInTheDocument();
    });

    it('calls onAddLearners when Add learners button is clicked', async () => {
        const mockOnAddLearners = jest.fn();
        const cohortWithNoLearners: CohortWithDetails = {
            ...mockCohort,
            members: [
                { id: 203, name: 'Instructor', email: 'instructor@example.com', role: 'mentor' } as CohortMember
            ]
        };

        render(
            <CohortDashboard
                cohort={cohortWithNoLearners}
                cohortId="1"
                schoolId="school1"
                schoolSlug="school1"
                onAddLearners={mockOnAddLearners}
            />
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.getByText('Add learners')).toBeInTheDocument();
        });

        // Click the Add learners button
        fireEvent.click(screen.getByText('Add learners'));
        expect(mockOnAddLearners).toHaveBeenCalled();
    });

    it('renders course metrics correctly', async () => {
        render(
            <CohortDashboard
                cohort={mockCohort}
                cohortId="1"
                schoolId="school1"
                schoolSlug="school1"
            />
        );

        // Wait for the metrics to load
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/cohorts/1/courses/101/metrics'));
        });

        // Check if course metrics are displayed - use find to wait for render
        await waitFor(() => {
            const activeLearnersElement = screen.getAllByText('Active learners');
            expect(activeLearnersElement.length).toBeGreaterThan(0);
        });
    });

    it('allows switching between courses', async () => {
        render(
            <CohortDashboard
                cohort={mockCohort}
                cohortId="1"
                schoolId="school1"
                schoolSlug="school1"
            />
        );

        // Wait for the dropdown button to be available - use the unique ID to find it
        await waitFor(() => {
            const dropdownButton = document.getElementById('course-dropdown-button');
            expect(dropdownButton).toBeInTheDocument();
        });

        // Open the dropdown by clicking the specific button with the ID
        const dropdownButton = document.getElementById('course-dropdown-button')!;
        fireEvent.click(dropdownButton);

        // Click on Course 2 - this should still work as there's only one Course 2 element
        fireEvent.click(screen.getByText('Course 2'));

        // Verify the API was called with the new course ID
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/cohorts/1/courses/102/metrics'));
        });
    });

    it('renders student metrics table', async () => {
        render(
            <CohortDashboard
                cohort={mockCohort}
                cohortId="1"
                schoolId="school1"
                schoolSlug="school1"
            />
        );

        // Wait for the table to load
        await waitFor(() => {
            expect(screen.getByText('student1@example.com')).toBeInTheDocument();
            expect(screen.getByText('student2@example.com')).toBeInTheDocument();
        });

        // Verify column headers
        expect(screen.getByText('Learner')).toBeInTheDocument();
        expect(screen.getByText('Quiz')).toBeInTheDocument();
        expect(screen.getByText('Learning material')).toBeInTheDocument();
    });

    it('allows sorting the student metrics table', async () => {
        render(
            <CohortDashboard
                cohort={mockCohort}
                cohortId="1"
                schoolId="school1"
                schoolSlug="school1"
            />
        );

        // Wait for the table to load
        await waitFor(() => {
            expect(screen.getByText('Learner')).toBeInTheDocument();
        });

        // Click on the Learning material header to sort
        fireEvent.click(screen.getByText('Learning material'));

        // Verify sorting indicator is shown (ArrowUp/ArrowDown component)
        expect(screen.getByText('Learning material').closest('th')).toContainHTML('svg');

        // Click again to reverse sort
        fireEvent.click(screen.getByText('Learning material'));
        expect(screen.getByText('Learning material').closest('th')).toContainHTML('svg');
    });

    it('allows searching for students', async () => {
        render(
            <CohortDashboard
                cohort={mockCohort}
                cohortId="1"
                schoolId="school1"
                schoolSlug="school1"
            />
        );

        // Wait for the table to load
        await waitFor(() => {
            expect(screen.getByText('student1@example.com')).toBeInTheDocument();
            expect(screen.getByText('student2@example.com')).toBeInTheDocument();
        });

        // Search for the first student
        const searchInput = screen.getByPlaceholderText('Search learners');
        fireEvent.change(searchInput, { target: { value: 'student1' } });

        // Check that only the first student is shown
        await waitFor(() => {
            expect(screen.getByText('student1@example.com')).toBeInTheDocument();
            expect(screen.queryByText('student2@example.com')).not.toBeInTheDocument();
        });
    });

    it('handles API errors gracefully', async () => {
        // Mock an API error - response object needs json method even though it won't be called
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
            Promise.resolve({
                ok: false,
                status: 500,
                json: () => Promise.resolve({}) // Add json method to prevent additional errors
            })
        );

        render(
            <CohortDashboard
                cohort={mockCohort}
                cohortId="1"
                schoolId="school1"
                schoolSlug="school1"
            />
        );

        // Wait for error message to appear
        await waitFor(() => {
            expect(screen.getByText('There was an error while fetching the metrics. Please try again.')).toBeInTheDocument();
        });

        // Check for the try again button
        expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    it('renders empty course state when metrics are empty', async () => {
        // Mock empty metrics response
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({})
            })
        );

        render(
            <CohortDashboard
                cohort={mockCohort}
                cohortId="1"
                schoolId="school1"
                schoolSlug="school1"
            />
        );

        // Wait for empty course state to appear
        await waitFor(() => {
            expect(screen.getByTestId('empty-course-state')).toBeInTheDocument();
        });

        expect(screen.getByText('Empty Course')).toBeInTheDocument();
        expect(screen.getByText('Add tasks to this course to view usage data and metrics')).toBeInTheDocument();
    });
}); 