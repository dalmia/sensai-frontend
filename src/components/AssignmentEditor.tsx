"use client";

import { forwardRef, useImperativeHandle, useMemo, useState, useRef, useCallback, useEffect } from "react";
import BlockNoteEditor from "./BlockNoteEditor";
import Dropdown, { DropdownOption } from "./Dropdown";
import { submissionTypeOptions } from "./dropdownOptions";
import NotionIntegration from "./NotionIntegration";
import KnowledgeBaseEditor from "./KnowledgeBaseEditor";
import LearnerAssignmentView from "./LearnerAssignmentView";
import ScorecardManager, { ScorecardManagerHandle } from "./ScorecardManager";
import { BookOpen, ClipboardCheck, HelpCircle } from "lucide-react";
import { BlockList, RenderConfig } from "@udus/notion-renderer/components";
import { hasBlocksContent } from "@/lib/utils/blockUtils";
import { useDragInput } from "@/lib/utils/dragInput";
import { handleIntegrationPageSelection, handleIntegrationPageRemoval } from "@/lib/utils/integrationUtils";
import { useAuth } from "@/lib/auth";
import { validateScorecardCriteria } from "@/lib/utils/scorecardValidation";
import { ScorecardTemplate } from "./ScorecardPickerDialog";
import "@udus/notion-renderer/styles/globals.css";
import Tooltip from "./Tooltip";
import PublishConfirmationDialog from './PublishConfirmationDialog';

export interface AssignmentEditorHandle {
    hasChanges: () => boolean;
    hasContent: () => boolean;
    validateBeforePublish: () => boolean;
    saveDraft: () => void;
    savePublished: () => void;
    cancel: () => void;
}

interface AssignmentEditorProps {
    taskId?: string;
    readOnly: boolean;
    status?: string;
    scheduledPublishAt: string | null;
    showPublishConfirmation?: boolean;
    onPublishCancel?: () => void;
    onPublishSuccess?: (data?: any) => void;
    onSaveSuccess?: (data?: any) => void;
    courseId?: string;
    schoolId?: string;
    onValidationError?: (title: string, message: string, emoji?: string) => void;
    isPreviewMode?: boolean;
}

const AssignmentEditor = forwardRef<AssignmentEditorHandle, AssignmentEditorProps>(({
    taskId,
    readOnly,
    status,
    scheduledPublishAt,
    onPublishSuccess,
    onSaveSuccess,
    courseId,
    schoolId,
    showPublishConfirmation,
    onPublishCancel,
    onValidationError,
    isPreviewMode = false,
}, ref) => {
    // Visual mode
    const isDarkMode = true;

    // Problem statement (question-like blocks)
    const [problemBlocks, setProblemBlocks] = useState<any[]>([]);
    // Resources (answer-like blocks)
    const [knowledgeBaseBlocks, setKnowledgeBaseBlocks] = useState<any[]>([]);
    // Linked material IDs for knowledge base
    const [linkedMaterialIds, setLinkedMaterialIds] = useState<string[]>([]);
    // Score range triple (min_score, max_score, pass_score)
    const [scoreRange, setScoreRange] = useState<{ min_score: number; max_score: number; pass_score: number }>({ min_score: 1, max_score: 4, pass_score: 3 });
    // Submission type for learner responses
    const [submissionType, setSubmissionType] = useState<DropdownOption>(submissionTypeOptions[0]);

    // Active tab: problem | resources | scorecard
    const [activeTab, setActiveTab] = useState<'problem' | 'evaluation' | 'knowledge'>('problem');

    // Highlight management (adapter to copied code)
    const [highlightedField, setHighlightedField] = useState<'problem' | 'evaluation' | 'scorecard' | null>(null);

    // Editor refs
    const editorRef = useRef<any>(null);
    const scorecardManagerRef = useRef<ScorecardManagerHandle>(null);

    // Scorecard ID from API response
    const [scorecardId, setScorecardId] = useState<string | number | undefined>(undefined);
    // Scorecard data state for validation from any tab
    const [scorecardData, setScorecardData] = useState<ScorecardTemplate | undefined>(undefined);

    // Integration state (Notion)
    const [integrationBlocks, setIntegrationBlocks] = useState<any[]>([]);
    const [isLoadingIntegration, setIsLoadingIntegration] = useState(false);
    const [integrationError, setIntegrationError] = useState<string | null>(null);

    // Dirty tracking
    const [dirty, setDirty] = useState(false);

    // Loading state for fetching assignment data
    const [isLoadingAssignment, setIsLoadingAssignment] = useState(true);
    const [hasFetchedData, setHasFetchedData] = useState(false);

    // Auth
    const { user } = useAuth();
    const userId = user?.id;

    // Load assignment data from API when taskId changes
    useEffect(() => {
        const fetchAssignmentData = async () => {
            if (!taskId || hasFetchedData) {
                setIsLoadingAssignment(false);
                return;
            }

            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch assignment details');
                }

                const data = await response.json();

                if (data) {
                    const assignment = data;

                    // Load problem blocks
                    if (assignment.blocks && Array.isArray(assignment.blocks)) {
                        setProblemBlocks(assignment.blocks);
                    }

                    // Load knowledge base data from context
                    if (assignment.context) {
                        // Extract blocks for knowledge base if they exist
                        if (assignment.context.blocks && Array.isArray(assignment.context.blocks)) {
                            setKnowledgeBaseBlocks(assignment.context.blocks);
                        }

                        // Extract linkedMaterialIds if they exist
                        if (assignment.context.linkedMaterialIds && Array.isArray(assignment.context.linkedMaterialIds)) {
                            setLinkedMaterialIds(assignment.context.linkedMaterialIds);
                        }
                    }

                    // Load evaluation criteria
                    if (assignment.evaluation_criteria) {
                        const evalCriteria = assignment.evaluation_criteria;
                        if (evalCriteria.min_score !== undefined) setScoreRange(prev => ({ ...prev, min_score: evalCriteria.min_score }));
                        if (evalCriteria.max_score !== undefined) setScoreRange(prev => ({ ...prev, max_score: evalCriteria.max_score }));
                        if (evalCriteria.pass_score !== undefined) setScoreRange(prev => ({ ...prev, pass_score: evalCriteria.pass_score }));
                    }

                    // Load scorecard ID if available
                    if (assignment.evaluation_criteria?.scorecard_id) {
                        setScorecardId(assignment.evaluation_criteria.scorecard_id);
                    }

                    // Load submission type
                    if (assignment.input_type) {
                        const matchingOption = submissionTypeOptions.find(opt => opt.value === assignment.input_type);
                        if (matchingOption) {
                            setSubmissionType(matchingOption);
                        }
                    }
                }

                setHasFetchedData(true);
            } catch (error) {
                console.error('Error fetching assignment data:', error);
            } finally {
                setIsLoadingAssignment(false);
            }
        };

        fetchAssignmentData();
    }, [taskId, hasFetchedData]);

    // Reset hasFetchedData when taskId changes
    useEffect(() => {
        setHasFetchedData(false);
        setScorecardId(undefined);
    }, [taskId]);

    // removed old per-field handlers in favor of unified handlers below

    const handleScoreChange = useCallback((key: 'min_score' | 'max_score' | 'pass_score', value: number) => {
        setScoreRange(prev => ({ ...prev, [key]: value }));
        if (highlightedField === 'evaluation') setHighlightedField(null);
        setDirty(true);
    }, [highlightedField]);

    // Editing state for each input field
    const [editingField, setEditingField] = useState<'min_score' | 'max_score' | 'pass_score' | null>(null);

    // Drag functionality for score inputs using utility hook
    const minScoreDrag = useDragInput({
        value: scoreRange.min_score,
        onChange: (value) => handleScoreChange('min_score', value),
        min: 1,
        max: scoreRange.max_score - 1,
        disabled: readOnly || isLoadingAssignment,
        onDragStart: () => setEditingField('min_score')
    });

    const maxScoreDrag = useDragInput({
        value: scoreRange.max_score,
        onChange: (value) => handleScoreChange('max_score', value),
        min: scoreRange.min_score + 1,
        max: 100,
        disabled: readOnly || isLoadingAssignment,
        onDragStart: () => setEditingField('max_score')
    });

    const passScoreDrag = useDragInput({
        value: scoreRange.pass_score,
        onChange: (value) => handleScoreChange('pass_score', value),
        min: scoreRange.min_score,
        max: scoreRange.max_score,
        disabled: readOnly || isLoadingAssignment,
        onDragStart: () => setEditingField('pass_score')
    });

    // Handle click to edit
    const handleClickToEdit = useCallback((field: 'min_score' | 'max_score' | 'pass_score') => {
        if (readOnly || isLoadingAssignment) return;
        setEditingField(field);
    }, [readOnly, isLoadingAssignment]);

    // Handle blur to stop editing
    const handleBlur = useCallback(() => {
        setEditingField(null);
    }, []);

    // Handle key down for Enter/Escape
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            setEditingField(null);
        } else if (e.key === 'Escape') {
            setEditingField(null);
        }
    }, []);

    const hasValidProblem = useMemo(() => hasBlocksContent(problemBlocks), [problemBlocks]);

    // Assignment-specific content/config (not quiz-based)
    const problemContent = useMemo(() => problemBlocks, [problemBlocks]);

    // Integration helpers (lightweight)
    const setEditorInstance = useCallback((editor: any) => {
        editorRef.current = editor;
    }, []);


    const handleQuestionContentChange = useCallback((content: any[]) => {
        setProblemBlocks(content);
        if (highlightedField === 'problem') setHighlightedField(null);
        setDirty(true);
    }, [highlightedField]);


    const handleIntegrationPageSelect = async (pageId: string, pageTitle: string) => {
        if (!userId) {
            console.error('User ID not provided');
            return;
        }

        setIsLoadingIntegration(true);
        setIntegrationError(null);

        try {
            return await handleIntegrationPageSelection(
                pageId,
                pageTitle,
                userId,
                'notion',
                (content) => {
                    setProblemBlocks(content);
                    setDirty(true);
                },
                setIntegrationBlocks,
                (error) => {
                    setIntegrationError(error);
                }
            );
        } catch (error) {
            console.error('Error handling Integration page selection:', error);
        } finally {
            setIsLoadingIntegration(false);
        }
    };

    const handleIntegrationPageRemove = () => {
        setIntegrationError(null);

        handleIntegrationPageRemoval(
            (content) => {
                setProblemBlocks(content);
                setDirty(true);
            },
            setIntegrationBlocks
        );
    };

    // Notion block adapters
    const currentIntegrationType = 'notion';
    const integrationBlock = problemContent.find((block: any) => block.type === currentIntegrationType);
    const initialContent = integrationBlock ? undefined : problemContent;

    // Handle integration blocks and editor instance clearing
    useEffect(() => {
        if (problemBlocks.length > 0) {
            if (integrationBlock && integrationBlock.content && integrationBlock.content.length > 0) {
                setIntegrationBlocks(integrationBlock.content);
            } else {
                setIntegrationBlocks([]);
            }
        }

        // Ensure editor instance is updated when content is cleared
        if (editorRef.current && problemBlocks.length === 0) {
            try {
                if (editorRef.current.replaceBlocks) {
                    editorRef.current.replaceBlocks(editorRef.current.document, []);
                } else if (editorRef.current.setContent) {
                    editorRef.current.setContent([]);
                }
            } catch (error) {
                console.error('Error clearing editor content:', error);
            }
        }
    }, [problemBlocks, integrationBlock]);

    // Handle scorecard selection changes (store ID and data)
    const handleScorecardChange = useCallback((newScorecardData: any) => {
        setScorecardId(newScorecardData?.id);
        setScorecardData(newScorecardData); // Store the full scorecard data for validation
        if (highlightedField === 'scorecard') setHighlightedField(null);
        setDirty(true);
    }, [highlightedField]);

    /**
     * Highlights a field to draw attention to a validation error
     * @param field The field to highlight
     */
    const highlightField = useCallback((field: 'problem' | 'evaluation' | 'scorecard') => {
        // Set the highlighted field
        setHighlightedField(field);

        // Clear the highlight after 4 seconds
        setTimeout(() => {
            setHighlightedField(null);
        }, 4000);
    }, []);

    // Local validation similar to QuizEditor.validateBeforePublish
    const validateBeforePublish = useCallback(() => {
        // Problem statement validation
        if (!hasValidProblem) {
            // Switch tab and show error via parent
            setActiveTab('problem');
            highlightField('problem');
            onValidationError?.(
                'Empty problem statement',
                'Please add a problem statement before proceeding',
                '🚫'
            );
            return false;
        }

        // Evaluation criteria (scorecard) validation
        const hasEval = !!(scorecardId || scorecardData);
        if (!hasEval) {
            setActiveTab('evaluation');
            highlightField('scorecard');
            onValidationError?.(
                'Missing evaluation criteria',
                'Please add evaluation criteria before proceeding',
                '🚫'
            );
            return false;
        }

        // Validate scorecard criteria if scorecard exists
        if (scorecardData) {
            const isValidScorecard = validateScorecardCriteria(
                scorecardData,
                {
                    showErrorMessage: onValidationError
                }
            );
            if (!isValidScorecard) {
                setActiveTab('evaluation');
                return false;
            }
        }

        if (scoreRange.min_score <= 0) {
            setActiveTab('evaluation');
            highlightField('evaluation');
            onValidationError?.(
                'Invalid minimum score',
                'Minimum score must be greater than 0',
                '🚫'
            );
            return false;
        }

        if (scoreRange.max_score <= scoreRange.min_score) {
            setActiveTab('evaluation');
            highlightField('evaluation');
            onValidationError?.(
                'Invalid maximum score',
                'Maximum score must be greater than minimum score',
                '🚫'
            );
            return false;
        }

        if (scoreRange.pass_score < scoreRange.min_score || scoreRange.pass_score > scoreRange.max_score) {
            setActiveTab('evaluation');
            highlightField('evaluation');
            onValidationError?.(
                'Invalid pass mark',
                'Pass mark must be within the minimum and maximum scores',
                '🚫'
            );
            return false;
        }

        return true;
    }, [hasValidProblem, scorecardId, scorecardData, onValidationError, scoreRange.min_score, scoreRange.max_score, scoreRange.pass_score, highlightField]);

    const getDialogTitle = () => {
        try {
            const titleEl = document.querySelector('.dialog-content-editor')?.parentElement?.querySelector('h2');
            return titleEl?.textContent?.trim() || '';
        } catch {
            return '';
        }
    };

    const updateDraftAssignment = async (status: 'draft' | 'published', scheduledAt?: string | null) => {
        if (!taskId) {
            console.error('Cannot save assignment: taskId is missing');
            return;
        }

        try {
            const title = getDialogTitle();

            // Build context only if present
            const context = (Array.isArray(knowledgeBaseBlocks) && knowledgeBaseBlocks.length > 0) || (Array.isArray(linkedMaterialIds) && linkedMaterialIds.length > 0)
                ? {
                    blocks: knowledgeBaseBlocks || [],
                    linkedMaterialIds: linkedMaterialIds || []
                }
                : null;

            const payload = {
                assignment: {
                    title,
                    blocks: problemBlocks || [],
                    context,
                    evaluation_criteria: {
                        scorecard_id: scorecardId ?? null,
                        min_score: scoreRange.min_score,
                        max_score: scoreRange.max_score,
                        pass_score: scoreRange.pass_score,
                    },
                    input_type: submissionType.value,
                    response_type: null,
                    max_attempts: null,
                }
            };

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}/assignment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    ...payload,
                    scheduled_publish_at: scheduledAt ?? scheduledPublishAt,
                    status,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to ${status === 'published' ? 'publish' : 'save'} assignment: ${response.status}`);
            }

            const updatedTaskData = await response.json();
            const updatedData = {
                ...updatedTaskData,
                status,
                title,
                scheduled_publish_at: scheduledAt ?? scheduledPublishAt,
                id: taskId,
            };

            // If we're saving a published assignment via Save (not Publish flow),
            // treat it as a save, not a publish. The publish flow shows a confirmation dialog.
            if (status === 'published') {
                if (showPublishConfirmation) {
                    onPublishSuccess?.(updatedData);
                } else {
                    onSaveSuccess?.(updatedData);
                }
            } else {
                onSaveSuccess?.(updatedData);
            }

            setDirty(false);
        } catch (error) {
            console.error('Error saving assignment:', error);
        }
    };


    useImperativeHandle(ref, () => ({
        hasChanges: () => dirty,
        hasContent: () => hasValidProblem && (!!scorecardId || (scorecardManagerRef.current?.hasScorecard() ?? false)),
        validateBeforePublish,
        saveDraft: () => {
            void updateDraftAssignment('draft', scheduledPublishAt);
        },
        savePublished: () => {
            void updateDraftAssignment('published', scheduledPublishAt);
        },
        cancel: () => {
            setDirty(false);
        }
    }));

    return (
        <div className="flex flex-col h-full relative">
            {isPreviewMode ? (
                <div className="w-full h-full">
                    <LearnerAssignmentView
                        problemBlocks={problemBlocks}
                        title={getDialogTitle()}
                        evaluationSettings={{
                            min: scoreRange.min_score,
                            max: scoreRange.max_score,
                            pass_mark: scoreRange.pass_score
                        }}
                        submissionType={submissionType.value}
                        userId={user?.id}
                        taskId={taskId}
                        isTestMode={true}
                        viewOnly={false}
                        className="w-full h-full"
                    />
                </div>
            ) : (
                    <div className="flex-1 flex flex-col space-y-6 h-full">
                        <PublishConfirmationDialog
                            show={!!showPublishConfirmation}
                            title="Ready to publish?"
                            message="After publishing, you won't be able to add or remove sections, but you can still edit existing ones"
                            onConfirm={(scheduledPublishAt) => updateDraftAssignment('published', scheduledPublishAt)}
                            onCancel={onPublishCancel || (() => { })}
                            isLoading={false}
                        />
                        {isLoadingAssignment && (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                            </div>
                        )}
                        {/* Settings: Submission Type */}
                        <div className="space-y-4 px-6 py-4 bg-[#111111]">
                            <div className="flex items-center">
                                <Dropdown
                                    icon={<ClipboardCheck size={16} />}
                                    title="Submission type"
                                    options={submissionTypeOptions}
                                    selectedOption={submissionType}
                                    onChange={(opt) => {
                                        if (!Array.isArray(opt)) {
                                            setSubmissionType(opt);
                                            setDirty(true);
                                        }
                                    }}
                                    disabled={readOnly}
                                />
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <div className="inline-flex bg-[#222222] rounded-lg p-1">
                                <button
                                    className={`flex items-center px-4 py-2 rounded-md text-sm cursor-pointer ${activeTab === 'problem' ? 'bg-[#333333] text-white' : 'text-gray-400 hover:text-white'}`}
                                    onClick={() => setActiveTab('problem')}
                                >
                                    <HelpCircle size={16} className="mr-2" />
                                    Problem statement
                                </button>
                                <button
                                    className={`flex items-center px-4 py-2 rounded-md text-sm cursor-pointer ${activeTab === 'evaluation' ? 'bg-[#333333] text-white' : 'text-gray-400 hover:text-white'}`}
                                    onClick={() => setActiveTab('evaluation')}
                                >
                                    <ClipboardCheck size={16} className="mr-2" />
                                    Evaluation criteria
                                </button>
                                <button
                                    className={`flex items-center px-4 py-2 rounded-md text-sm cursor-pointer ${activeTab === 'knowledge' ? 'bg-[#333333] text-white' : 'text-gray-400 hover:text-white'}`}
                                    onClick={() => setActiveTab('knowledge')}
                                >
                                    <BookOpen size={16} className="mr-2" />
                                    AI training resources
                                </button>
                            </div>
                        </div>

                        {/* Tab content */}
                        <div className="flex-1">
                            {activeTab === 'problem' && (
                                <div className="h-full flex flex-col">
                                    {/* Integration */}
                                    {!readOnly && !isLoadingAssignment && (
                                        <div className="my-4">
                                            <NotionIntegration
                                                onPageSelect={handleIntegrationPageSelect}
                                                onPageRemove={handleIntegrationPageRemove}
                                                isEditMode={!readOnly}
                                                editorContent={problemContent}
                                                loading={isLoadingIntegration}
                                                status={status}
                                                storedBlocks={integrationBlocks}
                                                onContentUpdate={(updatedContent) => {
                                                    handleQuestionContentChange(updatedContent);
                                                    setIntegrationBlocks(updatedContent.find(block => block.type === 'notion')?.content || []);
                                                }}
                                                onLoadingChange={setIsLoadingIntegration}
                                            />
                                        </div>
                                    )}
                                    <div className={`editor-container h-full overflow-y-auto overflow-hidden relative z-0 ${highlightedField === 'problem' ? 'm-2 outline-2 outline-red-400 shadow-md shadow-red-900/50 animate-pulse bg-[#2D1E1E]' : ''}`}>
                                        {isLoadingAssignment ? (
                                            <div className="flex items-center justify-center h-32">
                                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                                            </div>
                                        ) : isLoadingIntegration ? (
                                            <div className="flex items-center justify-center h-32">
                                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                                            </div>
                                        ) : integrationError ? (
                                            <div className="flex flex-col items-center justify-center h-32 text-center">
                                                <div className="text-red-400 text-sm mb-4">
                                                    {integrationError}
                                                </div>
                                                <div className="text-gray-400 text-xs">
                                                    The Notion integration may have been disconnected. Please reconnect it.
                                                </div>
                                            </div>
                                        ) : integrationBlocks.length > 0 ? (
                                            <div className="bg-[#191919] text-white px-16 pb-6 rounded-lg">
                                                <h1 className="text-white text-4xl font-bold mb-4 pl-0.5">{integrationBlock?.props?.resource_name}</h1>
                                                <RenderConfig theme="dark">
                                                    <BlockList blocks={integrationBlocks} />
                                                </RenderConfig>
                                            </div>
                                        ) : integrationBlock ? (
                                            <div className="flex flex-col items-center justify-center h-64 text-center">
                                                <div className="text-white text-lg mb-2">Notion page is empty</div>
                                                <div className="text-white text-sm">Please add content to your Notion page and refresh to see changes</div>
                                            </div>
                                        ) : (
                                            <BlockNoteEditor
                                                initialContent={initialContent}
                                                onChange={handleQuestionContentChange}
                                                isDarkMode={isDarkMode}
                                                readOnly={readOnly}
                                                onEditorReady={setEditorInstance}
                                                className="assignment-editor"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'evaluation' && (
                                <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden">
                                    {/* Eve Section */}
                                    <div className="bg-[#2F2F2F] rounded-lg shadow-xl p-2 flex-shrink-0">
                                        <div className="p-5 pb-3 bg-[#1F1F1F] mb-2">
                                            <div className="flex items-center mb-4">
                                                <h3 className="text-white text-lg font-normal">Evaluation criteria</h3>
                                                <Tooltip content="Used to decide if depth Q&A should begin" position="top">
                                                    <HelpCircle size={16} className="ml-2 text-white" />
                                                </Tooltip>
                                            </div>

                                            {/* Table header */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }} className="gap-2 mb-2 text-xs text-gray-300">
                                                <div className="px-2 text-center flex items-center justify-center">
                                                    Minimum
                                                    <Tooltip content="The minimum score that a learner needs to be marked as complete" position="top">
                                                        <HelpCircle size={12} className="ml-2 text-white" />
                                                    </Tooltip>
                                                </div>
                                                <div className="px-2 text-center flex items-center justify-center">
                                                    Maximum
                                                    <Tooltip content="The maximum score that a learner can get" position="top">
                                                        <HelpCircle size={12} className="ml-2 text-white" />
                                                    </Tooltip>
                                                </div>
                                                <div className="px-2 text-center flex items-center justify-center">
                                                    Pass Mark
                                                    <Tooltip content="The minimum score that a learner needs to get to be marked as complete" position="left">
                                                        <HelpCircle size={12} className="ml-2 text-white" />
                                                    </Tooltip>
                                                </div>
                                            </div>

                                            {/* Threshold row */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }} className={`gap-2 rounded-md p-1 text-white bg-[#2A2A2A] ${highlightedField === 'evaluation' ? 'outline-2 outline-red-400 shadow-md shadow-red-900/50 animate-pulse bg-[#2D1E1E]' : ''}`}>
                                                {/* Min Score Cell */}
                                                <div className="px-2 py-1 text-sm text-center h-full flex items-center justify-center">
                                                    {editingField === 'min_score' ? (
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={scoreRange.max_score - 1}
                                                            className="bg-[#333] rounded w-1/2 text-xs p-1 outline-none text-center"
                                                            value={scoreRange.min_score}
                                                            onChange={(e) => handleScoreChange('min_score', Number(e.target.value))}
                                                            onBlur={handleBlur}
                                                            onKeyDown={handleKeyDown}
                                                            autoFocus
                                                            onMouseDown={minScoreDrag.dragProps.onMouseDown}
                                                            disabled={readOnly || isLoadingAssignment}
                                                        />
                                                    ) : (
                                                        <Tooltip content="Click to edit or drag to change" position="bottom" disabled={readOnly || isLoadingAssignment}>
                                                            <span
                                                                className="block cursor-pointer hover:opacity-80"
                                                                onClick={() => handleClickToEdit('min_score')}
                                                                {...minScoreDrag.dragProps}
                                                            >
                                                                {scoreRange.min_score}
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                </div>

                                                {/* Max Score Cell */}
                                                <div className="px-2 py-1 text-sm text-center h-full flex items-center justify-center">
                                                    {editingField === 'max_score' ? (
                                                        <input
                                                            type="number"
                                                            min={scoreRange.min_score + 1}
                                                            className="bg-[#333] rounded w-1/2 text-xs p-1 outline-none text-center"
                                                            value={scoreRange.max_score}
                                                            onChange={(e) => handleScoreChange('max_score', Number(e.target.value))}
                                                            onBlur={handleBlur}
                                                            onKeyDown={handleKeyDown}
                                                            autoFocus
                                                            onMouseDown={maxScoreDrag.dragProps.onMouseDown}
                                                            disabled={readOnly || isLoadingAssignment}
                                                        />
                                                    ) : (
                                                        <Tooltip content="Click to edit or drag to change" position="bottom" disabled={readOnly || isLoadingAssignment}>
                                                            <span
                                                                className="block cursor-pointer hover:opacity-80"
                                                                onClick={() => handleClickToEdit('max_score')}
                                                                {...maxScoreDrag.dragProps}
                                                            >
                                                                {scoreRange.max_score}
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                </div>

                                                {/* Pass Score Cell */}
                                                <div className="px-2 py-1 text-sm text-center h-full flex items-center justify-center">
                                                    {editingField === 'pass_score' ? (
                                                        <input
                                                            type="number"
                                                            min={scoreRange.min_score}
                                                            max={scoreRange.max_score}
                                                            className="bg-[#333] rounded w-1/2 text-xs p-1 outline-none text-center"
                                                            value={scoreRange.pass_score}
                                                            onChange={(e) => handleScoreChange('pass_score', Number(e.target.value))}
                                                            onBlur={handleBlur}
                                                            onKeyDown={handleKeyDown}
                                                            autoFocus
                                                            {...passScoreDrag.dragProps}
                                                            disabled={readOnly || isLoadingAssignment}
                                                        />
                                                    ) : (
                                                        <Tooltip content="Click to edit or drag to change" position="bottom" disabled={readOnly || isLoadingAssignment}>
                                                            <span
                                                                className="block cursor-pointer hover:opacity-80"
                                                                onClick={() => handleClickToEdit('pass_score')}
                                                                {...passScoreDrag.dragProps}
                                                            >
                                                                {scoreRange.pass_score}
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Scorecard Section */}
                                    <div className={`h-full ${highlightedField === 'scorecard' ? 'outline-2 outline-red-400 shadow-md shadow-red-900/50 animate-pulse bg-[#2D1E1E] rounded-lg p-2' : ''}`}>
                                        <ScorecardManager
                                            ref={scorecardManagerRef}
                                            schoolId={schoolId}
                                            readOnly={readOnly || isLoadingAssignment}
                                            onScorecardChange={handleScorecardChange}
                                            scorecardId={scorecardId}
                                            className="scorecard-section"
                                            type="assignment"
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'knowledge' && (
                                <KnowledgeBaseEditor
                                    knowledgeBaseBlocks={knowledgeBaseBlocks}
                                    linkedMaterialIds={linkedMaterialIds}
                                    courseId={courseId}
                                    readOnly={readOnly || isLoadingAssignment}
                                    isDarkMode={isDarkMode}
                                    onKnowledgeBaseChange={(blocks) => {
                                        setKnowledgeBaseBlocks(blocks);
                                        setDirty(true);
                                    }}
                                    onLinkedMaterialsChange={(ids) => {
                                        setLinkedMaterialIds(ids);
                                        setDirty(true);
                                    }}
                                    className="assignment"
                                />
                            )}
                        </div>
                    </div>
            )}
        </div>
    );
});

AssignmentEditor.displayName = "AssignmentEditor";

export default AssignmentEditor;
