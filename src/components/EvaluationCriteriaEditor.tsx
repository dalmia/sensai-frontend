"use client";

import { useCallback, useState } from "react";
import { HelpCircle } from "lucide-react";
import Tooltip from "./Tooltip";

interface EvaluationCriteriaEditorProps {
    scoreRange: { min_score: number; max_score: number; pass_score: number };
    onScoreChange: (key: 'min_score' | 'max_score' | 'pass_score', value: number) => void;
    readOnly?: boolean;
    isLoading?: boolean;
    highlightedField?: 'evaluation' | null;
}

export default function EvaluationCriteriaEditor({
    scoreRange,
    onScoreChange,
    readOnly = false,
    isLoading = false,
    highlightedField = null,
}: EvaluationCriteriaEditorProps) {
    // Editing state for each input field
    const [editingField, setEditingField] = useState<'min_score' | 'max_score' | 'pass_score' | null>(null);

    // Handle click to edit
    const handleClickToEdit = useCallback((field: 'min_score' | 'max_score' | 'pass_score') => {
        if (readOnly || isLoading) return;
        setEditingField(field);
    }, [readOnly, isLoading]);

    // Handle blur to stop editing
    const handleBlur = useCallback(() => {
        setEditingField(null);
    }, []);

    // Handle key down for Enter/Escape
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            setEditingField(null);
        }
    }, []);

    const renderScoreInput = (
        label: string,
        field: 'min_score' | 'max_score' | 'pass_score',
        value: number,
        tooltip: string,
        min?: number,
        max?: number
    ) => {
        const isEditing = editingField === field;
        const isHighlighted = highlightedField === 'evaluation';

        return (
            <div
                className={`flex items-center justify-between py-3 px-4 rounded-md ${isHighlighted ? 'bg-[#2D1E1E] outline-2 outline-red-400' : 'bg-[#2A2A2A]'} transition-colors ${!isEditing && !readOnly && !isLoading ? 'cursor-pointer hover:bg-[#333333]' : ''}`}
                onClick={() => {
                    if (!isEditing && !readOnly && !isLoading) {
                        handleClickToEdit(field);
                    }
                }}
            >
                <div className="flex items-center">
                    <span className="text-white text-sm font-light mr-2">{label}</span>
                    <div onClick={(e) => e.stopPropagation()}>
                        <Tooltip content={tooltip} position="right">
                            <HelpCircle size={14} className="text-gray-400" />
                        </Tooltip>
                    </div>
                </div>
                <div className="flex items-center">
                    {isEditing ? (
                        <input
                            type="number"
                            min={min}
                            max={max}
                            className="bg-[#333] rounded w-20 text-sm p-1 outline-none text-center text-white"
                            value={value}
                            onChange={(e) => onScoreChange(field, Number(e.target.value))}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            disabled={readOnly || isLoading}
                        />
                    ) : (
                        <span
                            className="block text-white text-sm font-light min-w-[3rem] text-right"
                        >
                            {value}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#2F2F2F] rounded-lg shadow-xl p-2">
            <div className="bg-[#1F1F1F] shadow-xl p-6 mb-2">
                <div className="flex items-center mb-6">
                    <h3 className="text-white text-lg font-normal">Evaluation criteria</h3>
                    <Tooltip content="Define the scoring range and pass mark for this assignment. These determine when a learner's work meets the required standard." position="right">
                        <HelpCircle size={16} className="ml-2 text-white" />
                    </Tooltip>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                        {renderScoreInput(
                            "Minimum Score",
                            'min_score',
                            scoreRange.min_score,
                            "The lowest possible score in the scoring range. This sets the starting point for evaluation.",
                            1,
                            scoreRange.max_score - 1
                        )}
                        {renderScoreInput(
                            "Maximum Score",
                            'max_score',
                            scoreRange.max_score,
                            "The highest possible score a learner can achieve. This sets the upper limit of the scoring range.",
                            scoreRange.min_score + 1,
                            100
                        )}
                        {renderScoreInput(
                            "Pass Mark",
                            'pass_score',
                            scoreRange.pass_score,
                            "The minimum score required for a learner to pass this assignment. Learners must achieve at least this score to be marked as complete.",
                            scoreRange.min_score,
                            scoreRange.max_score
                        )}
                    </div>

                    <div className="flex flex-col justify-center">
                        <div className="bg-[#2F2F2F] rounded-lg p-6">
                            <h4 className="text-white text-base font-light mb-3">Resubmission & AI Validation Process</h4>
                            <div className="space-y-3 text-gray-300 text-sm font-light leading-relaxed">
                                <p>
                                    If the student doesn&apos;t meet the Pass Mark, they will be asked to resubmit.
                                </p>
                                <p>
                                    Upon resubmission, the AI will conduct a probing conversation to validate understanding and generate a final score based on the interaction.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
