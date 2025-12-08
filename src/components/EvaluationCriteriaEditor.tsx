"use client";

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

    const isHighlighted = highlightedField === 'evaluation';
    
    const renderScoreInput = (
        label: string,
        field: 'min_score' | 'max_score' | 'pass_score',
        value: number,
        min?: number,
        max?: number
    ) => {

        return (
            <div className="flex items-center justify-between py-2 px-4 rounded-md bg-[#2A2A2A]">
                <div className="flex items-center">
                    <span className="text-white text-sm font-light">{label}</span>
                </div>
                <div className="flex items-center">
                    <input
                        type="number"
                        min={min}
                        max={max}
                        className={`w-20 text-white text-xs rounded p-1 outline-none text-center ${readOnly ? 'bg-transparent' : 'bg-[#333]'}`}
                        style={{ caretColor: 'white' }}
                        value={value}
                        onChange={(e) => onScoreChange(field, Number(e.target.value))}
                        disabled={readOnly || isLoading}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#2F2F2F] rounded-lg shadow-xl p-2">
            <div className="bg-[#1F1F1F] shadow-xl p-6 mb-2">
                <div className="mb-6">
                    <h3 className="text-white text-lg font-normal">Evaluation criteria</h3>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className={`space-y-3 ${isHighlighted ? 'outline-2 outline-red-400 rounded-md' : ''}`}>
                        {renderScoreInput(
                            "Minimum Score",
                            'min_score',
                            scoreRange.min_score,
                            1,
                            scoreRange.max_score - 1
                        )}
                        {renderScoreInput(
                            "Maximum Score",
                            'max_score',
                            scoreRange.max_score,
                            scoreRange.min_score + 1,
                            100
                        )}
                        {renderScoreInput(
                            "Pass Mark",
                            'pass_score',
                            scoreRange.pass_score,
                            scoreRange.min_score,
                            scoreRange.max_score
                        )}
                    </div>

                    <div className="flex flex-col justify-center">
                        <div className="bg-[#2F2F2F] rounded-lg p-5">
                            <div className="space-y-3 text-gray-300 text-sm font-light leading-relaxed">
                                <p>
                                    Set the scoring range and pass mark. The AI evaluates submissions and assigns a score. If the score doesn&apos;t meet the pass mark, students resubmit until it does.
                                </p>
                                <p>
                                    Once the pass mark is reached, the AI asks questions across the key areas you define in the scorecard below, then generates a final report.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
