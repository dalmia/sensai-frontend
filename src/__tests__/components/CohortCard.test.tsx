import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CohortCard from '../../components/CohortCard';

// Mock ConfirmationDialog with proper props handling
jest.mock('../../components/ConfirmationDialog', () => {
    return function MockConfirmationDialog(props: any) {
        if (!props.show) return null;

        return (
            <div data-testid="confirmation-dialog">
                <div data-testid="dialog-title">{props.title}</div>
                <div data-testid="dialog-message">{props.message}</div>
                <button
                    data-testid="confirm-button"
                    onClick={props.onConfirm}
                    disabled={props.isLoading}
                >
                    {props.confirmButtonText}
                </button>
                <button
                    data-testid="cancel-button"
                    onClick={props.onCancel}
                >
                    Cancel
                </button>
                {props.isLoading && <div data-testid="loading-indicator">Loading...</div>}
                {props.errorMessage && <div data-testid="error-message">{props.errorMessage}</div>}
            </div>
        );
    };
});

const mockCohort = {
    id: 123,
    name: 'Test Cohort',
};

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('CohortCard Component', () => {
    const mockOnDelete = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockClear();
        // Set default environment variable
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:3000';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render cohort information correctly', () => {
            render(<CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />);

            expect(screen.getByText('Test Cohort')).toBeInTheDocument();
            expect(screen.getByRole('link')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /delete cohort/i })).toBeInTheDocument();
        });

        it('should generate correct link URL with numeric schoolId', () => {
            render(<CohortCard cohort={mockCohort} schoolId={456} />);

            const link = screen.getByRole('link');
            expect(link).toHaveAttribute('href', '/school/admin/456/cohorts/123');
        });

        it('should generate correct link URL with string schoolId', () => {
            render(<CohortCard cohort={mockCohort} schoolId="456" />);

            const link = screen.getByRole('link');
            expect(link).toHaveAttribute('href', '/school/admin/456/cohorts/123');
        });

        it('should handle undefined schoolId gracefully', () => {
            render(<CohortCard cohort={mockCohort} />);

            const link = screen.getByRole('link');
            expect(link).toHaveAttribute('href', '/school/admin/undefined/cohorts/123');
        });

        it('should have correct CSS classes for styling', () => {
            render(<CohortCard cohort={mockCohort} schoolId={456} />);

            const card = screen.getByText('Test Cohort').closest('div');
            expect(card).toHaveClass('bg-gray-100', 'text-gray-800', 'rounded-lg', 'p-6', 'h-full', 'transition-all', 'hover:opacity-90', 'cursor-pointer', 'border-b-2', 'border-opacity-70');

            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            expect(deleteButton).toHaveClass('absolute', 'top-3', 'right-3', 'p-2', 'text-gray-600', 'opacity-0', 'group-hover:opacity-100');
        });

        it('should have correct accessibility attributes', () => {
            render(<CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />);

            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            expect(deleteButton).toHaveAttribute('aria-label', 'Delete cohort');
        });
    });

    describe('Border Color Generation', () => {
        it('should apply correct border color based on cohort ID', () => {
            render(<CohortCard cohort={mockCohort} schoolId={456} />);

            const card = screen.getByText('Test Cohort').closest('div');
            expect(card).toHaveClass('border-b-2');

            // Check that it has one of the possible border colors
            const possibleBorderClasses = [
                'border-purple-500',
                'border-green-500',
                'border-pink-500',
                'border-yellow-500',
                'border-blue-500',
                'border-red-500',
                'border-indigo-500',
                'border-orange-500'
            ];

            const hasBorderClass = possibleBorderClasses.some(className =>
                card?.classList.contains(className)
            );

            expect(hasBorderClass).toBe(true);
        });

        it('should handle different cohort IDs for border colors', () => {
            const cohorts = [
                { id: 0, name: 'Cohort 0' }, // Test modulo with 0
                { id: 1, name: 'Cohort 1' },
                { id: 7, name: 'Cohort 7' }, // Test last color in array
                { id: 8, name: 'Cohort 8' }, // Test wraparound
                { id: 9, name: 'Cohort 9' },
            ];

            cohorts.forEach(cohort => {
                const { unmount } = render(<CohortCard cohort={cohort} schoolId={456} />);

                const card = screen.getByText(cohort.name).closest('div');
                expect(card).toHaveClass('border-b-2');

                unmount();
            });
        });

        it('should handle very large cohort IDs', () => {
            const largeCohort = { id: 999999, name: 'Large ID Cohort' };

            render(<CohortCard cohort={largeCohort} schoolId={456} />);

            const card = screen.getByText('Large ID Cohort').closest('div');
            expect(card).toHaveClass('border-b-2');

            // Should still apply a border color (modulo should work)
            const possibleBorderClasses = [
                'border-purple-500',
                'border-green-500',
                'border-pink-500',
                'border-yellow-500',
                'border-blue-500',
                'border-red-500',
                'border-indigo-500',
                'border-orange-500'
            ];

            const hasBorderClass = possibleBorderClasses.some(className =>
                card?.classList.contains(className)
            );

            expect(hasBorderClass).toBe(true);
        });
    });

    describe('Delete Button Interaction', () => {
        it('should open confirmation dialog when delete button is clicked', () => {
            render(<CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />);

            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            fireEvent.click(deleteButton);

            expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
            expect(screen.getByTestId('dialog-title')).toHaveTextContent('Delete cohort');
            expect(screen.getByTestId('dialog-message')).toHaveTextContent('Are you sure you want to delete this cohort?');
        });

        it('should prevent event propagation and default when delete button is clicked', () => {
            const linkClickHandler = jest.fn();
            const mockEvent = {
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            };

            render(
                <div onClick={linkClickHandler}>
                    <CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />
                </div>
            );

            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });

            // Mock the event object
            fireEvent.click(deleteButton, mockEvent);

            // Link click handler should not be called due to event.stopPropagation()
            expect(linkClickHandler).not.toHaveBeenCalled();
        });

        it('should close confirmation dialog when cancel is clicked', () => {
            render(<CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />);

            // Open dialog
            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            fireEvent.click(deleteButton);

            expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();

            // Close dialog
            const cancelButton = screen.getByTestId('cancel-button');
            fireEvent.click(cancelButton);

            expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
        });
    });

    describe('Delete Confirmation Flow', () => {
        it('should handle successful deletion with onDelete callback', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
            });

            render(<CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />);

            // Open confirmation dialog
            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            fireEvent.click(deleteButton);

            // Confirm deletion
            const confirmButton = screen.getByTestId('confirm-button');
            fireEvent.click(confirmButton);

            // Wait for API call to complete
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3000/cohorts/123',
                    {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    }
                );
            });

            await waitFor(() => {
                expect(mockOnDelete).toHaveBeenCalledWith(123);
            });

            // Dialog should be closed after successful deletion
            await waitFor(() => {
                expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
            });
        });

        it('should handle successful deletion without onDelete callback', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
            });

            render(<CohortCard cohort={mockCohort} schoolId={456} />);

            // Open confirmation dialog
            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            fireEvent.click(deleteButton);

            // Confirm deletion
            const confirmButton = screen.getByTestId('confirm-button');
            fireEvent.click(confirmButton);

            // Wait for API call to complete
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3000/cohorts/123',
                    {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    }
                );
            });

            // Should not throw error when onDelete is not provided
            expect(mockOnDelete).not.toHaveBeenCalled();

            // Dialog should be closed after successful deletion
            await waitFor(() => {
                expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
            });
        });

        it('should show loading state during deletion', async () => {
            // Create a promise that we can control
            let resolvePromise: (value: any) => void;
            const deletePromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });

            mockFetch.mockReturnValueOnce(deletePromise);

            render(<CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />);

            // Open confirmation dialog
            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            fireEvent.click(deleteButton);

            // Confirm deletion
            const confirmButton = screen.getByTestId('confirm-button');
            fireEvent.click(confirmButton);

            // Should show loading state
            await waitFor(() => {
                expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
                expect(screen.getByTestId('confirm-button')).toBeDisabled();
            });

            // Resolve the promise
            resolvePromise!({ ok: true });

            await waitFor(() => {
                expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
            });
        });

        it('should handle API failure with error message', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            render(<CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />);

            // Open confirmation dialog
            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            fireEvent.click(deleteButton);

            // Confirm deletion
            const confirmButton = screen.getByTestId('confirm-button');
            fireEvent.click(confirmButton);

            // Wait for error to be displayed
            await waitFor(() => {
                expect(screen.getByTestId('error-message')).toHaveTextContent(
                    'An error occurred while deleting the cohort. Please try again.'
                );
            });

            // Dialog should remain open to show error
            expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
            expect(mockOnDelete).not.toHaveBeenCalled();
        });

        it('should handle network error during deletion', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            render(<CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />);

            // Open confirmation dialog
            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            fireEvent.click(deleteButton);

            // Confirm deletion
            const confirmButton = screen.getByTestId('confirm-button');
            fireEvent.click(confirmButton);

            // Wait for error to be displayed
            await waitFor(() => {
                expect(screen.getByTestId('error-message')).toHaveTextContent(
                    'An error occurred while deleting the cohort. Please try again.'
                );
            });

            // Dialog should remain open to show error
            expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
            expect(mockOnDelete).not.toHaveBeenCalled();
        });

        it('should clear error when retrying deletion', async () => {
            // First call fails
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            render(<CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />);

            // Open confirmation dialog and fail deletion
            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            fireEvent.click(deleteButton);

            const confirmButton = screen.getByTestId('confirm-button');
            fireEvent.click(confirmButton);

            // Wait for error
            await waitFor(() => {
                expect(screen.getByTestId('error-message')).toBeInTheDocument();
            });

            // Mock successful retry
            mockFetch.mockResolvedValueOnce({
                ok: true,
            });

            // Retry deletion
            fireEvent.click(confirmButton);

            // Error should be cleared during retry
            await waitFor(() => {
                expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle cohort with empty name', () => {
            const emptyCohort = { id: 1, name: '' };
            render(<CohortCard cohort={emptyCohort} schoolId={456} />);

            // Should render without crashing
            expect(screen.getByRole('link')).toBeInTheDocument();
        });

        it('should handle cohort with very long name', () => {
            const longNameCohort = {
                id: 1,
                name: 'This is a very long cohort name that might cause layout issues but should be handled gracefully by the component'
            };
            render(<CohortCard cohort={longNameCohort} schoolId={456} />);

            expect(screen.getByText(longNameCohort.name)).toBeInTheDocument();
        });

        it('should handle negative cohort ID', () => {
            const negativeCohort = { id: -1, name: 'Negative ID Cohort' };
            render(<CohortCard cohort={negativeCohort} schoolId={456} />);

            const link = screen.getByRole('link');
            expect(link).toHaveAttribute('href', '/school/admin/456/cohorts/-1');

            // Border color should still work with negative modulo
            const card = screen.getByText('Negative ID Cohort').closest('div');
            expect(card).toHaveClass('border-b-2');
        });

        it('should handle missing environment variable', async () => {
            // Temporarily remove environment variable
            delete process.env.NEXT_PUBLIC_BACKEND_URL;

            mockFetch.mockResolvedValueOnce({
                ok: true,
            });

            render(<CohortCard cohort={mockCohort} schoolId={456} onDelete={mockOnDelete} />);

            // Open confirmation dialog and confirm deletion
            const deleteButton = screen.getByRole('button', { name: /delete cohort/i });
            fireEvent.click(deleteButton);

            const confirmButton = screen.getByTestId('confirm-button');
            fireEvent.click(confirmButton);

            // Should still make API call with undefined URL
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'undefined/cohorts/123',
                    expect.any(Object)
                );
            });

            // Restore environment variable
            process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:3000';
        });
    });
}); 