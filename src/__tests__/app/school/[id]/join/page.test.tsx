import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import JoinCohortPage from '@/app/school/[id]/join/page';
import { useAuth } from '@/lib/auth';

// Mock dependencies
jest.mock('next/navigation', () => ({
    useParams: jest.fn(),
    useRouter: jest.fn(),
    useSearchParams: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@/components/Toast', () => {
    return function MockToast({ show, title, description, emoji, onClose }: any) {
        return show ? (
            <div data-testid="toast">
                <div data-testid="toast-title">{title}</div>
                <div data-testid="toast-description">{description}</div>
                <div data-testid="toast-emoji">{emoji}</div>
                <button onClick={onClose} data-testid="toast-close">Close</button>
            </div>
        ) : null;
    };
});

// Mock fetch API
global.fetch = jest.fn();

const mockPush = jest.fn();
const mockSearchParams = {
    get: jest.fn(),
};

describe('JoinCohortPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset environment variable
        process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.test.app';

        // Mock router
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            replace: jest.fn(),
            prefetch: jest.fn(),
            back: jest.fn(),
            forward: jest.fn(),
            refresh: jest.fn(),
        });

        // Mock params
        (useParams as jest.Mock).mockReturnValue({
            id: 'test-school',
        });

        // Mock search params
        (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

        // Mock fetch response
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });
    });

    describe('Loading State', () => {
        it('should show loading spinner when auth is loading', () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: null,
                isAuthenticated: false,
                isLoading: true,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');

            render(<JoinCohortPage />);

            expect(screen.getByText('Adding you to the cohort')).toBeInTheDocument();
            expect(screen.getByText('Just a moment while we get everything set up for you')).toBeInTheDocument();
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });
    });

    describe('Authentication Checks', () => {
        it('should show error when user is not authenticated', async () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: null,
                isAuthenticated: false,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByText('Something went wrong')).toBeInTheDocument();
                expect(screen.getByText('You must be logged in to join a cohort')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Back to School' })).toBeInTheDocument();
            });
        });

        it('should show error when user has no email', async () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123' }, // No email
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByText('Something went wrong')).toBeInTheDocument();
                expect(screen.getByText('You must be logged in to join a cohort')).toBeInTheDocument();
            });
        });
    });

    describe('URL Parameter Validation', () => {
        it('should show error when cohortId is missing', async () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', email: 'test@example.com' },
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue(null); // No cohortId

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByText('Something went wrong')).toBeInTheDocument();
                expect(screen.getByText('No cohort specified')).toBeInTheDocument();
            });
        });
    });

    describe('Successful Cohort Join', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', email: 'test@example.com' },
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');
        });

        it('should handle successful cohort join', async () => {
            // Mock successful response
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({}),
            });

            render(<JoinCohortPage />);

            // Should start with loading state
            expect(screen.getByText('Adding you to the cohort')).toBeInTheDocument();

            // Wait for success state
            await waitFor(() => {
                expect(screen.getByText('Welcome aboard!')).toBeInTheDocument();
                expect(screen.getByText('You have been successfully added to the cohort')).toBeInTheDocument();
                expect(screen.getByText('Taking you to the school')).toBeInTheDocument();
            });

            // Check API call was made correctly
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.test.app/cohorts/cohort-123/members',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        emails: ['test@example.com'],
                        roles: ['learner'],
                        org_slug: 'test-school'
                    }),
                }
            );
        });
    });

    describe('Already Enrolled Handling', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', email: 'test@example.com' },
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');
        });

        it('should show toast when user is already enrolled (400 status)', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 400,
            });

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByTestId('toast')).toBeInTheDocument();
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Already enrolled');
                expect(screen.getByTestId('toast-description')).toHaveTextContent('You are already part of this cohort');
                expect(screen.getByTestId('toast-emoji')).toHaveTextContent('👍');
            });
        });
    });

    describe('Admin User Handling', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', email: 'admin@example.com' },
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');
        });

        it('should show toast when user is an admin (401 status)', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 401,
            });

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByTestId('toast')).toBeInTheDocument();
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Admin detected');
                expect(screen.getByTestId('toast-description')).toHaveTextContent('You are an admin of this school and cannot be added as a learner');
                expect(screen.getByTestId('toast-emoji')).toHaveTextContent('🔑');
            });
        });
    });

    describe('API Error Handling', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', email: 'test@example.com' },
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');
        });

        it('should handle 500 server error', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Server error' }),
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByText('Something went wrong')).toBeInTheDocument();
                expect(screen.getByText('Failed to join cohort')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Back to School' })).toBeInTheDocument();
            });

            expect(consoleSpy).toHaveBeenCalledWith('Error joining cohort:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('should handle network errors', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByText('Something went wrong')).toBeInTheDocument();
                expect(screen.getByText('Network error')).toBeInTheDocument();
            });

            expect(consoleSpy).toHaveBeenCalledWith('Error joining cohort:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('should handle malformed JSON response', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.reject(new Error('Invalid JSON')),
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByText('Something went wrong')).toBeInTheDocument();
                expect(screen.getByText('Failed to join cohort')).toBeInTheDocument();
            });

            expect(consoleSpy).toHaveBeenCalledWith('Error joining cohort:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('Navigation', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', email: 'test@example.com' },
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');
        });

        it('should navigate to school when Back to School button is clicked', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 500,
            });

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Back to School' })).toBeInTheDocument();
            });

            const backButton = screen.getByRole('button', { name: 'Back to School' });

            act(() => {
                fireEvent.click(backButton);
            });

            expect(mockPush).toHaveBeenCalledWith('/school/test-school?cohort_id=cohort-123');
        });
    });

    describe('UI States', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', email: 'test@example.com' },
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');
        });

        it('should display correct icons for different states', async () => {
            // Test success state
            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByText('Welcome aboard!')).toBeInTheDocument();
            });

            // Check for success icon (CheckCircle)
            const successIcon = document.querySelector('svg');
            expect(successIcon).toBeInTheDocument();
        });

        it('should display loading animations', () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: null,
                isAuthenticated: false,
                isLoading: true,
            });

            render(<JoinCohortPage />);

            // Check for loading spinner
            const spinners = document.querySelectorAll('.animate-spin');
            expect(spinners.length).toBeGreaterThan(0);
        });

        it('should display error state with alert icon', async () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: null,
                isAuthenticated: false,
                isLoading: false,
            });

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByText('Something went wrong')).toBeInTheDocument();
            });

            // Check for error icon (AlertCircle)
            const errorIcon = document.querySelector('svg');
            expect(errorIcon).toBeInTheDocument();
        });
    });

    describe('Toast Functionality', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', email: 'test@example.com' },
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');
        });

        it('should close toast when close button is clicked', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 400,
            });

            render(<JoinCohortPage />);

            await waitFor(() => {
                expect(screen.getByTestId('toast')).toBeInTheDocument();
            });

            const closeButton = screen.getByTestId('toast-close');

            act(() => {
                fireEvent.click(closeButton);
            });

            await waitFor(() => {
                expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
            });
        });

        it('should show toast with correct props for different scenarios', async () => {
            // Test 401 admin scenario
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 401,
            });

            render(<JoinCohortPage />);

            await waitFor(() => {
                const toast = screen.getByTestId('toast');
                expect(toast).toBeInTheDocument();
                expect(screen.getByTestId('toast-title')).toHaveTextContent('Admin detected');
                expect(screen.getByTestId('toast-emoji')).toHaveTextContent('🔑');
            });
        });
    });

    describe('Responsive Design', () => {
        it('should have responsive classes', () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: null,
                isAuthenticated: false,
                isLoading: true,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');

            render(<JoinCohortPage />);

            const container = document.querySelector('.min-h-screen');
            // Uses dark mode variant classes: bg-white dark:bg-black text-gray-900 dark:text-white
            expect(container).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'px-4');

            const content = document.querySelector('.max-w-md');
            expect(content).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'text-center');
        });
    });

    describe('Coverage Edge Cases', () => {
        it('should test all success state elements', async () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', email: 'test@example.com' },
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({}),
            });

            render(<JoinCohortPage />);

            await waitFor(() => {
                // Check all success state elements for coverage
                expect(screen.getByText('Welcome aboard!')).toBeInTheDocument();
                expect(screen.getByText('You have been successfully added to the cohort')).toBeInTheDocument();
                expect(screen.getByText('Taking you to the school')).toBeInTheDocument();

                // Check success icon container exists (uses dark: variant classes)
                const iconContainer = document.querySelector('.rounded-full.mb-6');
                expect(iconContainer).toBeInTheDocument();

                // Check loading spinner in success state (uses dark: variant classes)
                const successSpinner = document.querySelector('.animate-spin');
                expect(successSpinner).toBeInTheDocument();
            });
        });

        it('should test error state elements completely', async () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { id: 'user-123', email: 'test@example.com' },
                isAuthenticated: true,
                isLoading: false,
            });
            mockSearchParams.get.mockReturnValue('cohort-123');

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Server error' }),
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            render(<JoinCohortPage />);

            await waitFor(() => {
                // Check all error state elements for coverage
                expect(screen.getByText('Something went wrong')).toBeInTheDocument();
                expect(screen.getByText('Failed to join cohort')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Back to School' })).toBeInTheDocument();

                // Check error icon container exists (uses dark: variant classes)
                const iconContainer = document.querySelector('.rounded-full.mb-6');
                expect(iconContainer).toBeInTheDocument();

                // Check button classes (uses dark: variant classes)
                const button = screen.getByRole('button', { name: 'Back to School' });
                expect(button).toHaveClass('px-6', 'py-3', 'text-sm', 'font-medium', 'rounded-full', 'hover:opacity-90', 'transition-opacity', 'cursor-pointer');
            });

            expect(consoleSpy).toHaveBeenCalledWith('Error joining cohort:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
}); 