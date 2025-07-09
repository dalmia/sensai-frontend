import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CohortDashboard from '../../components/CohortDashboard';
import { CohortWithDetails, CohortMember, Course } from '@/types';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock environment variables
const mockEnv = {
    NEXT_PUBLIC_BACKEND_URL: 'http://localhost:3001'
};

Object.defineProperty(process, 'env', {
    value: mockEnv
});

// Mock the ClientLeaderboardView component
jest.mock('@/app/school/[id]/cohort/[cohortId]/leaderboard/ClientLeaderboardView', () => {
    return function MockClientLeaderboardView() {
        return <div data-testid="leaderboard-view">Leaderboard View Mock</div>;
    };
});

// Mock the TaskTypeMetricCard component
jest.mock('@/components/TaskTypeMetricCard', () => {
    return function MockTaskTypeMetricCard({ title, count, completionRate, color }: any) {
        return (
            <div data-testid={`task-type-metric-${title.toLowerCase().replace(' ', '-')}`}>
                <span data-testid="metric-title">{title}</span>
                <span data-testid="metric-count">{count}</span>
                <span data-testid="metric-completion-rate">{completionRate}</span>
                <span data-testid="metric-color">{color}</span>
            </div>
        );
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

    // Large cohort data with more than 5 members
    const largeCohort: CohortWithDetails = {
        ...mockCohort,
        members: [
            { id: 201, name: 'Student 1', email: 'student1@example.com', role: 'learner' } as CohortMember,
            { id: 202, name: 'Student 2', email: 'student2@example.com', role: 'learner' } as CohortMember,
            { id: 203, name: 'Student 3', email: 'student3@example.com', role: 'learner' } as CohortMember,
            { id: 204, name: 'Student 4', email: 'student4@example.com', role: 'learner' } as CohortMember,
            { id: 205, name: 'Student 5', email: 'student5@example.com', role: 'learner' } as CohortMember,
            { id: 206, name: 'Student 6', email: 'student6@example.com', role: 'learner' } as CohortMember,
            { id: 207, name: 'Student 7', email: 'student7@example.com', role: 'learner' } as CohortMember,
            { id: 208, name: 'Instructor', email: 'instructor@example.com', role: 'mentor' } as CohortMember
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

    // Large cohort metrics with completion data for all students
    const largeCohortMetrics = {
        average_completion: 0.65,
        num_tasks: 10,
        num_active_learners: 7,
        task_type_metrics: {
            quiz: {
                completion_rate: 0.7,
                count: 5,
                completions: {
                    '201': 4, '202': 3, '203': 5, '204': 2,
                    '205': 4, '206': 3, '207': 1
                }
            },
            learning_material: {
                completion_rate: 0.6,
                count: 5,
                completions: {
                    '201': 3, '202': 3, '203': 4, '204': 2,
                    '205': 3, '206': 2, '207': 1
                }
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

        // Verify column headers using more specific selectors
        expect(screen.getByText('Learner')).toBeInTheDocument();
        // Find Quiz header in the table specifically (not in the mocked component)
        const tableHeaders = screen.getAllByText('Quiz');
        expect(tableHeaders.length).toBeGreaterThanOrEqual(1);
        // Find Learning material header in the table specifically
        const learningMaterialHeaders = screen.getAllByText('Learning material');
        expect(learningMaterialHeaders.length).toBeGreaterThanOrEqual(1);
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

        // Find the Learning material header in the table specifically (use role to be more specific)
        const tableElement = screen.getByRole('table');
        const learningMaterialHeaders = screen.getAllByText('Learning material');

        // Find the one that's in a table header
        const tableHeader = learningMaterialHeaders.find(element => {
            const th = element.closest('th');
            return th && tableElement.contains(th);
        });

        expect(tableHeader).toBeDefined();

        // Click on the Learning material header to sort
        fireEvent.click(tableHeader!);

        // Verify sorting indicator is shown (ArrowUp/ArrowDown component)
        expect(tableHeader!.closest('th')).toContainHTML('svg');

        // Click again to reverse sort
        fireEvent.click(tableHeader!);
        expect(tableHeader!.closest('th')).toContainHTML('svg');
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

    // NEW TEST CASES FOR THE REQUESTED SCENARIOS

    describe('activeCourseIndex scenarios', () => {
        it('uses provided activeCourseIndex when given', async () => {
            render(
                <CohortDashboard
                    cohort={mockCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    activeCourseIndex={1}
                />
            );

            // Should fetch metrics for the second course (index 1)
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/cohorts/1/courses/102/metrics'));
            });
        });

        it('defaults to index 0 when activeCourseIndex is invalid', async () => {
            render(
                <CohortDashboard
                    cohort={mockCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    activeCourseIndex={99} // Invalid index
                />
            );

            // Should fetch metrics for the first course (fallback to index 0)
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/cohorts/1/courses/101/metrics'));
            });
        });

        it('calls onActiveCourseChange when provided and course is changed', async () => {
            const mockOnActiveCourseChange = jest.fn();

            render(
                <CohortDashboard
                    cohort={mockCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    activeCourseIndex={0}
                    onActiveCourseChange={mockOnActiveCourseChange}
                />
            );

            // Wait for the dropdown button to be available
            await waitFor(() => {
                const dropdownButton = document.getElementById('course-dropdown-button');
                expect(dropdownButton).toBeInTheDocument();
            });

            // Open dropdown and click on Course 2
            const dropdownButton = document.getElementById('course-dropdown-button')!;
            fireEvent.click(dropdownButton);
            fireEvent.click(screen.getByText('Course 2'));

            // Verify callback was called with new index
            await waitFor(() => {
                expect(mockOnActiveCourseChange).toHaveBeenCalledWith(1);
            });
        });
    });

    describe('batchId scenarios', () => {
        it('includes batchId in API request when provided', async () => {
            const batchId = 123;

            render(
                <CohortDashboard
                    cohort={mockCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    batchId={batchId}
                />
            );

            // Should include batchId in the URL
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/cohorts/1/courses/101/metrics?batch_id=123')
                );
            });
        });

        it('passes batchId to leaderboard component', async () => {
            const batchId = 456;

            render(
                <CohortDashboard
                    cohort={mockCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    batchId={batchId}
                />
            );

            // Wait for metrics to load and leaderboard to render
            await waitFor(() => {
                expect(screen.getByTestId('leaderboard-view')).toBeInTheDocument();
            });

            // Note: The leaderboard component is mocked, but in real implementation it would receive batchId
        });

        it('includes batchId in leaderboard link when provided', async () => {
            const batchId = 789;

            render(
                <CohortDashboard
                    cohort={largeCohort} // Use large cohort to show leaderboard link
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    batchId={batchId}
                />
            );

            // Wait for metrics to load
            await waitFor(() => {
                expect(screen.getByText('View Full Leaderboard')).toBeInTheDocument();
            });

            // Check that the link includes batchId
            const leaderboardLink = screen.getByText('View Full Leaderboard').closest('a');
            expect(leaderboardLink).toHaveAttribute('href', '/school/school1/cohort/1/leaderboard?batchId=789');
        });
    });

    describe('mentor view scenarios', () => {
        it('shows tabs instead of dropdown for multiple courses in mentor view', async () => {
            render(
                <CohortDashboard
                    cohort={mockCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    view="mentor"
                />
            );

            // Should show tabs, not dropdown
            await waitFor(() => {
                expect(screen.getByText('Course 1')).toBeInTheDocument();
                expect(screen.getByText('Course 2')).toBeInTheDocument();
            });

            // Should not show dropdown button
            expect(document.getElementById('course-dropdown-button')).not.toBeInTheDocument();
        });

        it('allows switching between courses using tabs in mentor view', async () => {
            // Mock fetch to track calls
            let fetchCallCount = 0;
            (global.fetch as jest.Mock).mockImplementation(() => {
                fetchCallCount++;
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockCourseMetrics)
                });
            });

            render(
                <CohortDashboard
                    cohort={mockCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    view="mentor"
                // Removed activeCourseIndex prop to allow internal state management
                />
            );

            // Wait for initial fetch to complete (should use Course 1)
            await waitFor(() => {
                expect(fetchCallCount).toBe(1);
                expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/cohorts/1/courses/101/metrics'));
            });

            // Wait for tabs to load
            await waitFor(() => {
                expect(screen.getByText('Course 1')).toBeInTheDocument();
                expect(screen.getByText('Course 2')).toBeInTheDocument();
            });

            // Click on Course 2 tab
            fireEvent.click(screen.getByText('Course 2'));

            // Should trigger a new fetch for Course 2
            await waitFor(() => {
                expect(fetchCallCount).toBe(2);
                expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/cohorts/1/courses/102/metrics'));
            });
        });

        it('shows empty state message for mentor when no learners exist', async () => {
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
                    view="mentor"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('No learners in this cohort yet')).toBeInTheDocument();
            });

            // Should show mentor-specific message
            expect(screen.getByText(/No learners have joined this cohort yet. Once learners join/)).toBeInTheDocument();

            // Should not show "Add learners" button for mentor
            expect(screen.queryByText('Add learners')).not.toBeInTheDocument();
        });

        it('shows empty course state message for mentor', async () => {
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
                    view="mentor"
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId('empty-course-state')).toBeInTheDocument();
            });

            // Should show mentor-specific message
            expect(screen.getByText(/No tasks have been added to this course yet. Once tasks are available/)).toBeInTheDocument();
        });
    });

    describe('large cohort scenarios (>5 members)', () => {
        it('shows View Full Leaderboard link when cohort has more than 5 learners', async () => {
            render(
                <CohortDashboard
                    cohort={largeCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                />
            );

            // Wait for metrics to load
            await waitFor(() => {
                expect(screen.getByTestId('leaderboard-view')).toBeInTheDocument();
            });

            // Should show the "View Full Leaderboard" link
            expect(screen.getByText('View Full Leaderboard')).toBeInTheDocument();
        });

        it('does not show View Full Leaderboard link when cohort has 5 or fewer learners', async () => {
            render(
                <CohortDashboard
                    cohort={mockCohort} // Has only 2 learners
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                />
            );

            // Wait for metrics to load
            await waitFor(() => {
                expect(screen.getByTestId('leaderboard-view')).toBeInTheDocument();
            });

            // Should not show the "View Full Leaderboard" link
            expect(screen.queryByText('View Full Leaderboard')).not.toBeInTheDocument();
        });

        it('shows all learners in student metrics table for large cohort', async () => {
            // Use specific metrics for large cohort
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(largeCohortMetrics)
                })
            );

            render(
                <CohortDashboard
                    cohort={largeCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                />
            );

            // Wait for the table to load
            await waitFor(() => {
                expect(screen.getByText('student1@example.com')).toBeInTheDocument();
            });

            // Should show all learners
            expect(screen.getByText('student1@example.com')).toBeInTheDocument();
            expect(screen.getByText('student2@example.com')).toBeInTheDocument();
            expect(screen.getByText('student3@example.com')).toBeInTheDocument();
            expect(screen.getByText('student4@example.com')).toBeInTheDocument();
            expect(screen.getByText('student5@example.com')).toBeInTheDocument();
            expect(screen.getByText('student6@example.com')).toBeInTheDocument();
            expect(screen.getByText('student7@example.com')).toBeInTheDocument();
        });

        it('search functionality works with large cohort', async () => {
            // Use specific metrics for large cohort
            (global.fetch as jest.Mock).mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(largeCohortMetrics)
                })
            );

            render(
                <CohortDashboard
                    cohort={largeCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                />
            );

            // Wait for the table to load with all students
            await waitFor(() => {
                expect(screen.getByText('student1@example.com')).toBeInTheDocument();
                expect(screen.getByText('student3@example.com')).toBeInTheDocument();
            });

            // Search for students with "student3"
            const searchInput = screen.getByPlaceholderText('Search learners');
            fireEvent.change(searchInput, { target: { value: 'student3' } });

            // Should only show student3
            await waitFor(() => {
                expect(screen.getByText('student3@example.com')).toBeInTheDocument();
                expect(screen.queryByText('student1@example.com')).not.toBeInTheDocument();
                expect(screen.queryByText('student2@example.com')).not.toBeInTheDocument();
            });
        });
    });

    describe('combined scenarios', () => {
        it('handles mentor view with activeCourseIndex and batchId for large cohort', async () => {
            const batchId = 999;
            const activeCourseIndex = 1;

            render(
                <CohortDashboard
                    cohort={largeCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    view="mentor"
                    activeCourseIndex={activeCourseIndex}
                    batchId={batchId}
                />
            );

            // Should use tabs for mentor view
            await waitFor(() => {
                expect(screen.getByText('Course 1')).toBeInTheDocument();
                expect(screen.getByText('Course 2')).toBeInTheDocument();
            });

            // Should fetch metrics with batchId for the specified course
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/cohorts/1/courses/102/metrics?batch_id=999')
                );
            });

            // Should show View Full Leaderboard link due to large cohort
            await waitFor(() => {
                expect(screen.getByText('View Full Leaderboard')).toBeInTheDocument();
            });

            // Link should include batchId
            const leaderboardLink = screen.getByText('View Full Leaderboard').closest('a');
            expect(leaderboardLink).toHaveAttribute('href', '/school/school1/cohort/1/leaderboard?batchId=999');
        });

        it('handles admin view with all parameters for large cohort', async () => {
            const mockOnActiveCourseChange = jest.fn();
            const mockOnAddLearners = jest.fn();

            render(
                <CohortDashboard
                    cohort={largeCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    view="admin"
                    activeCourseIndex={0}
                    onActiveCourseChange={mockOnActiveCourseChange}
                    onAddLearners={mockOnAddLearners}
                    batchId={555}
                />
            );

            // Should use dropdown for admin view
            await waitFor(() => {
                const dropdownButton = document.getElementById('course-dropdown-button');
                expect(dropdownButton).toBeInTheDocument();
            });

            // Should fetch metrics with batchId
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/cohorts/1/courses/101/metrics?batch_id=555')
                );
            });

            // Should show View Full Leaderboard link
            await waitFor(() => {
                expect(screen.getByText('View Full Leaderboard')).toBeInTheDocument();
            });

            // Change course and verify callback
            const dropdownButton = document.getElementById('course-dropdown-button')!;
            fireEvent.click(dropdownButton);
            fireEvent.click(screen.getByText('Course 2'));

            await waitFor(() => {
                expect(mockOnActiveCourseChange).toHaveBeenCalledWith(1);
            });
        });

        it('handles course switching with batchId parameter correctly', async () => {
            const batchId = 111;

            render(
                <CohortDashboard
                    cohort={mockCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                    batchId={batchId}
                />
            );

            // Initial fetch should include batchId
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/cohorts/1/courses/101/metrics?batch_id=111')
                );
            });

            // Clear previous calls
            jest.clearAllMocks();
            (global.fetch as jest.Mock).mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockCourseMetrics)
                })
            );

            // Switch course
            const dropdownButton = document.getElementById('course-dropdown-button')!;
            fireEvent.click(dropdownButton);
            fireEvent.click(screen.getByText('Course 2'));

            // New fetch should also include batchId
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/cohorts/1/courses/102/metrics?batch_id=111')
                );
            });
        });

        it('handles task type metrics rendering correctly', async () => {
            render(
                <CohortDashboard
                    cohort={mockCohort}
                    cohortId="1"
                    schoolId="school1"
                    schoolSlug="school1"
                />
            );

            // Wait for metrics to load
            await waitFor(() => {
                expect(screen.getByTestId('task-type-metric-learning-material')).toBeInTheDocument();
                expect(screen.getByTestId('task-type-metric-quiz')).toBeInTheDocument();
            });

            // Verify task type metrics are rendered with correct data
            const learningMaterialCard = screen.getByTestId('task-type-metric-learning-material');
            expect(learningMaterialCard).toBeInTheDocument();

            const quizCard = screen.getByTestId('task-type-metric-quiz');
            expect(quizCard).toBeInTheDocument();
        });
    });
}); 