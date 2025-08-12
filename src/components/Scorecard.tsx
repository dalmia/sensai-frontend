import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState, useMemo } from 'react';
import { Trash2, Plus, X, Info, HelpCircle, Copy, RefreshCw, Save, Check } from 'lucide-react';
import { CriterionData } from './ScorecardPickerDialog';
import './scorecard-styles.css'; // We'll create this CSS file
import SimpleTooltip from './SimpleTooltip';
import Toast from './Toast'; // Import the Toast component
import Tooltip from './Tooltip'; // Import the Tooltip component
import { useEditorContentOrSelectionChange } from '@blocknote/react';

// Description Edit Modal Component
interface DescriptionEditModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (description: string) => void;
    currentDescription: string;
    parameterName: string;
}

function DescriptionEditModal({ open, onClose, onSave, currentDescription, parameterName }: DescriptionEditModalProps) {
    const [description, setDescription] = useState(currentDescription);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Reset description when modal opens
    useEffect(() => {
        if (open) {
            setDescription(currentDescription);
        }
    }, [open, currentDescription]);

    // Focus textarea when modal opens
    useEffect(() => {
        if (open && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [open]);

    const handleSave = () => {
        onSave(description);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSave();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
                className="w-full max-w-2xl bg-[#1A1A1A] rounded-lg shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Dialog Content */}
                <div className="p-6">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-light text-white mb-2">
                                Edit Description for &quot;{parameterName}&quot;
                            </h3>
                            <textarea
                                ref={textareaRef}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Enter description"
                                className="w-full px-4 py-3 bg-[#0D0D0D] text-white text-sm rounded-lg font-light placeholder-gray-500 outline-none border-none resize-none min-h-[120px]"
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    </div>
                </div>

                {/* Dialog Footer */}
                <div className="flex justify-end gap-4 p-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ScorecardProps {
    name: string;
    criteria: CriterionData[];
    onDelete?: () => void;
    readOnly?: boolean;
    linked: boolean;
    onChange?: (criteria: CriterionData[]) => void;
    onNameChange?: (newName: string) => void;
    onDuplicate?: () => void; // New prop for duplicating the scorecard
    onSave?: () => void; // New prop for saving published scorecard changes
    new?: boolean; // New prop to indicate if the scorecard is new
    scorecardId?: string; // New prop for scorecard ID
    allQuestions?: any[]; // New prop to pass all questions for checking usage
    originalName?: string; // Original name for change detection
    originalCriteria?: CriterionData[]; // Original criteria for change detection
    onRevert?: () => void; // New prop for reverting all changes atomically
}

export interface ScorecardHandle {
    focusName: () => void;
    discardChanges: () => void;
}

// Interface to track which cell is being edited
interface EditingCell {
    rowIndex: number;
    field: 'name' | 'maxScore' | 'minScore' | 'passScore';
}

const Scorecard = forwardRef<ScorecardHandle, ScorecardProps>(({
    name,
    criteria,
    onDelete,
    readOnly = false,
    linked = false,
    onChange,
    onNameChange,
    onDuplicate,
    onSave,
    new: isNew = false,
    scorecardId,
    allQuestions = [],
    originalName,
    originalCriteria,
    onRevert
}, ref) => {
    const nameRef = useRef<HTMLInputElement>(null);
    // State to track which cell is being edited
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    // State to track the current value being edited
    const [editValue, setEditValue] = useState<string>('');
    // State to track name input value for controlled component
    const [nameValue, setNameValue] = useState<string>(name || '');
    // State for Toast notification
    const [toast, setToast] = useState({
        show: false,
        title: '',
        description: '',
        emoji: ''
    });
    // State to track highlighted fields
    const [highlightedField, setHighlightedField] = useState<{ index: number, field: 'name' | 'description' } | null>(null);

    // State for description edit modal
    const [descriptionModal, setDescriptionModal] = useState<{
        open: boolean;
        rowIndex: number;
        currentDescription: string;
        parameterName: string;
    }>({
        open: false,
        rowIndex: -1,
        currentDescription: '',
        parameterName: ''
    });

    // Add ref to track previous scorecard ID for transition detection
    const prevScorecardIdRef = useRef<string | undefined>(scorecardId);

    // Update nameValue when prop changes
    useEffect(() => {
        setNameValue(name || '');
    }, [name]);

    // Listen for highlight-criterion events
    useEffect(() => {
        const handleHighlightCriterion = (event: CustomEvent) => {
            const { index, field } = event.detail;

            // Set the highlighted field - we only need the index now since we highlight the whole row
            setHighlightedField({ index, field });

            // Clear the highlight after 4 seconds
            setTimeout(() => {
                setHighlightedField(null);
            }, 4000);
        };

        // Add event listener
        document.addEventListener('highlight-criterion', handleHighlightCriterion as EventListener);

        // Clean up
        return () => {
            document.removeEventListener('highlight-criterion', handleHighlightCriterion as EventListener);
        };
    }, []);

    // Auto-hide toast after 5 seconds
    useEffect(() => {
        let toastTimer: NodeJS.Timeout | null = null;

        if (toast.show) {
            toastTimer = setTimeout(() => {
                closeToast();
            }, 5000); // 5 seconds
        }

        // Clean up timeout when component unmounts or toast state changes
        return () => {
            if (toastTimer) {
                clearTimeout(toastTimer);
            }
        };
    }, [toast.show]);

    // Expose the focusName method to parent components
    useImperativeHandle(ref, () => ({
        focusName: () => {
            if (nameRef.current) {
                nameRef.current.focus();
                // Select all text to make it easy to replace
                nameRef.current.select();
            }
        },
        discardChanges: () => {
            handleCancel();
        }
    }));

    // Function to add a new criterion
    const handleAddCriterion = () => {
        if (!onChange) return;

        const newCriterion: CriterionData = {
            name: '',
            description: '',
            maxScore: 5,
            minScore: 1,
            passScore: 3
        };

        const updatedCriteria = [...(criteria || []), newCriterion];
        onChange(updatedCriteria);
    };

    // Function to delete a criterion by index
    const handleDeleteCriterion = (indexToDelete: number) => {
        if (!onChange) return;

        const updatedCriteria = criteria.filter((_, index) => index !== indexToDelete);
        onChange(updatedCriteria);
    };

    // Function to close toast
    const closeToast = () => {
        setToast(prev => ({ ...prev, show: false }));
    };

    // Function to validate criteria before saving
    const validateCriteriaForSave = () => {
        const emptyFields: Array<{ index: number; field: 'name' | 'description'; fieldName: string }> = [];

        criteria.forEach((criterion, index) => {
            if (!criterion.name || criterion.name.trim() === '') {
                emptyFields.push({ index, field: 'name', fieldName: 'Parameter' });
            }
            if (!criterion.description || criterion.description.trim() === '') {
                emptyFields.push({ index, field: 'description', fieldName: 'Description' });
            }
        });

        return emptyFields;
    };

    // Function to handle save with validation
    const handleSave = () => {
        const emptyFields = validateCriteriaForSave();

        if (emptyFields.length > 0) {
            // Highlight the first problematic row
            const firstEmpty = emptyFields[0];
            setHighlightedField({ index: firstEmpty.index, field: firstEmpty.field });

            // Show toast with validation error
            const fieldCount = emptyFields.length;
            const uniqueRows = new Set(emptyFields.map(field => field.index)).size;

            setToast({
                show: true,
                title: 'Missing Required Fields',
                description: `Please fill all parameter names and descriptions before saving`,
                emoji: '🚫'
            });

            // Clear the highlight after 4 seconds
            setTimeout(() => {
                setHighlightedField(null);
            }, 4000);

            return; // Don't proceed with save
        }

        // If validation passes, proceed with save
        if (onSave) {
            onSave();
        }
    };

    // Function to handle cancel - revert to original values
    const handleCancel = () => {
        if (onRevert) {
            onRevert();
        }
    };

    // Function to start editing a cell
    const startEditing = (rowIndex: number, field: EditingCell['field']) => {
        if (readOnly) return;

        const value = field === 'maxScore' || field === 'minScore' || field === 'passScore'
            ? criteria[rowIndex][field].toString()
            : criteria[rowIndex][field] || '';

        setEditingCell({ rowIndex, field });
        setEditValue(value);
    };

    // Function to open description edit modal
    const openDescriptionModal = (rowIndex: number) => {
        if (readOnly) return;

        setDescriptionModal({
            open: true,
            rowIndex,
            currentDescription: criteria[rowIndex].description || '',
            parameterName: criteria[rowIndex].name || 'Untitled'
        });
    };

    // Function to save description from modal
    const saveDescriptionFromModal = (description: string) => {
        if (!onChange || descriptionModal.rowIndex === -1) return;

        const updatedCriteria = [...criteria];
        updatedCriteria[descriptionModal.rowIndex] = {
            ...updatedCriteria[descriptionModal.rowIndex],
            description: description
        };

        onChange(updatedCriteria);
    };

    // Function to save changes when editing is complete
    const saveChanges = () => {
        if (!editingCell || !onChange) return;

        const { rowIndex, field } = editingCell;
        const updatedCriteria = [...criteria];

        if (field === 'maxScore' || field === 'minScore' || field === 'passScore') {
            // Convert to number and validate
            const numberValue = parseInt(editValue, 10);
            if (!isNaN(numberValue) && numberValue >= 0) {
                // Check for min/max score relationship
                if (field === 'minScore' && numberValue >= criteria[rowIndex].maxScore) {
                    // Show toast notification
                    setToast({
                        show: true,
                        title: 'Incorrect Value',
                        description: 'Minimum score must be less than the maximum score',
                        emoji: '⚠️'
                    });
                    setEditingCell(null);
                    return; // Don't save the incorrect value
                }

                if (field === 'maxScore' && numberValue <= criteria[rowIndex].minScore) {
                    // Show toast notification
                    setToast({
                        show: true,
                        title: 'Incorrect Value',
                        description: 'Maximum score must be greater than the minimum score',
                        emoji: '⚠️'
                    });
                    setEditingCell(null);
                    return; // Don't save the incorrect value
                }

                if (field === 'passScore' && (numberValue > criteria[rowIndex].maxScore || numberValue < criteria[rowIndex].minScore)) {
                    // Show toast notification
                    setToast({
                        show: true,
                        title: 'Incorrect Value',
                        description: 'Pass mark must be between the minimum and maximum',
                        emoji: '⚠️'
                    });
                    setEditingCell(null);
                    return; // Don't save the incorrect value
                }

                updatedCriteria[rowIndex] = {
                    ...updatedCriteria[rowIndex],
                    [field]: numberValue
                };
            }
        } else {
            updatedCriteria[rowIndex] = {
                ...updatedCriteria[rowIndex],
                [field]: editValue
            };
        }

        onChange(updatedCriteria);
        setEditingCell(null);
    };

    // Handle key press events in the edit inputs
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            // For all fields, save on Enter
            saveChanges();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    // Check if this scorecard is used by multiple questions
    const isUsedByMultipleQuestions = useMemo(() => {
        if (!scorecardId || !allQuestions.length) return false;

        // Count how many questions use this scorecard ID
        const usageCount = allQuestions.filter(question =>
            question.config?.scorecardData?.id === scorecardId
        ).length;

        return usageCount > 1;
    }, [scorecardId, allQuestions]);

    // Check if the scorecard has been modified (for published scorecards)
    const hasChanges = useMemo(() => {
        // Detect if we're in a transition by comparing current and previous scorecard IDs
        const isCurrentlyTransitioning = prevScorecardIdRef.current !== scorecardId;

        // Update the ref for next comparison
        if (isCurrentlyTransitioning) {
            prevScorecardIdRef.current = scorecardId;
        }

        // Don't show changes during transitions to prevent save button flashing
        if (isCurrentlyTransitioning) {
            return false;
        }

        // For published scorecards with original data, check against original values
        if (originalName && originalCriteria) {
            // Check if name has changed
            if (nameValue !== originalName) return true;

            // Check if criteria length has changed
            if (criteria.length !== originalCriteria.length) return true;

            // Check if any criterion has changed
            for (let i = 0; i < criteria.length; i++) {
                const current = criteria[i];
                const original = originalCriteria[i];

                if (!original) return true; // New criterion added

                if (current.name !== original.name ||
                    current.description !== original.description ||
                    current.minScore !== original.minScore ||
                    current.maxScore !== original.maxScore ||
                    current.passScore !== original.passScore) {
                    return true;
                }
            }

            return false;
        }

        // For draft scorecards (no original data), consider any content as changes
        // Show save button if there's a name or any criteria with content
        if (nameValue.trim()) return true;

        if (criteria.some(criterion =>
            criterion.name.trim() ||
            criterion.description.trim() ||
            criterion.minScore !== 1 ||
            criterion.maxScore !== 5
        )) {
            return true;
        }

        return false;
    }, [nameValue, criteria, originalName, originalCriteria, scorecardId]);

    // Determine if save button should be shown
    const shouldShowSaveButton = hasChanges && onSave;

    // Determine if banner should be shown
    const shouldShowBanner = !readOnly && isNew && (linked || isUsedByMultipleQuestions);

    return (
        <div className="w-full">
            {/* Toast notification */}
            <Toast
                show={toast.show}
                title={toast.title}
                description={toast.description}
                emoji={toast.emoji}
                onClose={closeToast}
            />

            <div className="w-full bg-[#2F2F2F] rounded-lg shadow-xl p-2"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with name */}
                <div className="p-5 pb-3 bg-[#1F1F1F] mb-2">
                    {/* NEW pill */}
                    {/* {isNew && (
                        <div className="mb-3">
                            <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-700 text-white">
                                NEW
                            </span>
                        </div>
                    )} */}

                    <div className="flex items-center mb-4">
                        <input
                            ref={nameRef}
                            type="text"
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            placeholder="Scorecard Name"
                            className={`text-white text-lg font-normal bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-b focus:border-white/50 w-full max-w-full ${readOnly ? 'cursor-default' : ''}`}
                            style={{ caretColor: 'white' }}
                            onBlur={(e) => onNameChange && onNameChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && onNameChange) {
                                    e.currentTarget.blur();
                                    onNameChange(e.currentTarget.value);
                                }
                            }}
                            disabled={readOnly}
                        />

                        <div className="ml-4 flex items-center space-x-2">
                            {/* Save scorecard button - only show for modified published scorecards */}
                            {shouldShowSaveButton && (
                                <Tooltip content="Save changes" position="bottom">
                                    <button
                                        onClick={handleSave}
                                        className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors cursor-pointer"
                                        aria-label="Save scorecard changes"
                                    >
                                        Save
                                    </button>
                                </Tooltip>
                            )}

                            {/* Cancel scorecard button - only show for modified published scorecards */}
                            {shouldShowSaveButton && originalName && originalCriteria && (
                                <Tooltip content="Cancel changes" position="bottom">
                                    <button
                                        onClick={handleCancel}
                                        className="px-3 py-1.5 rounded-md bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium transition-colors cursor-pointer"
                                        aria-label="Cancel scorecard changes"
                                    >
                                        Cancel
                                    </button>
                                </Tooltip>
                            )}

                            {/* Duplicate scorecard button - only show for linked scorecards */}
                            {onDuplicate && !readOnly && (
                                <Tooltip content="Duplicate" position="bottom">
                                    <button
                                        onClick={onDuplicate}
                                        className="flex items-center justify-center p-2 rounded-full hover:bg-[#333] text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                                        aria-label="Duplicate scorecard"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </Tooltip>
                            )}

                            {/* Delete scorecard button */}
                            {!readOnly && <Tooltip content="Delete" position="bottom">
                                <button
                                    onClick={onDelete}
                                    className="flex items-center justify-center p-2 rounded-full hover:bg-[#4F2828] text-gray-400 hover:text-red-300 transition-colors cursor-pointer"
                                    aria-label="Delete scorecard"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </Tooltip>}
                        </div>
                    </div>

                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr 80px 80px 100px 40px' }} className="gap-2 mb-2 text-xs text-gray-300">
                        <div className="px-2 flex items-center">
                            Parameter
                            <div className="relative ml-1 text-gray-500 hover:text-gray-300 cursor-pointer group">
                                <HelpCircle size={12} />
                                <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 hidden group-hover:block px-3 py-1.5 rounded bg-gray-900 text-white text-xs whitespace-nowrap z-[10000]">
                                    The specific aspect of the response or skill of the learner to be evaluated
                                    <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                                </div>
                            </div>
                        </div>
                        <div className="px-2 flex items-center">
                            Description
                            <div className="relative ml-1 text-gray-500 hover:text-gray-300 cursor-pointer group">
                                <HelpCircle size={12} />
                                <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 hidden group-hover:block px-3 py-1.5 rounded bg-gray-900 text-white text-xs whitespace-nowrap z-[10000]">
                                    A detailed explanation of what is being measured by this parameter
                                    <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                                </div>
                            </div>
                        </div>
                        <div className="px-2 text-center flex items-center justify-center">
                            Minimum
                            <div className="relative ml-1 text-gray-500 hover:text-gray-300 cursor-pointer group">
                                <HelpCircle size={12} />
                                <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 hidden group-hover:block px-3 py-1.5 rounded bg-gray-900 text-white text-xs whitespace-nowrap z-[10000]">
                                    The lowest possible score for this parameter
                                    <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
                                </div>
                            </div>
                        </div>
                        <div className="px-2 text-center flex items-center justify-center">
                            Maximum
                            <div className="relative ml-1 text-gray-500 hover:text-gray-300 cursor-pointer group">
                                <HelpCircle size={12} />
                                <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 hidden group-hover:block px-3 py-1.5 rounded bg-gray-900 text-white text-xs whitespace-nowrap z-[10000]">
                                    The highest possible score for this parameter
                                    <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
                                </div>
                            </div>
                        </div>
                        <div className="px-2 text-center flex items-center justify-center">
                            Pass Mark
                            <div className="relative ml-1 text-gray-500 hover:text-gray-300 cursor-pointer group">
                                <HelpCircle size={12} />
                                <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 hidden group-hover:block px-3 py-1.5 rounded bg-gray-900 text-white text-xs whitespace-nowrap z-[10000]">
                                    The minimum score that a learner needs to get for this parameter to be marked as complete
                                    <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
                                </div>
                            </div>
                        </div>
                        <div className="px-2"></div> {/* Empty header for delete button */}
                    </div>

                    {/* Criteria rows */}
                    <div className="space-y-2 mb-3">
                        {criteria?.map((criterion, index) => {
                            // Generate a unique background color for each criterion pill
                            const pillColors = ["#5E3B5D", "#3B5E4F", "#3B4E5E", "#5E3B3B", "#4F5E3B"];
                            const pillColor = pillColors[index % pillColors.length];

                            // Check if this row should be highlighted
                            const isRowHighlighted = highlightedField && highlightedField.index === index;

                            return (
                                <div
                                    key={index}
                                    style={{ display: 'grid', gridTemplateColumns: '350px 1fr 80px 80px 100px 40px' }}
                                    className={`gap-2 rounded-md p-1 text-white ${isRowHighlighted ? 'bg-[#4D2424] outline outline-2 outline-red-400 shadow-md shadow-red-900/50 animate-pulse' : 'bg-[#2A2A2A]'}`}
                                >
                                    {/* Criterion Name Cell */}
                                    <div className="px-2 py-1 text-sm h-full flex items-center">
                                        {editingCell?.rowIndex === index && editingCell.field === 'name' ? (
                                            <div className="relative w-full flex items-center">
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={saveChanges}
                                                    onKeyDown={handleKeyDown}
                                                    autoFocus
                                                    className="bg-[#333] rounded w-full text-xs p-1 pr-10 outline-none"
                                                    style={{ caretColor: 'white' }}
                                                />
                                                <button
                                                    onClick={saveChanges}
                                                    className="absolute right-0 top-1/2 transform -translate-y-1/2 p-1 rounded-md bg-green-600 hover:bg-green-700 text-white shadow-lg border border-green-500 transition-colors cursor-pointer"
                                                    aria-label="Save parameter name"
                                                >
                                                    <Check size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <Tooltip content="Click to edit" position="bottom" disabled={readOnly}>
                                                <span
                                                    className="inline-block px-2 py-0.5 rounded-full text-xs text-white whitespace-nowrap cursor-pointer hover:opacity-80 relative"
                                                    style={{ backgroundColor: pillColor }}
                                                    onClick={() => startEditing(index, 'name')}
                                                >
                                                    {criterion.name || 'Click to add name'}
                                                </span>
                                            </Tooltip>
                                        )}
                                    </div>

                                    {/* Description Cell */}
                                    <div className="px-2 py-1 text-sm flex items-start h-full">
                                        <Tooltip content="Click to edit" position="bottom" disabled={readOnly} className="w-full">
                                            <span
                                                className={`block break-words text-sm w-full whitespace-pre-wrap cursor-pointer hover:opacity-80 relative z-50 ${criterion.description ? '' : 'text-gray-500'}`}
                                                onClick={() => openDescriptionModal(index)}
                                            >
                                                {criterion.description || 'Click to add description'}
                                            </span>
                                        </Tooltip>
                                    </div>

                                    {/* Min Score Cell */}
                                    <div className="px-2 py-1 text-sm text-center h-full flex items-center justify-center">
                                        {editingCell?.rowIndex === index && editingCell.field === 'minScore' ? (
                                            <input
                                                type="number"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={saveChanges}
                                                onKeyDown={handleKeyDown}
                                                autoFocus
                                                min="0"
                                                max="100"
                                                className="bg-[#333] rounded w-full text-xs p-1 outline-none text-center"
                                                style={{ caretColor: 'white' }}
                                            />
                                        ) : (
                                            <Tooltip content="Click to edit" position="bottom" disabled={readOnly}>
                                                <span
                                                    className="block cursor-pointer hover:opacity-80"
                                                    onClick={() => startEditing(index, 'minScore')}
                                                >
                                                    {criterion.minScore}
                                                </span>
                                            </Tooltip>
                                        )}
                                    </div>

                                    {/* Max Score Cell */}
                                    <div className="px-2 py-1 text-sm text-center h-full flex items-center justify-center">
                                        {editingCell?.rowIndex === index && editingCell.field === 'maxScore' ? (
                                            <input
                                                type="number"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={saveChanges}
                                                onKeyDown={handleKeyDown}
                                                autoFocus
                                                min="0"
                                                max="100"
                                                className="bg-[#333] rounded w-full text-xs p-1 outline-none text-center"
                                                style={{ caretColor: 'white' }}
                                            />
                                        ) : (
                                            <Tooltip content="Click to edit" position="bottom" disabled={readOnly}>
                                                <span
                                                    className="block cursor-pointer hover:opacity-80"
                                                    onClick={() => startEditing(index, 'maxScore')}
                                                >
                                                    {criterion.maxScore}
                                                </span>
                                            </Tooltip>
                                        )}
                                    </div>

                                    {/* Pass Score Cell */}
                                    <div className="px-2 py-1 text-sm text-center h-full flex items-center justify-center">
                                        {editingCell?.rowIndex === index && editingCell.field === 'passScore' ? (
                                            <input
                                                type="number"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={saveChanges}
                                                onKeyDown={handleKeyDown}
                                                autoFocus
                                                min="0"
                                                max="100"
                                                className="bg-[#333] rounded w-full text-xs p-1 outline-none text-center"
                                                style={{ caretColor: 'white' }}
                                            />
                                        ) : (
                                            <Tooltip content="Click to edit" position="bottom" disabled={readOnly}>
                                                <span
                                                    className="block cursor-pointer hover:opacity-80"
                                                    onClick={() => startEditing(index, 'passScore')}
                                                >
                                                    {criterion.passScore}
                                                </span>
                                            </Tooltip>
                                        )}
                                    </div>

                                    {/* Delete Button Cell */}
                                    <div className="h-full flex items-center justify-center">
                                        {criteria.length > 1 && !readOnly && (
                                            <button
                                                onClick={() => handleDeleteCriterion(index)}
                                                className="p-1 rounded-full hover:bg-[#4F2828] text-gray-500 hover:text-red-300 transition-colors cursor-pointer"
                                                aria-label={`Delete parameter ${criterion.name}`}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* If no criteria, show empty state */}
                        {(!criteria || criteria.length === 0) && !readOnly && (
                            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 80px 80px 40px' }} className="gap-2 bg-[#2A2A2A] rounded-md p-1 text-white">
                                <div className="px-2 py-1 text-sm flex items-center">
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs text-white bg-[#5E3B5D]">
                                        Add parameter
                                    </span>
                                </div>
                                <div className="px-2 py-1 flex items-center">
                                    <div className="h-3 bg-[#333] rounded w-full"></div>
                                </div>
                                <div className="px-2 py-1 text-sm text-center"></div>
                                <div></div>
                            </div>
                        )}
                    </div>

                    {/* Add Criterion button - now below the criteria rows */}
                    {!readOnly && <div className="flex justify-center mt-3">
                        <button
                            onClick={handleAddCriterion}
                            className="flex items-center px-4 py-2 rounded-full bg-[#2A2A2A] hover:bg-[#2A4A3A] text-gray-300 hover:text-green-300 transition-colors cursor-pointer"
                            aria-label="Add parameter"
                        >
                            <Plus size={14} className="mr-1" />
                            <span className="text-sm">Add</span>
                        </button>
                    </div>}
                </div>
            </div>

            {/* Description Edit Modal */}
            <DescriptionEditModal
                open={descriptionModal.open}
                onClose={() => setDescriptionModal(prev => ({ ...prev, open: false }))}
                onSave={saveDescriptionFromModal}
                currentDescription={descriptionModal.currentDescription}
                parameterName={descriptionModal.parameterName}
            />
        </div>
    );
});

// Add display name for better debugging
Scorecard.displayName = 'Scorecard';

export default Scorecard; 