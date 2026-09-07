import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopPerformers, { Performer } from '../../components/TopPerformers';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

// Mock the modules
jest.mock('@/lib/auth', () => ({
    useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

// Mock createPortal
jest.mock('react-dom', () => ({
    ...jest.requireActual('react-dom'),
    createPortal: jest.fn((element) => element),
}));

// Mock Image component
jest.mock('next/image', () => ({
    __esModule: true,
    default: function MockImage(props: any) {
        return <img {...props} />;
    },
}));

describe('TopPerformers Component', () => {
    // Sample data
    const mockPerformers: Performer[] = [
        { name: 'User One', streakDays: 7, tasksSolved: 15, position: 1, userId: 101 },
        { name: 'User Two', streakDays: 5, tasksSolved: 12, position: 2, userId: 102 },
        { name: 'User Three', streakDays: 3, tasksSolved: 10, position: 3, userId: 103 },
    ];

    // Mock implementations
    const mockPush = jest.fn();
    const mockFetch = jest.fn();
    const mockOnEmptyData = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup router mock
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
        });

        // Setup auth mock
        (useAuth as jest.Mock).mockReturnValue({
            user: { id: '101' } // Default to first user in the list
        });

        // Setup fetch mock
        global.fetch = mockFetch;
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                stats: mockPerformers.map(performer => ({
                    user: {
                        id: performer.userId,
                        first_name: performer.name.split(' ')[0],
                        last_name: performer.name.split(' ')[1] || '',
                    },
                    streak_count: performer.streakDays,
                    tasks_completed: performer.tasksSolved,
                }))
            })
        });

        // Mock environment variable
    });

    it('should render the component with title', async () => {
        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        expect(screen.getByText('Top Performers')).toBeInTheDocument();
        expect(screen.getByText('See All')).toBeInTheDocument();
    });

    it('should fetch performers data on mount', async () => {
        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/backend/cohorts/cohort-123/leaderboard'
        );
    });

    it('should display performers data correctly', async () => {
        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('User One')).toBeInTheDocument();
            expect(screen.getByText('User Two')).toBeInTheDocument();
            expect(screen.getByText('User Three')).toBeInTheDocument();
        });

        // Check streak and tasks info
        expect(screen.getByText('Streak: 7 Days')).toBeInTheDocument();
        expect(screen.getByText('Solved: 15 Tasks')).toBeInTheDocument();
    });

    it('should mark current user with "You" badge in learner view', async () => {
        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="learner"
                />
            );
        });

        await waitFor(() => {
            const youBadge = screen.getByText('You');
            expect(youBadge).toBeInTheDocument();

            // The badge should be near User One since that's our current user (id: 101)
            const userOneElement = screen.getByText('User One');
            expect(userOneElement.parentElement).toContainElement(youBadge);
        });
    });

    it('should navigate to leaderboard when "See All" is clicked', async () => {
        await act(async () => {
            render(
                <TopPerformers
                    schoolId="school-456"
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        // Click See All button
        fireEvent.click(screen.getByText('See All'));

        expect(mockPush).toHaveBeenCalledWith('/school/school-456/cohort/cohort-123/leaderboard');
    });

    it('should refresh data when refresh button is clicked', async () => {
        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        // First call on component mount
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Click refresh button
        const refreshButton = screen.getByLabelText('Refresh leaderboard');

        await act(async () => {
            fireEvent.click(refreshButton);
        });

        // Should call fetch again
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    it('should show empty state when no performers data is available', async () => {
        // Mock empty performers data
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ stats: [] })
        });

        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                    onEmptyData={mockOnEmptyData}
                />
            );
        });

        await waitFor(() => {
            expect(mockOnEmptyData).toHaveBeenCalledWith(true);
        });
    });

    it('should handle loading state', async () => {
        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        // Component should render without errors during loading
        expect(screen.getByText('Top Performers')).toBeInTheDocument();
    });

    it('should handle error state gracefully', async () => {
        // Mock fetch error
        mockFetch.mockRejectedValueOnce(new Error('API Error'));

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('Error fetching top performers:', expect.any(Error));
        });

        consoleSpy.mockRestore();
    });

    it('should not fetch data when cohortId or user is missing', async () => {
        (useAuth as jest.Mock).mockReturnValue({ user: null });

        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle admin view correctly', async () => {
        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        await waitFor(() => {
            expect(screen.getByText('User One')).toBeInTheDocument();
        });

        // In admin view, there should be no "You" badge
        expect(screen.queryByText('You')).not.toBeInTheDocument();
    });

    it('should show refresh tooltip on hover', async () => {
        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        const refreshButton = screen.getByLabelText('Refresh leaderboard');

        fireEvent.mouseEnter(refreshButton);

        await waitFor(() => {
            expect(screen.getByText('Refresh')).toBeInTheDocument();
        });

        fireEvent.mouseLeave(refreshButton);
    });

    it('should handle performers with zero stats', async () => {
        const performersWithZeroStats = [
            { name: 'Zero User', streakDays: 0, tasksSolved: 0, position: 1, userId: 999 }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                stats: performersWithZeroStats.map(performer => ({
                    user: {
                        id: performer.userId,
                        first_name: performer.name.split(' ')[0],
                        last_name: performer.name.split(' ')[1] || '',
                    },
                    streak_count: performer.streakDays,
                    tasks_completed: performer.tasksSolved,
                }))
            })
        });

        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                    onEmptyData={mockOnEmptyData}
                />
            );
        });

        // Wait for data to load and verify the performer is displayed
        await waitFor(() => {
            expect(screen.getByText('Zero User')).toBeInTheDocument();
            expect(screen.getByText('Streak: 0 Days')).toBeInTheDocument();
            expect(screen.getByText('Solved: 0 Tasks')).toBeInTheDocument();
        });

        // Since there is a performer (even with zero stats), onEmptyData should be called with false
        expect(mockOnEmptyData).toHaveBeenCalledWith(false);
    });

    it('should handle missing schoolId for navigation', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

        await act(async () => {
            render(
                <TopPerformers
                    cohortId="cohort-123"
                    view="admin"
                />
            );
        });

        fireEvent.click(screen.getByText('See All'));

        expect(consoleSpy).toHaveBeenCalledWith('Cannot navigate to leaderboard: missing schoolId or cohortId');
        expect(mockPush).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
}); 