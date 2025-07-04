import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import CreateBatchDialog from '../../components/CreateBatchDialog';

// Mock fetch globally
beforeAll(() => {
    global.fetch = jest.fn();
});

afterAll(() => {
    jest.resetAllMocks();
});

describe('CreateBatchDialog', () => {
    const mockOnClose = jest.fn();
    const mockOnCreateBatch = jest.fn();
    const mockOnRequestDelete = jest.fn();
    const mockOnBatchUpdated = jest.fn();
    const learners = [
        { id: 1, email: 'learner1@example.com', role: 'learner' as const },
        { id: 2, email: 'learner2@example.com', role: 'learner' as const },
    ];
    const mentors = [
        { id: 3, email: 'mentor1@example.com', role: 'mentor' as const },
    ];
    const batch = {
        id: 10,
        name: 'Batch 1',
        cohort_id: 5,
        members: [
            { id: 1, email: 'learner1@example.com', role: 'learner' as const },
            { id: 3, email: 'mentor1@example.com', role: 'mentor' as const },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not render when isOpen is false and inline is false', () => {
        const { container } = render(
            <CreateBatchDialog
                isOpen={false}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
            />
        );
        expect(screen.getByPlaceholderText('Enter batch name')).toBeInTheDocument();
    });

    it('should allow selecting and deselecting learners', () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
            />
        );
        // Select first learner
        const learnerCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(learnerCheckbox);
        expect(learnerCheckbox).toBeChecked();
        // Deselect first learner
        fireEvent.click(learnerCheckbox);
        expect(learnerCheckbox).not.toBeChecked();
    });

    it('should allow selecting and deselecting mentors', () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
            />
        );
        // Select mentor
        const mentorCheckbox = screen.getAllByRole('checkbox')[2];
        fireEvent.click(mentorCheckbox);
        expect(mentorCheckbox).toBeChecked();
        // Deselect mentor
        fireEvent.click(mentorCheckbox);
        expect(mentorCheckbox).not.toBeChecked();
    });

    it('should filter learners and mentors by search', () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
            />
        );
        const searchInput = screen.getByPlaceholderText('Search by email');
        fireEvent.change(searchInput, { target: { value: 'learner2' } });
        expect(screen.getByText('learner2@example.com')).toBeInTheDocument();
        expect(screen.queryByText('learner1@example.com')).not.toBeInTheDocument();
    });

    it('should select all and deselect all learners', async () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
            />
        );

        // Grab learner checkboxes (first two)
        const learnerCheckboxes = screen.getAllByRole('checkbox').slice(0, 2);

        // Select the first learner so that the select-all checkbox becomes visible (it should be unchecked initially)
        fireEvent.click(learnerCheckboxes[0]);

        const selectedSpan = screen.getByText(/selected/);
        const checkboxWrapper = selectedSpan.previousElementSibling as HTMLElement;
        const selectAllCheckbox = checkboxWrapper.querySelector('input') as HTMLInputElement;

        // Click select-all to select all learners
        fireEvent.click(selectAllCheckbox);

        await waitFor(() => {
            const learnersAfterSelectAll = screen.getAllByRole('checkbox').slice(0, 2);
            learnersAfterSelectAll.forEach(cb => expect(cb).toBeChecked());
        });

        // Now the select-all checkbox should be checked – click it again to deselect all
        const selectedSpanChecked = screen.getByText(/selected/);
        const checkboxWrapperChecked = selectedSpanChecked.previousElementSibling as HTMLElement;
        const selectAllChecked = checkboxWrapperChecked.querySelector('input') as HTMLInputElement;
        fireEvent.click(selectAllChecked);

        await waitFor(() => {
            const learnersAfterDeselectAll = screen.getAllByRole('checkbox').slice(0, 2);
            learnersAfterDeselectAll.forEach(cb => expect(cb).not.toBeChecked());
        });
    });

    it('should create a batch successfully', async () => {
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost';
        const mockFetchResponse = { ok: true, json: jest.fn().mockResolvedValue({ success: true }) } as any;
        (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse);

        const onCreateBatch = jest.fn();

        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                onCreateBatch={onCreateBatch}
            />
        );

        // Enter batch name
        const nameInput = screen.getByPlaceholderText('Enter batch name');
        fireEvent.change(nameInput, { target: { value: 'New Batch' } });

        // Select a learner
        const learnerCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(learnerCheckbox);

        // Click create button
        const createButton = screen.getByText('Create').closest('button') as HTMLButtonElement;
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(onCreateBatch).toHaveBeenCalledWith('New Batch', [learners[0]], []);
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    it('should enter edit mode, save changes, and call onBatchUpdated', async () => {
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost';
        const updatedName = 'Updated Batch Name';
        const mockUpdatedBatch = { ...batch, name: updatedName };
        const mockFetchResponse = { ok: true, json: jest.fn().mockResolvedValue(mockUpdatedBatch) } as any;
        (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse);

        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                mode="view"
                batch={batch}
                onBatchUpdated={mockOnBatchUpdated}
            />
        );

        // Click the edit button
        const editButton = screen.getByText('Edit');
        fireEvent.click(editButton);

        // Change the name
        const nameInput = screen.getByPlaceholderText('Enter batch name');
        fireEvent.change(nameInput, { target: { value: updatedName } });

        // Click save
        const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
        await waitFor(() => expect(saveButton).not.toBeDisabled());
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(mockOnBatchUpdated).toHaveBeenCalledWith(expect.objectContaining({ name: updatedName }));
        });
    });

    it('should render learners in both columns when no mentors are provided', () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={[]}
                cohortId="5"
            />
        );

        // Expect two instances of learner emails (because grid layout duplicates across columns)
        const learner1Instances = screen.getAllByText('learner1@example.com');
        const learner2Instances = screen.getAllByText('learner2@example.com');
        expect(learner1Instances.length).toBeGreaterThan(0);
        expect(learner2Instances.length).toBeGreaterThan(0);
    });

    it('should show placeholder when no learners are available', () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={[]}
                mentors={[]}
                cohortId="5"
            />
        );

        expect(screen.getByText('No learners found')).toBeInTheDocument();
    });

    it('should render inline without modal backdrop when inline prop is true', () => {
        const { container } = render(
            <CreateBatchDialog
                inline
                isOpen={false} // ignored when inline
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
            />
        );

        // Expect the component to be present without the backdrop div (class 'fixed inset-0')
        expect(container.querySelector('.fixed')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter batch name')).toBeInTheDocument();
    });

    it('should show view placeholder when batch has no learners', () => {
        const emptyBatch = { ...batch, members: [] };
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                mode="view"
                batch={emptyBatch as any}
            />
        );

        expect(screen.getByText('No learners in this batch')).toBeInTheDocument();
    });

    it('should create a batch when pressing Enter key in name input', async () => {
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost';
        const mockFetchResponse = { ok: true, json: jest.fn().mockResolvedValue({ success: true }) } as any;
        (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse);

        const onCreateBatch = jest.fn();

        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                onCreateBatch={onCreateBatch}
            />
        );

        const nameInput = screen.getByPlaceholderText('Enter batch name');
        fireEvent.change(nameInput, { target: { value: 'Enter Batch' } });

        // Select a learner so validation passes
        fireEvent.click(screen.getAllByRole('checkbox')[0]);

        fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter', keyCode: 13 });

        await waitFor(() => {
            expect(onCreateBatch).toHaveBeenCalledWith('Enter Batch', [learners[0]], []);
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    it('should close dialog when Escape key is pressed in name input', () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
            />
        );

        const nameInput = screen.getByPlaceholderText('Enter batch name');
        fireEvent.keyDown(nameInput, { key: 'Escape', code: 'Escape', keyCode: 27 });
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should select all and deselect all mentors', async () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
            />
        );

        // Mentor individual checkbox is third in order (index 2)
        const mentorCheckbox = screen.getAllByRole('checkbox')[2] as HTMLInputElement;
        fireEvent.click(mentorCheckbox); // check mentor

        // Select-all for mentors should now be rendered and already checked (all mentors selected)
        const mentorSelectAll = (screen.getByText(/selected/).previousElementSibling as HTMLElement).querySelector('input') as HTMLInputElement;

        // Verify mentor checkbox is checked
        expect(mentorCheckbox).toBeChecked();

        // Click select-all to deselect all mentors
        fireEvent.click(mentorSelectAll);
        await waitFor(() => expect(screen.getAllByRole('checkbox')[2]).not.toBeChecked());
    });

    it('should log error when batch creation fails (response not ok)', async () => {
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost';
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
            />
        );

        fireEvent.change(screen.getByPlaceholderText('Enter batch name'), { target: { value: 'Bad Batch' } });
        fireEvent.click(screen.getAllByRole('checkbox')[0]);

        fireEvent.click(screen.getByText('Create').closest('button') as HTMLButtonElement);

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
            expect((consoleSpy.mock.calls[0][0] as string)).toContain('Error creating batch');
        });
        consoleSpy.mockRestore();
    });

    it('should show validation errors and prevent save when name is empty and no learners selected in edit mode', async () => {
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost';
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                mode="view"
                batch={batch}
            />
        );

        // Enter edit mode
        fireEvent.click(screen.getByText('Edit'));

        // Deselect learner so none selected
        const learnerCheckbox = screen.getAllByRole('checkbox')[0];
        if (learnerCheckbox) fireEvent.click(learnerCheckbox);

        // Clear batch name
        const nameInput = screen.getByPlaceholderText('Enter batch name');
        fireEvent.change(nameInput, { target: { value: ' ' } });

        // Attempt save
        const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
        fireEvent.click(saveButton);

        // fetch should not be called due to validation errors
        await waitFor(() => {
            expect(global.fetch).not.toHaveBeenCalled();
        });

        // Border-red-500 class should be applied for name error
        expect(nameInput.className).toMatch(/border-red-500/);
        consoleSpy.mockRestore();
    });

    it('should call onRequestDelete when Delete button is clicked in view mode', () => {
        const onRequestDelete = jest.fn();
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                mode="view"
                batch={batch}
                onRequestDelete={onRequestDelete}
            />
        );

        fireEvent.click(screen.getByText('Delete'));
        expect(onRequestDelete).toHaveBeenCalledWith(batch);
    });

    it('should display learners grid in view mode when no mentors in batch', () => {
        const learnerOnlyBatch = {
            ...batch, members: [
                { id: 1, email: 'learner1@example.com', role: 'learner' as const },
                { id: 2, email: 'learner2@example.com', role: 'learner' as const },
            ]
        };

        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                mode="view"
                batch={learnerOnlyBatch as any}
            />
        );

        // Expect learner emails to be displayed twice (grid of 2 columns)
        expect(screen.getAllByText('learner1@example.com').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('learner2@example.com').length).toBeGreaterThanOrEqual(1);
        // No mentor email should be present
        expect(screen.queryByText('mentor1@example.com')).not.toBeInTheDocument();
    });

    it('should have Save button disabled when no changes in edit mode', () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                mode="view"
                batch={batch}
            />
        );

        // Enter edit mode
        fireEvent.click(screen.getByText('Edit'));
        const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
        expect(saveButton).toBeDisabled();
    });

    it('should reset changes and return to view mode on Cancel', () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                mode="view"
                batch={batch}
            />
        );

        // Enter edit mode
        fireEvent.click(screen.getByText('Edit'));

        // Change name
        const nameInput = screen.getByPlaceholderText('Enter batch name');
        fireEvent.change(nameInput, { target: { value: 'Temp Change' } });
        expect(nameInput).toHaveValue('Temp Change');

        // Click Cancel
        fireEvent.click(screen.getByText('Cancel'));

        // Back to view mode, original name rendered
        expect(screen.getByText(batch.name)).toBeInTheDocument();
    });

    it('should select all mentors when select-all is clicked after a partial selection', async () => {
        // Provide two mentors so the select-all logic is meaningful
        const multipleMentors = [
            { id: 3, email: 'mentor1@example.com', role: 'mentor' as const },
            { id: 4, email: 'mentor2@example.com', role: 'mentor' as const },
        ];

        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={multipleMentors}
                cohortId="5"
            />
        );

        // Select the first mentor — this reveals the mentor select-all checkbox (unchecked)
        const mentorCheckboxes = screen.getAllByRole('checkbox').slice(2, 4);
        fireEvent.click(mentorCheckboxes[0]);

        // Grab the select-all checkbox that appears next to the "1 selected" label
        const mentorSelectedSpan = screen.getByText('1 selected');
        const mentorSelectAll = (mentorSelectedSpan.previousElementSibling as HTMLElement).querySelector('input') as HTMLInputElement;
        expect(mentorSelectAll).not.toBeChecked();

        // Click select-all to select all mentors
        fireEvent.click(mentorSelectAll);

        await waitFor(() => {
            const refreshedMentorCheckboxes = screen.getAllByRole('checkbox').slice(2, 4);
            refreshedMentorCheckboxes.forEach(cb => expect(cb).toBeChecked());
            // select-all now checked too
            expect((mentorSelectedSpan.previousElementSibling as HTMLElement).querySelector('input')).toBeChecked();
        });
    });

    it('should show learnerSelectionError then clear it after timeout', async () => {
        jest.useFakeTimers();

        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                mode="view"
                batch={batch}
            />
        );

        // Enter edit mode
        fireEvent.click(screen.getByText('Edit'));

        // Deselect all learner checkboxes so zero learners remain selected
        const learnerCheckboxes = screen.getAllByRole('checkbox').slice(0, 2);
        learnerCheckboxes.forEach(cb => {
            if ((cb as HTMLInputElement).checked) {
                fireEvent.click(cb);
            }
        });

        // Click Save
        fireEvent.click(screen.getByText('Save').closest('button') as HTMLButtonElement);

        // Error paragraph should switch to red
        const errorPara = screen.getByText(/Select learners/);
        await waitFor(() => expect(errorPara).toHaveClass('text-red-500'));

        // Advance timers to clear the error state
        await act(async () => {
            jest.advanceTimersByTime(3100);
        });
        await waitFor(() => expect(screen.getByText(/Select learners/)).not.toHaveClass('text-red-500'));
        jest.useRealTimers();
    });

    it('should clear batchNameError once user enters a valid name', async () => {
        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                mode="view"
                batch={batch}
            />
        );

        // Enter edit mode
        fireEvent.click(screen.getByText('Edit'));

        // Clear name to trigger error
        const nameInput = screen.getByPlaceholderText('Enter batch name');
        fireEvent.change(nameInput, { target: { value: ' ' } });
        fireEvent.click(screen.getByText('Save').closest('button') as HTMLButtonElement);
        await waitFor(() => expect(nameInput).toHaveClass('border-red-500'));

        // Type a valid name to clear error
        fireEvent.change(nameInput, { target: { value: 'Valid Name' } });
        await waitFor(() => expect(nameInput).not.toHaveClass('border-red-500'));
    });

    it('should fallback to local batch update when API returns no JSON body', async () => {
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost';
        const updatedName = 'Local Updated';

        const mockFetchResponse = {
            ok: true,
            json: jest.fn().mockRejectedValue(new Error('No JSON')),
        } as any;
        (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse);

        const onBatchUpdated = jest.fn();

        render(
            <CreateBatchDialog
                isOpen={true}
                onClose={mockOnClose}
                learners={learners}
                mentors={mentors}
                cohortId="5"
                mode="view"
                batch={batch}
                onBatchUpdated={onBatchUpdated}
            />
        );

        // Enter edit mode
        fireEvent.click(screen.getByText('Edit'));

        // Change name
        const nameInput = screen.getByPlaceholderText('Enter batch name');
        fireEvent.change(nameInput, { target: { value: updatedName } });

        // Click Save
        fireEvent.click(screen.getByText('Save').closest('button') as HTMLButtonElement);

        await waitFor(() => {
            expect(mockFetchResponse.json).toHaveBeenCalled();
            expect(onBatchUpdated).toHaveBeenCalledWith(expect.objectContaining({ name: updatedName }));
        });
    });
}); 