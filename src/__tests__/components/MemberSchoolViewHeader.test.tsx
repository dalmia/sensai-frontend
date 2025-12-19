import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemberSchoolViewHeader from '../../components/MemberSchoolViewHeader';
import { Cohort } from '@/types';

describe('MemberSchoolViewHeader Component', () => {
    const mockCohorts: Cohort[] = [
        {
            id: 1,
            name: 'Test Cohort 1',
            joined_at: '2023-01-01',
            role: 'learner'
        },
        {
            id: 2,
            name: 'Test Cohort 2',
            joined_at: '2023-02-01',
            role: 'learner'
        },
        {
            id: 3,
            name: 'Very Long Cohort Name That Should Be Truncated',
            joined_at: '2023-03-01',
            role: 'learner'
        }
    ];

    const mockBatches = [
        { id: 1, name: 'Batch 1' },
        { id: 2, name: 'Batch 2' },
        { id: 3, name: 'Batch 3' }
    ];

    const mockOnCohortSelect = jest.fn();
    const mockOnBatchSelect = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders cohort name when only one cohort exists', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={[mockCohorts[0]]}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            expect(screen.getByText('Test Cohort 1')).toBeInTheDocument();
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('renders dropdown when multiple cohorts exist', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            const dropdownButton = screen.getByRole('button');
            expect(dropdownButton).toBeInTheDocument();
            expect(screen.getByText('Test Cohort 1')).toBeInTheDocument();
        });

        it('does not render batch selector when no batches provided', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            expect(screen.queryByText('Select Batch')).not.toBeInTheDocument();
        });

        it('does not render batch selector when only one batch exists', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={[mockBatches[0]]}
                    activeBatchId={1}
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            expect(screen.queryByText('Batch 1')).not.toBeInTheDocument();
        });

        it('renders batch selector when multiple batches exist', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={mockBatches}
                    activeBatchId={1}
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            expect(screen.getByText('Batch 1')).toBeInTheDocument();
            const batchButtons = screen.getAllByRole('button');
            expect(batchButtons.length).toBe(2); // One cohort button, one batch button
        });

        it('handles null activeCohort gracefully', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={null}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            // Should still render the dropdown button, just without text
            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });

    describe('Cohort Dropdown Functionality', () => {
        it('opens cohort dropdown when clicked', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            const dropdownButton = screen.getByRole('button');
            fireEvent.click(dropdownButton);

            // Check if dropdown options are visible
            expect(screen.getByText('Test Cohort 2')).toBeInTheDocument();
            expect(screen.getByText('Very Long Cohort Name That Should Be Truncated')).toBeInTheDocument();
        });

        it('closes cohort dropdown when clicking same button again', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            const dropdownButton = screen.getByRole('button');

            // Open dropdown
            fireEvent.click(dropdownButton);
            expect(screen.getByText('Test Cohort 2')).toBeInTheDocument();

            // Close dropdown
            fireEvent.click(dropdownButton);
            expect(screen.queryByText('Test Cohort 2')).not.toBeInTheDocument();
        });

        it('calls onCohortSelect when a cohort is selected', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            const dropdownButton = screen.getByRole('button');
            fireEvent.click(dropdownButton);

            const cohort2Option = screen.getByText('Test Cohort 2');
            fireEvent.click(cohort2Option);

            expect(mockOnCohortSelect).toHaveBeenCalledWith(mockCohorts[1]);
        });

        it('closes cohort dropdown after selecting an option', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            const dropdownButton = screen.getByRole('button');
            fireEvent.click(dropdownButton);

            const cohort2Option = screen.getByText('Test Cohort 2');
            fireEvent.click(cohort2Option);

            // Dropdown should be closed
            expect(screen.queryByText('Very Long Cohort Name That Should Be Truncated')).not.toBeInTheDocument();
        });

        it('highlights active cohort in dropdown', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[1]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            const dropdownButton = screen.getByRole('button');
            fireEvent.click(dropdownButton);

            // Use getAllByText and check the one in the dropdown (second occurrence)
            const activeCohortOptions = screen.getAllByText('Test Cohort 2');
            const dropdownOption = activeCohortOptions.find(option =>
                option.tagName === 'LI'
            );
            expect(dropdownOption).toHaveClass('dark:text-white', 'font-light');
        });
    });

    describe('Batch Dropdown Functionality', () => {
        it('opens batch dropdown when clicked', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={mockBatches}
                    activeBatchId={1}
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            const buttons = screen.getAllByRole('button');
            const batchButton = buttons[1]; // Second button should be batch button
            fireEvent.click(batchButton);

            expect(screen.getByText('Batch 2')).toBeInTheDocument();
            expect(screen.getByText('Batch 3')).toBeInTheDocument();
        });

        it('calls onBatchSelect when a batch is selected', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={mockBatches}
                    activeBatchId={1}
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            const buttons = screen.getAllByRole('button');
            const batchButton = buttons[1];
            fireEvent.click(batchButton);

            const batch2Option = screen.getByText('Batch 2');
            fireEvent.click(batch2Option);

            expect(mockOnBatchSelect).toHaveBeenCalledWith(2);
        });

        it('closes batch dropdown after selecting an option', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={mockBatches}
                    activeBatchId={1}
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            const buttons = screen.getAllByRole('button');
            const batchButton = buttons[1];
            fireEvent.click(batchButton);

            const batch2Option = screen.getByText('Batch 2');
            fireEvent.click(batch2Option);

            // Dropdown should be closed
            expect(screen.queryByText('Batch 3')).not.toBeInTheDocument();
        });

        it('highlights active batch in dropdown', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={mockBatches}
                    activeBatchId={2}
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            const buttons = screen.getAllByRole('button');
            const batchButton = buttons[1];
            fireEvent.click(batchButton);

            // Use getAllByText and check the one in the dropdown (LI element)
            const activeBatchOptions = screen.getAllByText('Batch 2');
            const dropdownOption = activeBatchOptions.find(option =>
                option.tagName === 'LI'
            );
            expect(dropdownOption).toHaveClass('dark:text-white', 'font-light');
        });

        it('shows "Select Batch" when no active batch is selected', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={mockBatches}
                    activeBatchId={null}
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            expect(screen.getByText('Select Batch')).toBeInTheDocument();
        });
    });

    describe('Click Outside Behavior', () => {
        it('closes cohort dropdown when clicking outside', async () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            const dropdownButton = screen.getByRole('button');
            fireEvent.click(dropdownButton);

            // Verify dropdown is open
            expect(screen.getByText('Test Cohort 2')).toBeInTheDocument();

            // Click outside
            fireEvent.mouseDown(document.body);

            await waitFor(() => {
                expect(screen.queryByText('Test Cohort 2')).not.toBeInTheDocument();
            });
        });

        it('closes batch dropdown when clicking outside', async () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={mockBatches}
                    activeBatchId={1}
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            const buttons = screen.getAllByRole('button');
            const batchButton = buttons[1];
            fireEvent.click(batchButton);

            // Verify dropdown is open
            expect(screen.getByText('Batch 2')).toBeInTheDocument();

            // Click outside
            fireEvent.mouseDown(document.body);

            await waitFor(() => {
                expect(screen.queryByText('Batch 2')).not.toBeInTheDocument();
            });
        });

        it('does not close dropdown when clicking on the dropdown itself', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            const dropdownButton = screen.getByRole('button');
            fireEvent.click(dropdownButton);

            // Get the dropdown container
            const dropdownContainer = screen.getByText('Test Cohort 2').closest('div');

            // Click on the dropdown container
            fireEvent.mouseDown(dropdownContainer!);

            // Dropdown should still be open
            expect(screen.getByText('Test Cohort 2')).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('handles empty cohorts array', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={[]}
                    activeCohort={null}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('handles undefined onBatchSelect', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={mockBatches}
                    activeBatchId={1}
                />
            );

            const buttons = screen.getAllByRole('button');
            const batchButton = buttons[1];
            fireEvent.click(batchButton);

            const batch2Option = screen.getByText('Batch 2');

            // This should not throw an error even without onBatchSelect
            expect(() => fireEvent.click(batch2Option)).not.toThrow();
        });

        it('handles truncation styling for long cohort names', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[2]} // Long name cohort
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            const dropdownButton = screen.getByRole('button');
            expect(dropdownButton).toHaveClass('truncate');
        });

        it('handles both dropdowns being open simultaneously', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={mockBatches}
                    activeBatchId={1}
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            const buttons = screen.getAllByRole('button');
            const cohortButton = buttons[0];
            const batchButton = buttons[1];

            // Open both dropdowns
            fireEvent.click(cohortButton);
            fireEvent.click(batchButton);

            // Both should be open
            expect(screen.getByText('Test Cohort 2')).toBeInTheDocument();
            expect(screen.getByText('Batch 2')).toBeInTheDocument();
        });

        it('cleans up event listeners when component unmounts', () => {
            const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

            const { unmount } = render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            // Unmount the component
            unmount();

            // Verify that removeEventListener was called
            expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));

            removeEventListenerSpy.mockRestore();
        });

        it('handles missing batch name gracefully', () => {
            const batchesWithMissingName = [
                { id: 1, name: 'Batch 1' },
                { id: 2, name: '' }, // Empty name
                { id: 3, name: 'Batch 3' }
            ];

            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={batchesWithMissingName}
                    activeBatchId={2}
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            // Should not crash and should show the empty string
            const buttons = screen.getAllByRole('button');
            expect(buttons[1]).toBeInTheDocument();
        });

        it('handles cohort selection for activeCohort with undefined name', () => {
            const cohortWithUndefinedName = {
                id: 999,
                name: undefined as any,
                joined_at: '2023-01-01',
                role: 'learner'
            };

            render(
                <MemberSchoolViewHeader
                    cohorts={[cohortWithUndefinedName, ...mockCohorts]}
                    activeCohort={cohortWithUndefinedName}
                    onCohortSelect={mockOnCohortSelect}
                />
            );

            // Should render without crashing
            const dropdownButton = screen.getByRole('button');
            expect(dropdownButton).toBeInTheDocument();
        });

        it('shows "Select Batch" when activeBatchId does not match any batch', () => {
            render(
                <MemberSchoolViewHeader
                    cohorts={mockCohorts}
                    activeCohort={mockCohorts[0]}
                    onCohortSelect={mockOnCohortSelect}
                    batches={mockBatches}
                    activeBatchId={999} // Non-existent batch ID
                    onBatchSelect={mockOnBatchSelect}
                />
            );

            expect(screen.getByText('Select Batch')).toBeInTheDocument();
        });
    });
}); 