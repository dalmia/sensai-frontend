import React, { useState } from 'react';
import { ScorecardItem } from '../types/quiz';

export interface LearnerScorecardProps {
    scorecard: ScorecardItem[];
    className?: string;
}

const LearnerScorecard: React.FC<LearnerScorecardProps> = ({
    scorecard,
    className = "",
}) => {
    // Initialize with all criteria expanded by default
    const [expandedIndices, setExpandedIndices] = useState<number[]>(
        scorecard.map((_, index) => index)
    );

    if (!scorecard || scorecard.length === 0) {
        return null;
    }

    // Calculate overall score as a percentage
    const totalScore = scorecard.reduce((sum, item) => sum + item.score, 0);
    const totalMaxScore = scorecard.reduce((sum, item) => sum + item.max_score, 0);
    const overallPercentage = Math.round((totalScore / totalMaxScore) * 100);

    const toggleExpand = (index: number) => {
        setExpandedIndices(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    return (
        <div className={`pt-6 ${className}`}>
            {/* Summary card */}
            <div className="rounded-xl p-5 shadow-sm mb-6 bg-white border border-gray-200 dark:bg-zinc-900 dark:border-transparent">
                <h2 className="text-lg font-light mb-4 text-slate-900 dark:text-white">Performance Summary</h2>

                {/* Overall score */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <div className="text-sm text-gray-600 dark:text-zinc-400">Overall Score</div>
                        <div className="text-2xl font-light mt-1 text-slate-900 dark:text-white">{totalScore}/{totalMaxScore}</div>
                    </div>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center relative">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-200 dark:stroke-zinc-800" strokeWidth="2"></circle>
                            <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                strokeDasharray="100"
                                strokeDashoffset={100 - overallPercentage}
                                className={`${overallPercentage >= 80 ? 'stroke-emerald-500' :
                                    overallPercentage >= 60 ? 'stroke-blue-500' :
                                        overallPercentage >= 40 ? 'stroke-amber-500' : 'stroke-rose-500'
                                    }`}
                                strokeWidth="2"
                                strokeLinecap="round"
                            ></circle>
                        </svg>
                        <div className="absolute text-sm font-medium text-slate-900 dark:text-white">{overallPercentage}%</div>
                    </div>
                </div>

                {/* Criteria overview */}
                <div className="space-y-3">
                    {scorecard.map((item, index) => {
                        const scorePercentage = Math.round((item.score / item.max_score) * 100);
                        return (
                            <div key={`summary-${index}`} className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 text-sm truncate pr-4 max-w-[60%] text-slate-900 dark:text-white">

                                    <svg
                                        className={`w-4 h-4 flex-shrink-0 ${item.score >= item.pass_score ? 'text-emerald-500' : 'text-rose-500'}`}
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        {item.score >= item.pass_score ? (
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                        ) : (
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                        )}
                                    </svg>
                                    <span>{item.category}</span>
                                </div>
                                <div className="flex items-center space-x-3 flex-shrink-0">
                                    <div className="w-24 h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-zinc-800">
                                        <div
                                            className={`h-full rounded-full ${scorePercentage >= 80 ? 'bg-emerald-500' :
                                                scorePercentage >= 60 ? 'bg-blue-500' :
                                                    scorePercentage >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                                }`}
                                            style={{ width: `${scorePercentage}%` }}
                                        />
                                    </div>
                                    <span className="text-xs w-10 text-right text-slate-900 dark:text-white">{item.score}/{item.max_score}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Detailed feedback section */}
            <h3 className="text-base font-light mb-3 px-1 text-slate-900 dark:text-white">Detailed Feedback</h3>
            <div className="space-y-3">
                {scorecard.map((item, index) => {
                    const scorePercentage = Math.round((item.score / item.max_score) * 100);
                    const isExpanded = expandedIndices.includes(index);

                    return (
                        <div
                            key={`detail-${index}`}
                            data-testid={`detail-${index}`}
                            className="rounded-xl shadow-sm overflow-hidden bg-white border border-gray-200 dark:bg-zinc-900 dark:border-transparent"
                        >
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer"
                                onClick={() => toggleExpand(index)}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className={`w-1.5 h-8 rounded-full ${scorePercentage >= 80 ? 'bg-emerald-500' :
                                        scorePercentage >= 60 ? 'bg-blue-500' :
                                            scorePercentage >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`} />
                                    <div>
                                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                                            <div className="flex items-center space-x-2">
                                                <div>{item.category} </div>
                                                <div className="flex items-center space-x-2">
                                                    <svg
                                                        className={`w-4 h-4 ${item.score >= item.pass_score ? 'text-emerald-500' : 'text-rose-500'}`}
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        {item.score >= item.pass_score ? (
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                                        ) : (
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                                        )}
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-zinc-400">
                                            Score: {item.score}/{item.max_score}
                                        </div>
                                    </div>
                                </div>
                                <svg
                                    className={`w-5 h-5 transition-transform ${isExpanded ? 'transform rotate-180' : ''} text-gray-500 dark:text-zinc-400`}
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                </svg>
                            </div>

                            {isExpanded && (
                                <div className="p-4 border-t border-gray-200 dark:border-zinc-800">
                                    <div className="space-y-3">
                                        {item.feedback.correct && (
                                            <div className="rounded-lg p-3 border border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                                                <div className="flex items-start">
                                                    <svg className="w-4 h-4 text-emerald-500 mt-0.5 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                                    </svg>
                                                    <div>
                                                        <h4 className="text-xs font-medium mb-1 text-emerald-800 dark:text-emerald-300">Strengths</h4>
                                                        <p className="text-xs text-emerald-700 dark:text-emerald-300/80">{item.feedback.correct}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {item.feedback.wrong && (
                                            <div className="rounded-lg p-3 border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10">
                                                <div className="flex items-start">
                                                    <svg className="w-4 h-4 text-amber-500 mt-0.5 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                    </svg>
                                                    <div>
                                                        <h4 className="text-xs font-medium mb-1 text-amber-800 dark:text-amber-300">Areas for improvement</h4>
                                                        <p className="text-xs text-amber-700 dark:text-amber-300/80">{item.feedback.wrong}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LearnerScorecard;
