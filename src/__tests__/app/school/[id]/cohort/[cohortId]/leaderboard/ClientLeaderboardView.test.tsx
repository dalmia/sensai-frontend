import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ClientLeaderboardView from '@/app/school/[id]/cohort/[cohortId]/leaderboard/ClientLeaderboardView';
import { useAuth } from '@/lib/auth';

// Mock dependencies
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@/components/layout/header', () => ({
    Header: function MockHeader({ showCreateCourseButton }: any) {
        return (
            <header data-testid="header">
                <div data-testid="show-create-course-button">{showCreateCourseButton.toString()}</div>
            </header>
        );
    }
}));

jest.mock('next/image', () => {
    return function MockImage({ src, alt, ...props }: any) {
        return <img src={src} alt={alt} data-testid="mock-image" {...props} />;
    };
});

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockPush = jest.fn();
const mockBack = jest.fn();

describe('ClientLeaderboardView', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock router
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            back: mockBack,
            prefetch: jest.fn(),
            replace: jest.fn(),
            forward: jest.fn(),
            refresh: jest.fn(),
        });

        // Mock auth
        (useAuth as jest.Mock).mockReturnValue({
            user: { id: '1', name: 'Test User' }
        });

        // Mock environment variable
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:3001';
    });

    describe('Loading State', () => {
        it('should show loading spinner when fetching data', async () => {
            // Mock pending fetch
            mockFetch.mockImplementation(() => new Promise(() => { }));

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            expect(screen.getByRole('main')).toBeInTheDocument();
            expect(screen.getByTestId('header')).toBeInTheDocument();
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });
    });

    describe('Error State', () => {
        it('should show error message when fetch fails', async () => {
            mockFetch.mockRejectedValueOnce(new Error('API Error'));

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Failed to load leaderboard data. Please try again.')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
            });
        });

        it('should show error message when response is not ok', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: () => Promise.resolve({})
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Failed to load leaderboard data. Please try again.')).toBeInTheDocument();
            });
        });

        it('should reload page when try again button is clicked', async () => {
            const mockReload = jest.fn();
            Object.defineProperty(window, 'location', {
                value: { reload: mockReload },
                writable: true
            });

            mockFetch.mockRejectedValueOnce(new Error('API Error'));

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
            expect(mockReload).toHaveBeenCalled();
        });
    });

    describe('Empty State', () => {
        it('should show empty state message when no performers', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: [] })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('No learners in the cohort yet')).toBeInTheDocument();
                expect(screen.getByText('The leaderboard will appear once learners are added')).toBeInTheDocument();
            });
        });
    });

    describe('Success State with Data', () => {
        const mockPerformersData = {
            stats: [
                {
                    user: { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
                    streak_count: 5,
                    tasks_completed: 10
                },
                {
                    user: { id: 2, first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' },
                    streak_count: 3,
                    tasks_completed: 8
                },
                {
                    user: { id: 3, first_name: '', last_name: '', email: 'user@example.com' },
                    streak_count: 0,
                    tasks_completed: 5
                }
            ]
        };

        beforeEach(() => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockPerformersData)
            });
        });

        it('should display leaderboard with performers data', async () => {
            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
                expect(screen.getByText('Jane Smith')).toBeInTheDocument();
                expect(screen.getByText('user@example.com')).toBeInTheDocument();
            });

            // Check column headers
            expect(screen.getByText('Rank')).toBeInTheDocument();
            expect(screen.getByText('Learner')).toBeInTheDocument();
            expect(screen.getByText('Streak')).toBeInTheDocument();
            expect(screen.getByText('Tasks completed')).toBeInTheDocument();
        });

        it('should highlight current user', async () => {
            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('You')).toBeInTheDocument();
            });
        });

        it('should show medals for top 3 performers with streaks > 0', async () => {
            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                const images = screen.getAllByTestId('mock-image');
                expect(images).toHaveLength(2); // Only John and Jane should have medals (positions 1 and 2 with streaks > 0)
                expect(images[0]).toHaveAttribute('src', '/images/leaderboard_1.svg');
                expect(images[1]).toHaveAttribute('src', '/images/leaderboard_2.svg');
            });
        });

        it('should limit performers when topN is specified', async () => {
            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                    topN={2}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
                expect(screen.getByText('Jane Smith')).toBeInTheDocument();
                expect(screen.queryByText('user@example.com')).not.toBeInTheDocument();
            });
        });
    });

    describe('Learner View', () => {
        const mockPerformersData = {
            stats: [
                {
                    user: { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
                    streak_count: 5,
                    tasks_completed: 10
                }
            ]
        };

        beforeEach(() => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockPerformersData)
            });
        });

        it('should show header in learner view', async () => {
            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            expect(screen.getByTestId('header')).toBeInTheDocument();
        });

        it('should show breadcrumb navigation in learner view', async () => {
            await act(async () => {
                render(
                    <ClientLeaderboardView
                        cohortId="cohort-1"
                        cohortName="Test Cohort"
                        view="learner"
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('Test Cohort')).toBeInTheDocument();
                // Look for the desktop version specifically
                const desktopLeaderboard = screen.getByText((content, element) => {
                    return element?.tagName === 'SPAN' &&
                        element?.className.includes('text-4xl') &&
                        content === 'Leaderboard';
                });
                expect(desktopLeaderboard).toBeInTheDocument();
            });
        });

        it('should navigate back when breadcrumb cohort name is clicked', async () => {
            await act(async () => {
                render(
                    <ClientLeaderboardView
                        cohortId="cohort-1"
                        cohortName="Test Cohort"
                        view="learner"
                    />
                );
            });

            await waitFor(() => {
                const cohortLink = screen.getByText('Test Cohort');
                fireEvent.click(cohortLink);
                expect(mockBack).toHaveBeenCalled();
            });
        });

        it('should show mobile back button and handle click', async () => {
            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 640,
            });

            await act(async () => {
                render(
                    <ClientLeaderboardView
                        cohortId="cohort-1"
                        cohortName="Test Cohort"
                        view="learner"
                    />
                );
            });

            await waitFor(() => {
                const backButton = screen.getByText('Back to Test Cohort');
                expect(backButton).toBeInTheDocument();
                fireEvent.click(backButton);
                expect(mockBack).toHaveBeenCalled();
            });
        });
    });

    describe('Admin View', () => {
        const mockPerformersData = {
            stats: [
                {
                    user: { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
                    streak_count: 5,
                    tasks_completed: 10
                }
            ]
        };

        beforeEach(() => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockPerformersData)
            });
        });

        it('should not show header in admin view', async () => {
            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="admin"
                />
            );

            expect(screen.queryByTestId('header')).not.toBeInTheDocument();
        });

        it('should not show navigation elements in admin view', async () => {
            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="admin"
                />
            );

            await waitFor(() => {
                expect(screen.queryByText('Back to Test Cohort')).not.toBeInTheDocument();
                // The title elements should not be present in admin view
                expect(screen.queryByText(/Test Cohort/)).not.toBeInTheDocument();
            });
        });

        it('should use compact layout in admin view', async () => {
            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="admin"
                />
            );

            await waitFor(() => {
                const mainElement = screen.getByRole('main');
                expect(mainElement).not.toHaveClass('px-4', 'md:py-8');
            });
        });
    });

    describe('API Integration', () => {
        it('should make correct API call', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: [] })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-123"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-123/leaderboard'
                );
            });
        });

        it('should make correct API call with batchId when provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: [] })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-123"
                    cohortName="Test Cohort"
                    view="learner"
                    batchId={456}
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-123/leaderboard?batch_id=456'
                );
            });
        });

        it('should make correct API call with batchId 0 when provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: [] })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-123"
                    cohortName="Test Cohort"
                    view="learner"
                    batchId={0}
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-123/leaderboard?batch_id=0'
                );
            });
        });

        it('should make correct API call without batch_id when batchId is null', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: [] })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-123"
                    cohortName="Test Cohort"
                    view="learner"
                    batchId={null}
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-123/leaderboard'
                );
            });
        });

        it('should make correct API call without batch_id when batchId is undefined', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: [] })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-123"
                    cohortName="Test Cohort"
                    view="learner"
                    batchId={undefined}
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-123/leaderboard'
                );
            });
        });

        it('should not make API call without cohortId or user', async () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: null
            });

            render(
                <ClientLeaderboardView
                    cohortId=""
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('Name Display Logic', () => {
        it('should display full name when both first and last name are available', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    stats: [{
                        user: { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
                        streak_count: 1,
                        tasks_completed: 5
                    }]
                })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });
        });

        it('should display first name only when last name is missing', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    stats: [{
                        user: { id: 1, first_name: 'John', last_name: '', email: 'john@example.com' },
                        streak_count: 1,
                        tasks_completed: 5
                    }]
                })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('John')).toBeInTheDocument();
            });
        });

        it('should display email when both names are missing', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    stats: [{
                        user: { id: 1, first_name: '', last_name: '', email: 'john@example.com' },
                        streak_count: 1,
                        tasks_completed: 5
                    }]
                })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('john@example.com')).toBeInTheDocument();
            });
        });
    });

    describe('Cohort Name Fallback', () => {
        it('should use default cohort name when not provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: [] })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    view="learner"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Introduction to Programming')).toBeInTheDocument();
            });
        });
    });

    describe('Batch ID Integration', () => {
        const mockBatchPerformersData = {
            stats: [
                {
                    user: { id: 1, first_name: 'Alice', last_name: 'Johnson', email: 'alice@example.com' },
                    streak_count: 7,
                    tasks_completed: 15
                },
                {
                    user: { id: 2, first_name: 'Bob', last_name: 'Wilson', email: 'bob@example.com' },
                    streak_count: 2,
                    tasks_completed: 8
                }
            ]
        };

        it('should display batch-specific leaderboard data when batchId is provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockBatchPerformersData)
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="learner"
                    batchId={123}
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-1/leaderboard?batch_id=123'
                );
                expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
                expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
                expect(screen.getByText('15')).toBeInTheDocument(); // tasks completed
                expect(screen.getByText('8')).toBeInTheDocument(); // tasks completed
            });
        });

        it('should handle error state correctly when batchId is provided', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Batch API Error'));

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="admin"
                    batchId={456}
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-1/leaderboard?batch_id=456'
                );
                expect(screen.getByText('Failed to load leaderboard data. Please try again.')).toBeInTheDocument();
            });
        });

        it('should handle empty batch data correctly', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: [] })
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="admin"
                    batchId={789}
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-1/leaderboard?batch_id=789'
                );
                expect(screen.getByText('No learners in the cohort yet')).toBeInTheDocument();
            });
        });

        it('should limit batch performers when topN is specified', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockBatchPerformersData)
            });

            render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="admin"
                    batchId={123}
                    topN={1}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
                expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument();
            });
        });

        it('should refetch data when batchId changes', async () => {
            const { rerender } = render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="admin"
                    batchId={123}
                />
            );

            // First call with batch 123
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-1/leaderboard?batch_id=123'
                );
            });

            mockFetch.mockClear();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: [] })
            });

            // Change batchId and verify new call is made
            rerender(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="admin"
                    batchId={456}
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-1/leaderboard?batch_id=456'
                );
            });
        });

        it('should refetch data when batchId changes from null to a value', async () => {
            const { rerender } = render(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="admin"
                    batchId={null}
                />
            );

            // First call without batch
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-1/leaderboard'
                );
            });

            mockFetch.mockClear();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ stats: [] })
            });

            // Change to specific batchId
            rerender(
                <ClientLeaderboardView
                    cohortId="cohort-1"
                    cohortName="Test Cohort"
                    view="admin"
                    batchId={789}
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/cohorts/cohort-1/leaderboard?batch_id=789'
                );
            });
        });
    });
}); 