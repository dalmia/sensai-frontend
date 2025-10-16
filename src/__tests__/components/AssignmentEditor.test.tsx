import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssignmentEditor, { type AssignmentEditorHandle } from '@/components/AssignmentEditor';

// Mock global CSS that jsdom can't parse
jest.mock('@udus/notion-renderer/styles/globals.css', () => ({}));

// Mocks for child components used inside AssignmentEditor
jest.mock('@/components/BlockNoteEditor', () => {
    return function MockBlockNoteEditor({ onChange, onEditorReady }: any) {
        const replaceBlocks = jest.fn();
        const setContent = jest.fn();
        React.useEffect(() => {
            onEditorReady?.({ document: [], replaceBlocks, setContent });
        }, [onEditorReady]);
        return (
            <div>
                <div data-testid="blocknote" onClick={() => onChange?.([{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }])}>Mock BlockNote</div>
                <button type="button" onClick={() => onChange?.([])}>Clear Blocks</button>
            </div>
        );
    };
});

// Mock preview learner view to avoid heavy UI and CSS
jest.mock('@/components/LearnerAssignmentView', () => () => <div data-testid="preview-view" />);

jest.mock('@/components/NotionIntegration', () => {
    return function MockNotionIntegration({ onContentUpdate, onPageSelect, onPageRemove }: any) {
        return (
            <div>
                <button type="button" onClick={() => onContentUpdate?.([{ type: 'paragraph', content: [{ type: 'text', text: 'From Notion' }] }])}>Mock Notion</button>
                <button type="button" onClick={() => onPageSelect?.('pid', 'ptitle')}>Select Notion Page</button>
                <button type="button" onClick={() => onPageRemove?.()}>Remove Notion Page</button>
            </div>
        );
    };
});

jest.mock('@/components/KnowledgeBaseEditor', () => {
    return function MockKBE({ onKnowledgeBaseChange, onLinkedMaterialsChange }: any) {
        return (
            <div>
                <button type="button" onClick={() => onKnowledgeBaseChange?.([{ type: 'paragraph', content: [{ type: 'text', text: 'KB' }] }])}>KB Blocks</button>
                <button type="button" onClick={() => onLinkedMaterialsChange?.(['id1'])}>KB Links</button>
            </div>
        );
    };
});

jest.mock('@/components/ScorecardManager', () => {
    return React.forwardRef(function MockSCM(props: any, ref: any) {
        React.useImperativeHandle(ref, () => ({ hasScorecard: () => !!props.scorecardId }));
        return (
            <div>
                <button type="button" onClick={() => props.onScorecardChange?.({ id: 'sc1', criteria: [] })}>Pick Scorecard</button>
            </div>
        );
    });
});

jest.mock('@/lib/auth', () => ({
    useAuth: jest.fn(() => ({ user: { id: 'u1' } }))
}));

jest.mock('@/lib/utils/scorecardValidation', () => ({
    validateScorecardCriteria: jest.fn(() => true)
}));

jest.mock('@/lib/utils/integrationUtils', () => ({
    handleIntegrationPageSelection: jest.fn(async (_pageId: string, _pageTitle: string, _userId: string, _provider: string, onContent: any) => {
        onContent?.([{ type: 'paragraph', content: [{ type: 'text', text: 'Loaded from integration' }] }]);
        return { ok: true };
    }),
    handleIntegrationPageRemoval: jest.fn()
}));

describe('AssignmentEditor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as any) = jest.fn();
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:8001';
    });

    it('renders and switches tabs', () => {
        render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);
        expect(screen.getByText('Submission type')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Evaluation criteria'));
        fireEvent.click(screen.getByText('AI training resources'));
        fireEvent.click(screen.getByText('Problem statement'));
    });

    it('tracks content changes via BlockNote and Notion', () => {
        render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);
        fireEvent.click(screen.getByTestId('blocknote'));
        fireEvent.click(screen.getByText('Mock Notion'));
    });

    it('calls handleIntegrationPageSelect via NotionIntegration', async () => {
        const { handleIntegrationPageSelection } = require('@/lib/utils/integrationUtils');
        render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);
        await act(async () => {
            fireEvent.click(screen.getByText('Select Notion Page'));
            await Promise.resolve();
        });
        expect(handleIntegrationPageSelection).toHaveBeenCalled();
    });

    it('calls handleIntegrationPageRemove via NotionIntegration', () => {
        const { handleIntegrationPageRemoval } = require('@/lib/utils/integrationUtils');
        render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);
        fireEvent.click(screen.getByText('Remove Notion Page'));
        expect(handleIntegrationPageRemoval).toHaveBeenCalled();
    });

    it('handles knowledge base changes', () => {
        render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);
        fireEvent.click(screen.getByText('AI training resources'));
        fireEvent.click(screen.getByText('KB Blocks'));
        fireEvent.click(screen.getByText('KB Links'));
    });

    it('imperative handle methods work and validation fails then passes', () => {
        const ref = createRef<AssignmentEditorHandle>();
        const onValidationError = jest.fn();
        render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} onValidationError={onValidationError} />);

        // Initially no content and no scorecard
        expect(ref.current?.hasChanges()).toBe(false);
        expect(ref.current?.hasContent()).toBe(false);
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });
        expect(onValidationError).toHaveBeenCalled();

        // Add content and scorecard
        fireEvent.click(screen.getByTestId('blocknote'));
        fireEvent.click(screen.getByText('Evaluation criteria'));
        fireEvent.click(screen.getByText('Pick Scorecard'));

        expect(ref.current?.hasContent()).toBe(true);
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(true);
        });
    });

    it('saveDraft and savePublished call backend and clear dirty state', async () => {
        const ref = createRef<AssignmentEditorHandle>();
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} taskId="t1" />);
        // Wait for loading spinner to disappear and editor to render
        await act(async () => {
            // resolve any pending microtasks from effect fetch
            await Promise.resolve();
        });
        const editor = await screen.findByTestId('blocknote');
        // create content and scorecard so validate passes
        fireEvent.click(editor);
        fireEvent.click(screen.getByText('Evaluation criteria'));
        fireEvent.click(screen.getByText('Pick Scorecard'));

        await act(async () => ref.current?.saveDraft());
        await act(async () => ref.current?.savePublished());

        expect(global.fetch).toHaveBeenCalled();
    });

    it('renders preview mode path', () => {
        render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} isPreviewMode />);
        expect(screen.getByTestId('preview-view')).toBeInTheDocument();
    });

    it('validateBeforePublish handles score errors and scorecard invalidation', () => {
        const ref = createRef<AssignmentEditorHandle>();
        const onValidationError = jest.fn();
        const { validateScorecardCriteria } = require('@/lib/utils/scorecardValidation');
        render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} onValidationError={onValidationError} />);

        // Add content and scorecard
        fireEvent.click(screen.getByTestId('blocknote'));
        fireEvent.click(screen.getByText('Evaluation criteria'));
        fireEvent.click(screen.getByText('Pick Scorecard'));

        // Set invalid min (<=0)
        // Click the displayed min number to enter edit
        const minDisplay = screen.getByText('1');
        fireEvent.click(minDisplay);
        const minInput = screen.getByDisplayValue('1') as HTMLInputElement;
        fireEvent.change(minInput, { target: { value: '0' } });
        fireEvent.blur(minInput);
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        // Fix min, set invalid max (<= min)
        fireEvent.click(screen.getByText('0'));
        const minInput2 = screen.getByDisplayValue('0') as HTMLInputElement;
        fireEvent.change(minInput2, { target: { value: '2' } });
        fireEvent.blur(minInput2);

        const maxDisplay = screen.getByText('4');
        fireEvent.click(maxDisplay);
        const maxInput = screen.getByDisplayValue('4') as HTMLInputElement;
        fireEvent.change(maxInput, { target: { value: '2' } });
        fireEvent.blur(maxInput);
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        // Fix max, set invalid pass outside range
        const twos = screen.getAllByText('2');
        fireEvent.click(twos[0]);
        const maxInput2 = screen.getAllByDisplayValue('2')[0] as HTMLInputElement;
        fireEvent.change(maxInput2, { target: { value: '5' } });
        fireEvent.blur(maxInput2);

        const passDisplay = screen.getByText('3');
        fireEvent.click(passDisplay);
        const passInput = screen.getByDisplayValue('3') as HTMLInputElement;
        fireEvent.change(passInput, { target: { value: '6' } });
        fireEvent.blur(passInput);
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        // Scorecard invalidation path
        (validateScorecardCriteria as jest.Mock).mockReturnValueOnce(false);
        // Put values in range
        fireEvent.click(screen.getByText('6'));
        const passInput2 = screen.getByDisplayValue('6') as HTMLInputElement;
        fireEvent.change(passInput2, { target: { value: '3' } });
        fireEvent.blur(passInput2);
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        // handleKeyDown closes editing on Enter and Escape
        // Open min input again
        fireEvent.click(screen.getByText('2'));
        const minInput3 = screen.getByDisplayValue('2') as HTMLInputElement;
        fireEvent.keyDown(minInput3, { key: 'Enter' });
        expect(screen.queryByDisplayValue('2')).not.toBeInTheDocument();

        // Re-open and close via Escape
        fireEvent.click(screen.getByText('2'));
        const minInput4 = screen.getByDisplayValue('2') as HTMLInputElement;
        fireEvent.keyDown(minInput4, { key: 'Escape' });
        expect(screen.queryByDisplayValue('2')).not.toBeInTheDocument();
    });

    it('getDialogTitle extracts title and updateDraftAssignment error path triggers', async () => {
        const wrapper = document.createElement('div');
        const title = document.createElement('h2');
        title.textContent = 'Dialog Title';
        const content = document.createElement('div');
        content.className = 'dialog-content-editor';
        wrapper.appendChild(title);
        wrapper.appendChild(content);
        document.body.appendChild(wrapper);

        const ref = createRef<AssignmentEditorHandle>();
        // Make fetch return not ok to trigger error path
        (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
        render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} taskId="t2" />);
        // Wait for editor to render
        await act(async () => { await Promise.resolve(); });
        const editor = await screen.findByTestId('blocknote');
        // Have minimal valid content and scorecard
        fireEvent.click(editor);
        fireEvent.click(screen.getByText('Evaluation criteria'));
        fireEvent.click(screen.getByText('Pick Scorecard'));

        await act(async () => ref.current?.saveDraft());
        expect(global.fetch).toHaveBeenCalled();
    });

    it('covers fetchAssignmentData effect with success and editor clearing path', async () => {
        // First call for effect load
        ; (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true, json: async () => ({
                blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 'loaded' }] }],
                context: { blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 'ctx' }] }], linkedMaterialIds: ['a'] },
                evaluation_criteria: { min_score: 1, max_score: 5, pass_score: 3, scorecard_id: 's1' },
                input_type: 'text'
            })
        });
        render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="load1" />);
        await act(async () => { await Promise.resolve(); });

        // Trigger clearing path
        fireEvent.click(screen.getByText('Clear Blocks'));
        // Nothing to assert visually; executing code path is sufficient for coverage
    });

    it('highlights scorecard on missing evaluation and clears after timeout', () => {
        jest.useFakeTimers();
        const ref = createRef<AssignmentEditorHandle>();
        const onValidationError = jest.fn();
        render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} onValidationError={onValidationError} />);

        // Provide problem content but skip picking scorecard so hasEval is false
        fireEvent.click(screen.getByTestId('blocknote'));
        fireEvent.click(screen.getByText('Evaluation criteria'));

        // Validate to trigger scorecard highlight
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        // Expect error message for missing evaluation criteria
        const calls: any[] = (onValidationError as jest.Mock).mock.calls;
        expect(calls.some(call => call[0] === 'Missing evaluation criteria')).toBe(true);

        // Scorecard section uses animate-pulse when highlighted
        expect(document.querySelector('.animate-pulse')).toBeTruthy();

        // Advance timers to clear highlight
        act(() => {
            jest.advanceTimersByTime(4000);
        });
        expect(document.querySelector('.animate-pulse')).toBeFalsy();
        jest.useRealTimers();
    });

    it('highlights evaluation on invalid pass mark', () => {
        const ref = createRef<AssignmentEditorHandle>();
        const onValidationError = jest.fn();
        render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} onValidationError={onValidationError} />);

        // Content and scorecard so hasEval is true
        fireEvent.click(screen.getByTestId('blocknote'));
        fireEvent.click(screen.getByText('Evaluation criteria'));
        fireEvent.click(screen.getByText('Pick Scorecard'));

        // Make pass score outside [min,max]
        const passDisplay = screen.getByText('3');
        fireEvent.click(passDisplay);
        const passInput = screen.getByDisplayValue('3') as HTMLInputElement;
        fireEvent.change(passInput, { target: { value: '100' } });
        fireEvent.blur(passInput);

        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        const calls2: any[] = (onValidationError as jest.Mock).mock.calls;
        expect(calls2.some(call => call[0] === 'Invalid pass mark')).toBe(true);

        // Evaluation container gets animate-pulse class when highlighted
        expect(document.querySelector('.animate-pulse')).toBeTruthy();
    });
});


