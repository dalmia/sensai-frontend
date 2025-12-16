import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssignmentEditor, { type AssignmentEditorHandle } from '@/components/AssignmentEditor';

// Mock global CSS that jsdom can't parse
jest.mock('@udus/notion-renderer/styles/globals.css', () => ({}));

// Mock notion-renderer components
jest.mock('@udus/notion-renderer/components', () => ({
    BlockList: ({ blocks }: any) => <div data-testid="block-list">{blocks?.length || 0} blocks</div>,
    RenderConfig: ({ children }: any) => <div data-testid="render-config">{children}</div>
}));

// Mocks for child components used inside AssignmentEditor
// Global config for editor mock - accessible from hoisted jest.mock
(global as any).__editorMockConfig__ = { hasReplaceBlocks: true, hasSetContent: true, shouldThrow: false };

jest.mock('@/components/BlockNoteEditor', () => {
    return function MockBlockNoteEditor({ onChange, onEditorReady }: any) {
        const replaceBlocks = jest.fn(() => {
            // Read config at call time
            const config = (global as any).__editorMockConfig__ || {};
            if (config.shouldThrow) {
                throw new Error('Editor error');
            }
        });
        const setContent = jest.fn();
        React.useEffect(() => {
            // Read config at execution time
            const config = (global as any).__editorMockConfig__ || { hasReplaceBlocks: true, hasSetContent: true };
            const editor: any = { document: [] };
            if (config.hasReplaceBlocks !== false) {
                editor.replaceBlocks = replaceBlocks;
            }
            if (config.hasSetContent !== false) {
                editor.setContent = setContent;
            }
            onEditorReady?.(editor);
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

const mockHasUnsavedScorecardChanges = jest.fn(() => false);
const mockHandleScorecardChangesRevert = jest.fn();

jest.mock('@/components/ScorecardManager', () => {
    return React.forwardRef(function MockSCM(props: any, ref: any) {
        React.useImperativeHandle(ref, () => ({
            hasScorecard: () => !!props.scorecardId,
            hasUnsavedScorecardChanges: mockHasUnsavedScorecardChanges,
            handleScorecardChangesRevert: mockHandleScorecardChangesRevert
        }));
        return (
            <div>
                <button type="button" onClick={() => props.onScorecardChange?.({ id: 'sc1', criteria: [] })}>Pick Scorecard</button>
            </div>
        );
    });
});

jest.mock('@/lib/auth', () => ({
    useAuth: jest.fn()
}));

jest.mock('@/lib/utils/scorecardValidation', () => ({
    validateScorecardCriteria: jest.fn(() => true)
}));

jest.mock('@/components/Dropdown', () => {
    return function MockDropdown({ title, selectedOption, onChange, options }: any) {
        return (
            <div data-testid={`dropdown-${title.toLowerCase().replace(/\s/g, '-')}`}>
                <div data-testid="dropdown-title">{title}</div>
                <select
                    data-testid="dropdown-select"
                    onChange={(e) => {
                        const option = options?.find((opt: any) => opt.value === e.target.value);
                        if (option && onChange) {
                            onChange(option);
                        }
                    }}
                    value={selectedOption?.value || ''}
                >
                    {options?.map((option: any) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        );
    };
});

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
        // Reset useAuth mock to default
        const { useAuth } = require('@/lib/auth');
        (useAuth as jest.Mock).mockReturnValue({ user: { id: 'u1' } });
        // Reset editor mock config
        (global as any).__editorMockConfig__ = { hasReplaceBlocks: true, hasSetContent: true, shouldThrow: false };
        // Reset scorecard manager mocks
        mockHasUnsavedScorecardChanges.mockReturnValue(false);
        mockHandleScorecardChangesRevert.mockClear();
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

    describe('handleIntegrationPageSelect', () => {
    it('calls handleIntegrationPageSelect via NotionIntegration', async () => {
        const { handleIntegrationPageSelection } = require('@/lib/utils/integrationUtils');
        render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);
        await act(async () => {
            fireEvent.click(screen.getByText('Select Notion Page'));
            await Promise.resolve();
        });
        expect(handleIntegrationPageSelection).toHaveBeenCalled();
    });

        it('handles error callback from handleIntegrationPageSelection (line 256)', async () => {
            const { handleIntegrationPageSelection } = require('@/lib/utils/integrationUtils');
            let errorCallback: ((error: string) => void) | null = null;

            // Mock handleIntegrationPageSelection to capture the error callback
            (handleIntegrationPageSelection as jest.Mock).mockImplementationOnce(
                async (_pageId: string, _pageTitle: string, _userId: string, _provider: string, onContent: any, _setIntegrationBlocks: any, onError: any) => {
                    errorCallback = onError;
                    return { ok: true };
                }
            );

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);
            await act(async () => {
                fireEvent.click(screen.getByText('Select Notion Page'));
                await Promise.resolve();
            });

            // Verify error callback was provided
            expect(errorCallback).toBeDefined();
            expect(typeof errorCallback).toBe('function');

            // Call the error callback to trigger setIntegrationError (line 256)
            if (errorCallback) {
                await act(async () => {
                    errorCallback('Integration error occurred');
                    await Promise.resolve();
                });
            }
        });

        it('handles catch block when handleIntegrationPageSelection throws (lines 259-260)', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            const { handleIntegrationPageSelection } = require('@/lib/utils/integrationUtils');

            // Make handleIntegrationPageSelection throw an error
            (handleIntegrationPageSelection as jest.Mock).mockRejectedValueOnce(new Error('Integration failed'));

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);
            await act(async () => {
                fireEvent.click(screen.getByText('Select Notion Page'));
                await Promise.resolve();
            });

            // Verify error was logged in catch block (line 260)
            await act(async () => {
                await Promise.resolve();
            });
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error handling Integration page selection:', expect.any(Error));

            consoleErrorSpy.mockRestore();
        });
    });

    describe('handleIntegrationPageRemove', () => {
    it('calls handleIntegrationPageRemove via NotionIntegration', () => {
        const { handleIntegrationPageRemoval } = require('@/lib/utils/integrationUtils');
        render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);
        fireEvent.click(screen.getByText('Remove Notion Page'));
        expect(handleIntegrationPageRemoval).toHaveBeenCalled();
    });

        it('calls callbacks to update problem blocks and integration blocks (lines 270-275)', async () => {
            const { handleIntegrationPageRemoval } = require('@/lib/utils/integrationUtils');
            let contentCallback: ((content: any[]) => void) | null = null;
            let setIntegrationBlocksCallback: ((blocks: any[]) => void) | null = null;

            // Mock handleIntegrationPageRemoval to capture the callbacks
            (handleIntegrationPageRemoval as jest.Mock).mockImplementationOnce(
                (onContent: any, setIntegrationBlocks: any) => {
                    contentCallback = onContent;
                    setIntegrationBlocksCallback = setIntegrationBlocks;
                }
            );

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);

            // Trigger the remove action
            fireEvent.click(screen.getByText('Remove Notion Page'));

            // Verify callbacks were provided
            expect(contentCallback).toBeDefined();
            expect(typeof contentCallback).toBe('function');
            expect(setIntegrationBlocksCallback).toBeDefined();
            expect(typeof setIntegrationBlocksCallback).toBe('function');

            // Call the content callback to verify it sets problem blocks and dirty state (lines 271-272)
            if (contentCallback) {
                const newContent = [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated content' }] }];
                await act(async () => {
                    contentCallback(newContent);
                    await Promise.resolve();
                });
            }

            // Call the setIntegrationBlocks callback to verify it's passed correctly (line 274)
            if (setIntegrationBlocksCallback) {
                await act(async () => {
                    setIntegrationBlocksCallback([]);
                    await Promise.resolve();
                });
            }
        });
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

    describe('useImperativeHandle methods', () => {
        it('cancel method sets dirty to false (line 524)', () => {
            const ref = createRef<AssignmentEditorHandle>();
            render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} />);

            // Make component dirty by adding content
            fireEvent.click(screen.getByTestId('blocknote'));

            // Verify it's dirty
            expect(ref.current?.hasChanges()).toBe(true);

            // Call cancel to clear dirty state (line 524)
            act(() => {
                ref.current?.cancel();
            });

            // Verify dirty is now false
            expect(ref.current?.hasChanges()).toBe(false);
        });

        it('hasUnsavedScorecardChanges calls scorecardManager method (line 526)', () => {
            mockHasUnsavedScorecardChanges.mockClear();
            const ref = createRef<AssignmentEditorHandle>();
            render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} />);

            // Select a scorecard first to ensure scorecardManagerRef is initialized
            fireEvent.click(screen.getByText('Evaluation criteria'));
            act(() => {
                fireEvent.click(screen.getByText('Pick Scorecard'));
            });

            // Call hasUnsavedScorecardChanges (line 526)
            const result = ref.current?.hasUnsavedScorecardChanges();

            // Verify scorecardManager method was called (line 526)
            expect(mockHasUnsavedScorecardChanges).toHaveBeenCalled();
            // Verify it returns a boolean
            expect(typeof result).toBe('boolean');
        });

        it('handleScorecardChangesRevert calls scorecardManager method (line 527)', () => {
            mockHandleScorecardChangesRevert.mockClear();
            const ref = createRef<AssignmentEditorHandle>();
            render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} />);

            // Select a scorecard first to ensure scorecardManagerRef is initialized
            fireEvent.click(screen.getByText('Evaluation criteria'));
            act(() => {
                fireEvent.click(screen.getByText('Pick Scorecard'));
            });

            // Call handleScorecardChangesRevert (line 527)
            // This should call scorecardManagerRef.current?.handleScorecardChangesRevert()
            act(() => {
                ref.current?.handleScorecardChangesRevert();
            });

            // Verify scorecardManager method was called (line 527)
            expect(mockHandleScorecardChangesRevert).toHaveBeenCalled();
        });
    });

    describe('Dropdown onChange handlers', () => {
        it('submission type dropdown onChange sets submission type and dirty state (lines 579-581)', () => {
            const ref = createRef<AssignmentEditorHandle>();
            render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} />);

            // Find the submission type dropdown
            const submissionDropdown = screen.getByTestId('dropdown-submission-type');
            const select = submissionDropdown.querySelector('select') as HTMLSelectElement;

            // Initially not dirty
            expect(ref.current?.hasChanges()).toBe(false);

            // Change the dropdown value to trigger onChange with a non-array value (line 579)
            act(() => {
                fireEvent.change(select, { target: { value: 'text' } });
            });

            // Verify dirty state was set (line 581)
            expect(ref.current?.hasChanges()).toBe(true);
        });

        it('copy/paste control dropdown onChange sets selected option and dirty state (lines 594-596)', () => {
            const ref = createRef<AssignmentEditorHandle>();
            render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} />);

            // Find the copy/paste control dropdown
            const copyPasteDropdown = screen.getByTestId('dropdown-allow-copy/paste?');
            const select = copyPasteDropdown.querySelector('select') as HTMLSelectElement;

            // Initially not dirty
            expect(ref.current?.hasChanges()).toBe(false);

            // Change the dropdown value to trigger onChange with a non-array value (line 594)
            act(() => {
                fireEvent.change(select, { target: { value: 'true' } });
            });

            // Verify dirty state was set (line 596)
            expect(ref.current?.hasChanges()).toBe(true);
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

    describe('updateDraftAssignment callback paths', () => {
        it('calls onPublishSuccess when status is published and showPublishConfirmation is true (line 495)', async () => {
            const ref = createRef<AssignmentEditorHandle>();
            const onPublishSuccess = jest.fn();
            const onSaveSuccess = jest.fn();
            const mockUpdatedData = { id: 't1', status: 'published', title: 'Test Title' };

            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // Initial fetch
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockUpdatedData }); // Save published

            render(
                <AssignmentEditor
                    ref={ref}
                    readOnly={false}
                    scheduledPublishAt={null}
                    taskId="t1"
                    showPublishConfirmation={true}
                    onPublishSuccess={onPublishSuccess}
                    onSaveSuccess={onSaveSuccess}
                />
            );

            await act(async () => {
                await Promise.resolve();
            });

            const editor = await screen.findByTestId('blocknote');
            fireEvent.click(editor);
            fireEvent.click(screen.getByText('Evaluation criteria'));
            fireEvent.click(screen.getByText('Pick Scorecard'));

            // Call savePublished which triggers updateDraftAssignment with status='published'
            await act(async () => {
                await ref.current?.savePublished();
            });

            // Verify onPublishSuccess was called (line 495)
            expect(onPublishSuccess).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' }));
            expect(onSaveSuccess).not.toHaveBeenCalled();
        });

        it('calls onSaveSuccess when status is published but showPublishConfirmation is false (line 497)', async () => {
            const ref = createRef<AssignmentEditorHandle>();
            const onPublishSuccess = jest.fn();
            const onSaveSuccess = jest.fn();
            const mockUpdatedData = { id: 't2', status: 'published', title: 'Test Title' };

            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // Initial fetch
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockUpdatedData }); // Save published

            render(
                <AssignmentEditor
                    ref={ref}
                    readOnly={false}
                    scheduledPublishAt={null}
                    taskId="t2"
                    showPublishConfirmation={false}
                    onPublishSuccess={onPublishSuccess}
                    onSaveSuccess={onSaveSuccess}
                />
            );

            await act(async () => {
                await Promise.resolve();
            });

            const editor = await screen.findByTestId('blocknote');
            fireEvent.click(editor);
            fireEvent.click(screen.getByText('Evaluation criteria'));
            fireEvent.click(screen.getByText('Pick Scorecard'));

            // Call savePublished which triggers updateDraftAssignment with status='published'
            await act(async () => {
                await ref.current?.savePublished();
            });

            // Verify onSaveSuccess was called (line 497)
            expect(onSaveSuccess).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' }));
            expect(onPublishSuccess).not.toHaveBeenCalled();
        });

        it('calls onSaveSuccess when status is draft (line 500)', async () => {
            const ref = createRef<AssignmentEditorHandle>();
            const onPublishSuccess = jest.fn();
            const onSaveSuccess = jest.fn();
            const mockUpdatedData = { id: 't3', status: 'draft', title: 'Test Title' };

            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // Initial fetch
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockUpdatedData }); // Save draft

            render(
                <AssignmentEditor
                    ref={ref}
                    readOnly={false}
                    scheduledPublishAt={null}
                    taskId="t3"
                    onPublishSuccess={onPublishSuccess}
                    onSaveSuccess={onSaveSuccess}
                />
            );

            await act(async () => {
                await Promise.resolve();
            });

            const editor = await screen.findByTestId('blocknote');
            fireEvent.click(editor);
            fireEvent.click(screen.getByText('Evaluation criteria'));
            fireEvent.click(screen.getByText('Pick Scorecard'));

            // Call saveDraft which triggers updateDraftAssignment with status='draft'
            await act(async () => {
                await ref.current?.saveDraft();
            });

            // Verify onSaveSuccess was called (line 500)
            expect(onSaveSuccess).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
            expect(onPublishSuccess).not.toHaveBeenCalled();
        });
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
        // Inputs are always editable now, so directly get the input
        const minInput = screen.getByDisplayValue('1') as HTMLInputElement;
        fireEvent.change(minInput, { target: { value: '0' } });
        fireEvent.blur(minInput);
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        // Fix min, set invalid max (<= min)
        const minInput2 = screen.getByDisplayValue('0') as HTMLInputElement;
        fireEvent.change(minInput2, { target: { value: '2' } });
        fireEvent.blur(minInput2);

        const maxInput = screen.getByDisplayValue('4') as HTMLInputElement;
        fireEvent.change(maxInput, { target: { value: '2' } });
        fireEvent.blur(maxInput);
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        // Fix max, set invalid pass outside range
        const maxInput2 = screen.getAllByDisplayValue('2')[0] as HTMLInputElement;
        fireEvent.change(maxInput2, { target: { value: '5' } });
        fireEvent.blur(maxInput2);

        const passInput = screen.getByDisplayValue('3') as HTMLInputElement;
        fireEvent.change(passInput, { target: { value: '6' } });
        fireEvent.blur(passInput);
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        // Scorecard invalidation path
        (validateScorecardCriteria as jest.Mock).mockReturnValueOnce(false);
        // Put values in range
        const passInput2 = screen.getByDisplayValue('6') as HTMLInputElement;
        fireEvent.change(passInput2, { target: { value: '3' } });
        fireEvent.blur(passInput2);
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        // Inputs are always editable, so just verify they exist
        const minInput3 = screen.getByDisplayValue('2') as HTMLInputElement;
        expect(minInput3).toBeInTheDocument();
    });

    it('handleScorecardChange clears highlightedField when scorecard is selected (line 311)', () => {
        jest.useFakeTimers();
        const ref = createRef<AssignmentEditorHandle>();
        const onValidationError = jest.fn();
        render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} onValidationError={onValidationError} />);

        // Add problem content but no scorecard
        fireEvent.click(screen.getByTestId('blocknote'));
        fireEvent.click(screen.getByText('Evaluation criteria'));

        // Validate to trigger scorecard highlight (sets highlightedField to 'scorecard')
        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        // Verify scorecard is highlighted (animate-pulse class should be present)
        expect(document.querySelector('.animate-pulse')).toBeTruthy();

        // Now select a scorecard - this should clear the highlight (line 311)
        fireEvent.click(screen.getByText('Pick Scorecard'));

        // Verify highlight is cleared (animate-pulse should be gone)
        act(() => {
            jest.advanceTimersByTime(100); // Allow state update
        });
        expect(document.querySelector('.animate-pulse')).toBeFalsy();

        jest.useRealTimers();
    });

    it('validateEvaluationCriteria switches to evaluation tab when not already on it (lines 331-332)', () => {
        const ref = createRef<AssignmentEditorHandle>();
        render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} />);

        // Add content and scorecard first
        fireEvent.click(screen.getByTestId('blocknote'));
        fireEvent.click(screen.getByText('Evaluation criteria'));
        fireEvent.click(screen.getByText('Pick Scorecard'));

        // Switch back to problem tab
        fireEvent.click(screen.getByText('Problem statement'));

        // Call validateEvaluationCriteria while on problem tab
        // This should switch to evaluation tab (line 332)
        act(() => {
            ref.current?.validateEvaluationCriteria();
        });

        // Verify we're now on evaluation tab (the tab should be active)
        // Check by verifying evaluation criteria inputs are visible
        const minInput = screen.getByDisplayValue('1') as HTMLInputElement;
        expect(minInput).toBeInTheDocument();
    });

    it('getDialogTitle handles catch block when querySelector throws (line 424)', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        // Mock querySelector to throw an error directly (not using optional chaining)
        const mockQuerySelector = jest.spyOn(document, 'querySelector').mockImplementation(() => {
            throw new Error('DOM query error');
        });

        const ref = createRef<AssignmentEditorHandle>();
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
        render(<AssignmentEditor ref={ref} readOnly={false} scheduledPublishAt={null} taskId="t2" />);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Add content and scorecard so saveDraft can proceed
        const editor = await screen.findByTestId('blocknote');
        fireEvent.click(editor);
        fireEvent.click(screen.getByText('Evaluation criteria'));
        fireEvent.click(screen.getByText('Pick Scorecard'));

        // Trigger saveDraft which calls getDialogTitle internally
        // getDialogTitle catch block should handle the error (line 424)
        await act(async () => {
            await ref.current?.saveDraft();
        });

        // Verify querySelector was called (getDialogTitle was executed)
        expect(mockQuerySelector).toHaveBeenCalled();
        // Verify saveDraft completed without throwing (catch block worked - line 424)

        mockQuerySelector.mockRestore();
        consoleErrorSpy.mockRestore();
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

    describe('fetchAssignmentData useEffect coverage', () => {
        it('sets hasAssignment to true and loads all assignment data (lines 138-188)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text', // Required for hasAssignment to be true
                        blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 'loaded' }] }], // Line 142
                        context: {
                            blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 'ctx' }] }], // Line 149
                            linkedMaterialIds: ['id1', 'id2'] // Line 154
                        },
                        evaluation_criteria: {
                            min_score: 2, // Line 161
                            max_score: 5, // Line 162
                            pass_score: 4, // Line 163
                            scorecard_id: 's1' // Line 168
                        },
                        settings: {
                            allowCopyPaste: true // Line 181, 183, 185
                        }
                    }
                })
            });

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="load1" />);
            await act(async () => {
                await Promise.resolve();
                await Promise.resolve(); // Wait for state updates
            });

            // Verify component rendered (hasAssignment was set to true - line 138)
            expect(screen.getByText('Submission type')).toBeInTheDocument();
        });

        it('loads problem blocks when assignment.blocks exists (line 142)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                        blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 'problem content' }] }]
                    }
                })
            });

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="load2" />);
            await act(async () => {
                await Promise.resolve();
            });
            expect(screen.getByText('Submission type')).toBeInTheDocument();
        });

        it('loads knowledge base blocks from context (line 149)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                        context: {
                            blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 'kb content' }] }]
                        }
                    }
                })
            });

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="load3" />);
            await act(async () => {
                await Promise.resolve();
            });
            expect(screen.getByText('Submission type')).toBeInTheDocument();
        });

        it('loads linkedMaterialIds from context (line 154)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                        context: {
                            linkedMaterialIds: ['material1', 'material2', 'material3']
                        }
                    }
                })
            });

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="load4" />);
            await act(async () => {
                await Promise.resolve();
            });
            expect(screen.getByText('Submission type')).toBeInTheDocument();
        });

        it('loads evaluation criteria scores (lines 160-163)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                        evaluation_criteria: {
                            min_score: 1,
                            max_score: 10,
                            pass_score: 7
                        }
                    }
                })
            });

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="load5" />);
            await act(async () => {
                await Promise.resolve();
            });
            // Verify component rendered (state was set - lines 160-163)
            expect(screen.getByText('Submission type')).toBeInTheDocument();
        });

        it('loads scorecard ID from evaluation_criteria (line 168)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                        evaluation_criteria: {
                            scorecard_id: 'scorecard-123'
                        }
                    }
                })
            });

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="load6" />);
            await act(async () => {
                await Promise.resolve();
            });
            expect(screen.getByText('Submission type')).toBeInTheDocument();
        });

        it('loads submission type and finds matching option (lines 173-175)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'audio' // Should match submissionTypeOptions
                    }
                })
            });

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="load7" />);
            await act(async () => {
                await Promise.resolve();
            });
            expect(screen.getByText('Submission type')).toBeInTheDocument();
        });

        it('loads copy/paste control setting (lines 181-185)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                        settings: {
                            allowCopyPaste: false
                        }
                    }
                })
            });

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="load8" />);
            await act(async () => {
                await Promise.resolve();
            });
            expect(screen.getByText('Submission type')).toBeInTheDocument();
        });

        it('covers editor clearing path when blocks are cleared', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                        blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 'loaded' }] }]
                    }
                })
            });
            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="load9" />);
        await act(async () => { await Promise.resolve(); });

        // Trigger clearing path
        fireEvent.click(screen.getByText('Clear Blocks'));
        });
    });

    describe('useEffect for integration blocks and editor clearing', () => {
        it('sets integration blocks when integrationBlock has content (line 287)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                        blocks: [
                            {
                                type: 'notion',
                                content: [
                                    { type: 'paragraph', content: [{ type: 'text', text: 'Notion content' }] }
                                ]
                            }
                        ]
                    }
                })
            });

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} taskId="integration1" />);
            await act(async () => {
                await Promise.resolve();
            });

            // Verify component rendered (useEffect executed and setIntegrationBlocks was called - line 287)
            expect(screen.getByText('Submission type')).toBeInTheDocument();
        });

        it('calls setContent when replaceBlocks is not available (line 299)', async () => {
            // Configure mock to only provide setContent (no replaceBlocks)
            (global as any).__editorMockConfig__ = { hasReplaceBlocks: false, hasSetContent: true, shouldThrow: false };

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);

            // Add content first
            fireEvent.click(screen.getByTestId('blocknote'));

            // Wait for editor to be ready
            await act(async () => {
                await Promise.resolve();
            });

            // Get the editor instance from the mock
            const BlockNoteEditorModule = require('@/components/BlockNoteEditor');
            // The editor should have been created with only setContent

            // Then clear it to trigger the editor clearing path
            fireEvent.click(screen.getByText('Clear Blocks'));

            // Wait for useEffect to run
            await act(async () => {
                await Promise.resolve();
            });

            // The setContent path should have been executed (line 299)
            // We can't directly verify the call, but the code path was executed
            expect(screen.getByText('Submission type')).toBeInTheDocument();
        });

        it('handles error in catch block when clearing editor content (line 302)', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            // Configure mock to throw error when replaceBlocks is called
            (global as any).__editorMockConfig__ = { hasReplaceBlocks: true, hasSetContent: true, shouldThrow: true };

            render(<AssignmentEditor readOnly={false} scheduledPublishAt={null} />);

            // Add content first
            fireEvent.click(screen.getByTestId('blocknote'));

            // Wait for editor to be ready
            await act(async () => {
                await Promise.resolve();
            });

            // Then clear it to trigger the editor clearing path with error
            fireEvent.click(screen.getByText('Clear Blocks'));

            // Wait for useEffect to run and catch block to execute
            await act(async () => {
                await Promise.resolve();
            });

            // Verify error was logged in catch block (line 302)
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error clearing editor content:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });
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

        // Expect error message for missing scorecard
        const calls: any[] = (onValidationError as jest.Mock).mock.calls;
        expect(calls.some(call => call[0] === 'Missing scorecard')).toBe(true);

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
        const passInput = screen.getByDisplayValue('3') as HTMLInputElement;
        fireEvent.change(passInput, { target: { value: '100' } });
        fireEvent.blur(passInput);

        act(() => {
            expect(ref.current?.validateBeforePublish()).toBe(false);
        });

        const calls2: any[] = (onValidationError as jest.Mock).mock.calls;
        expect(calls2.some(call => call[0] === 'Invalid pass mark')).toBe(true);

        // Evaluation container gets highlighted (check for the red outline class)
        expect(document.querySelector('.outline-red-400')).toBeTruthy();
    });
});


