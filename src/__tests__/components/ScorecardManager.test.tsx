/* eslint-disable @typescript-eslint/no-explicit-any, react/display-name */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScorecardManager from '@/components/ScorecardManager';

jest.mock('@/components/ScorecardPickerDialog', () => {
    return function MockPicker({ isOpen, onCreateNew, onSelectTemplate }: any) {
        return isOpen ? (
            <div>
                <button type="button" onClick={() => onCreateNew?.()}>Create New</button>
                <button type="button" onClick={() => onSelectTemplate?.({ id: 'tpl1', name: 'Template', is_template: true, new: false, criteria: [{ name: '', description: '', minScore: 1, maxScore: 5, passScore: 3 }] })}>Pick Template</button>
            </div>
        ) : null;
    };
});

let lastFocusNameMock: jest.Mock | null = null;
jest.mock('@/components/Scorecard', () => {
    return React.forwardRef(function MockScorecard(props: any, ref: any) {
        const focusName = jest.fn();
        lastFocusNameMock = focusName;
        React.useImperativeHandle(ref, () => ({ focusName }));
        return (
            <div>
                <button type="button" onClick={() => props.onSave?.()}>Save</button>
                <button type="button" onClick={() => props.onRevert?.()}>Revert</button>
                <button type="button" onClick={() => props.onDuplicate?.()}>Duplicate</button>
                <button type="button" onClick={() => props.onDelete?.()}>Delete</button>
                <button type="button" onClick={() => props.onNameChange?.('New Name')}>Name</button>
                <button type="button" onClick={() => props.onChange?.([{ name: 'n', description: 'd', minScore: 1, maxScore: 5, passScore: 3 }])}>Criteria</button>
            </div>
        );
    });
});

jest.mock('@/components/Toast', () => (props: any) => props.show ? (
    <div data-testid="toast">
        <div data-testid="toast-title">{props.title}</div>
        <div data-testid="toast-desc">{props.description}</div>
        <div data-testid="toast-emoji">{props.emoji}</div>
        <button type="button" onClick={() => props.onClose?.()}>Close</button>
    </div>
) : null);
jest.mock('@/components/ConfirmationDialog', () => (props: any) => props.show ? (
    <div>
        <div data-testid="dialog-title">{props.title}</div>
        <button type="button" onClick={() => props.onConfirm?.()}>Confirm</button>
        <button type="button" onClick={() => props.onCancel?.()}>Cancel</button>
    </div>
) : null);

describe('ScorecardManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as any) = jest.fn();
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:8001';
    });

    it('revert and delete flow updates state and onScorecardChange', () => {
        const onScorecardChange = jest.fn();
        render(<ScorecardManager type="assignment" schoolId="org1" initialScorecardData={{ id: 'sc1', name: 'Name', new: false, is_template: false, criteria: [{ name: '', description: '', minScore: 1, maxScore: 5, passScore: 3 }] }} onScorecardChange={onScorecardChange} />);
        fireEvent.click(screen.getByText('Revert'));
        fireEvent.click(screen.getByText('Delete'));
        // Confirm delete dialog
        fireEvent.click(screen.getByText('Confirm'));
        expect(onScorecardChange).toHaveBeenCalled();
    });

    it('shows success toast on save of existing scorecard', async () => {
        jest.useFakeTimers();
        (global.fetch as any) = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

        render(
            <ScorecardManager
                type="assignment"
                schoolId="org1"
                initialScorecardData={{ id: 'sc1', name: 'Name', new: false, is_template: false, criteria: [{ name: '', description: '', minScore: 1, maxScore: 5, passScore: 3 }] }}
            />
        );

        // Trigger save -> opens confirmation dialog first for non-new scorecard
        fireEvent.click(screen.getByText('Save'));
        // Confirm to perform save
        fireEvent.click(await screen.findByText('Confirm'));

        // Toast should appear with success values
        expect(await screen.findByTestId('toast')).toBeInTheDocument();
        expect(screen.getByTestId('toast-title')).toHaveTextContent('Scorecard Saved');
        expect(screen.getByTestId('toast-desc')).toHaveTextContent('Scorecard has been updated successfully');
        expect(screen.getByTestId('toast-emoji')).toHaveTextContent('✅');

        // Close via onClose handler
        fireEvent.click(screen.getByText('Close'));
        // Toast should hide
        expect(screen.queryByTestId('toast')).not.toBeInTheDocument();

        jest.useRealTimers();
    });

    it('shows error toast on save failure', async () => {
        (global.fetch as any) = jest.fn().mockResolvedValue({ ok: false, status: 500 });

        render(
            <ScorecardManager
                type="assignment"
                schoolId="org1"
                initialScorecardData={{ id: 'sc1', name: 'Name', new: false, is_template: false, criteria: [{ name: '', description: '', minScore: 1, maxScore: 5, passScore: 3 }] }}
            />
        );

        fireEvent.click(screen.getByText('Save'));
        fireEvent.click(await screen.findByText('Confirm'));

        expect(await screen.findByTestId('toast')).toBeInTheDocument();
        expect(screen.getByTestId('toast-title')).toHaveTextContent('Save Failed');
        expect(screen.getByTestId('toast-desc')).toHaveTextContent('Failed to save scorecard changes. Please try again.');
        expect(screen.getByTestId('toast-emoji')).toHaveTextContent('❌');
    });

    it('shows error toast on create new scorecard failure', async () => {
        // First GET in mount can be ignored; mock POST failure for creation
        (global.fetch as any) = jest.fn()
            // Initial GET of scorecards
            .mockResolvedValueOnce({ ok: true, json: async () => ([]) })
            // POST creation returns not ok
            .mockResolvedValueOnce({ ok: false, status: 500 });

        render(<ScorecardManager type="assignment" schoolId="org1" />);

        // Open picker dialog from placeholder button
        fireEvent.click(screen.getByText('Add evaluation criteria'));
        // Click Create New in mocked picker
        fireEvent.click(await screen.findByText('Create New'));

        expect(await screen.findByTestId('toast')).toBeInTheDocument();
        expect(screen.getByTestId('toast-title')).toHaveTextContent('Creation Failed');
        expect(screen.getByTestId('toast-desc')).toHaveTextContent('Failed to create scorecard. Please try again.');
        expect(screen.getByTestId('toast-emoji')).toHaveTextContent('❌');
    });

    it('shows error toast when creating from template fails', async () => {
        // First GET for school scorecards empty list, then POST for template creation fails
        (global.fetch as any) = jest.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ([]) })
            .mockResolvedValueOnce({ ok: false, status: 500 });

        render(<ScorecardManager type="assignment" schoolId="org1" />);

        // Open picker and select a template (mock triggers is_template path)
        fireEvent.click(screen.getByText('Add evaluation criteria'));
        fireEvent.click(await screen.findByText('Pick Template'));

        expect(await screen.findByTestId('toast')).toBeInTheDocument();
        expect(screen.getByTestId('toast-title')).toHaveTextContent('Creation Failed');
        expect(screen.getByTestId('toast-desc')).toHaveTextContent('Failed to create scorecard from template. Please try again.');
        expect(screen.getByTestId('toast-emoji')).toHaveTextContent('❌');
    });

    it('revert restores scorecard data and notifies parent when original exists', async () => {
        const onScorecardChange = jest.fn();
        // Mock initial GET returns a scorecard that matches scorecardId so original data is recorded
        (global.fetch as any) = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ([{
                id: 1,
                title: 'Original Name',
                status: 'published',
                criteria: [{ name: '', description: '', min_score: 1, max_score: 5, pass_score: 3 }]
            }])
        });

        render(
            <ScorecardManager
                type="assignment"
                schoolId="org1"
                scorecardId="1"
                onScorecardChange={onScorecardChange}
            />
        );

        // Wait for data to load and component to render controls
        // Change name to create a diff from original, then revert
        const nameBtn = await screen.findByText('Name');
        fireEvent.click(nameBtn);
        fireEvent.click(screen.getByText('Revert'));

        // Parent should be notified with reverted data (original name)
        expect(onScorecardChange).toHaveBeenCalled();
        const lastCallArg = onScorecardChange.mock.calls[onScorecardChange.mock.calls.length - 1][0];
        expect(lastCallArg.name).toBe('Original Name');
    });

    it('duplicate creates new scorecard, focuses name and notifies parent', async () => {
        jest.useFakeTimers();
        const onScorecardChange = jest.fn();
        (global.fetch as any) = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 2, title: 'Name (Copy)' }) });

        render(
            <ScorecardManager
                type="assignment"
                schoolId="org1"
                initialScorecardData={{ id: '1', name: 'Name', new: false, is_template: false, criteria: [{ name: '', description: '', minScore: 1, maxScore: 5, passScore: 3 }] }}
                onScorecardChange={onScorecardChange}
            />
        );

        fireEvent.click(screen.getByText('Duplicate'));
        await waitFor(() => expect(onScorecardChange).toHaveBeenCalled());
        // run pending timers for focusName inside React act
        await act(async () => {
            jest.advanceTimersByTime(150);
        });
        const callArg = onScorecardChange.mock.calls[onScorecardChange.mock.calls.length - 1][0];
        expect(callArg.id).toBe(2);
        expect(callArg.new).toBe(true);

        expect(lastFocusNameMock).not.toBeNull();
        expect(lastFocusNameMock).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('shows error toast on duplicate failure', async () => {
        (global.fetch as any) = jest.fn().mockResolvedValue({ ok: false, status: 500 });

        render(
            <ScorecardManager
                type="assignment"
                schoolId="org1"
                initialScorecardData={{ id: '1', name: 'Name', new: false, is_template: false, criteria: [{ name: '', description: '', minScore: 1, maxScore: 5, passScore: 3 }] }}
            />
        );

        fireEvent.click(screen.getByText('Duplicate'));

        expect(await screen.findByTestId('toast')).toBeInTheDocument();
        expect(screen.getByTestId('toast-title')).toHaveTextContent('Duplication Failed');
        expect(screen.getByTestId('toast-desc')).toHaveTextContent('Failed to duplicate scorecard. Please try again.');
        expect(screen.getByTestId('toast-emoji')).toHaveTextContent('❌');
    });

    it('exposes imperative methods: validate, unsaved changes, revert, getters/setters', async () => {
        const onScorecardChange = jest.fn();
        // Mock GET returns published scorecard so original data is tracked
        (global.fetch as any) = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ([{
                id: 10,
                title: 'Baseline',
                status: 'published',
                criteria: [{ name: 'c1', description: 'd', min_score: 1, max_score: 5, pass_score: 3 }]
            }])
        });

        const ref = React.createRef<any>();
        render(
            <ScorecardManager
                ref={ref}
                type="assignment"
                schoolId="org1"
                scorecardId="10"
                onScorecardChange={onScorecardChange}
            />
        );

        // Wait until scorecard data is loaded from backend (id 10)
        await waitFor(() => expect(ref.current.getScorecardData()?.id).toBe(10));

        // validateScorecardCriteria should return true for a valid scorecard
        const isValid = ref.current.validateScorecardCriteria({
            id: 'x',
            name: 'ok',
            new: false,
            is_template: false,
            criteria: [{ name: 'c1', description: 'd', minScore: 1, maxScore: 5, passScore: 3 }]
        }, { showErrorMessage: jest.fn() });
        expect(isValid).toBe(true);

        // Initially no unsaved changes
        expect(ref.current.hasUnsavedScorecardChanges()).toBe(false);

        // Change via setScorecardData should trigger onScorecardChange and create unsaved changes
        const current = ref.current.getScorecardData();
        await act(async () => {
            ref.current.setScorecardData({ ...current, name: 'Changed' });
        });
        await waitFor(() => expect(onScorecardChange).toHaveBeenCalled());
        await waitFor(() => expect(ref.current.hasUnsavedScorecardChanges()).toBe(true));
        const callsAfterChange = onScorecardChange.mock.calls.length;

        // Revert via imperative method should notify parent again
        await act(async () => {
            ref.current.handleScorecardChangesRevert();
        });
        await waitFor(() => expect(onScorecardChange.mock.calls.length).toBeGreaterThanOrEqual(callsAfterChange + 1));

        // Clear scorecard via setter and ensure parent notified with undefined
        await act(async () => {
            ref.current.setScorecardData(undefined);
        });
        await waitFor(() => expect(onScorecardChange.mock.calls.length).toBeGreaterThanOrEqual(callsAfterChange + 2));
        const lastArg = onScorecardChange.mock.calls[onScorecardChange.mock.calls.length - 1][0];
        expect(lastArg).toBeUndefined();
    });
});


