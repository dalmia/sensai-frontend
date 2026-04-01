"use client";

import React, { createContext, useContext, useRef } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { Plus, X, Check, CircleDot, CheckSquare } from "lucide-react";
import { parseJSON } from "@/lib/utils/blockUtils";

// Context for passing MCQ selection state into the block from outside
export interface MCQInteractionContext {
    selectedIds: string[];
    onSelect: (optionId: string) => void;
    disabled?: boolean;
}

export const MCQContext = createContext<MCQInteractionContext | null>(null);

interface MCQOption {
    id: string;
    text: string;
}

// Extracted React component for the MCQ block render — avoids hooks-in-callback issues
function MCQBlockRenderer({ props }: { props: { editor: { isEditable: boolean }; block: { props: Record<string, string> } } }) {
    const isEditable = props.editor.isEditable;
    const blockProps = props.block.props;
    const options: MCQOption[] = parseJSON(blockProps.options, []);
    const correctOptionIds: string[] = parseJSON(blockProps.correctOptionIds, []);
    const selectionMode = blockProps.selectionMode as "single" | "multi";
    const isSingle = selectionMode === "single";

    const optionInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const mcqContext = useContext(MCQContext);

    const updateProps = (updates: Record<string, string>) => {
        // BlockNote doesn't expose updateBlock in public types for custom blocks
        (props.editor as unknown as { updateBlock: (block: unknown, update: { props: Record<string, string> }) => void })
            .updateBlock(props.block, { props: updates });
    };

    const handleOptionEnterKey = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (index < options.length - 1) {
                optionInputRefs.current[index + 1]?.focus();
            } else {
                const newId = crypto.randomUUID();
                const newOptions = [...options, { id: newId, text: "" }];
                updateProps({ options: JSON.stringify(newOptions) });
                requestAnimationFrame(() => {
                    optionInputRefs.current[options.length]?.focus();
                });
            }
        }
    };

    // Admin (editable) view
    if (isEditable) {
        return (
            <div className="w-full outline-none" contentEditable={false}>
                <div className="w-full bg-white dark:bg-[#1F1F1F] rounded-lg py-2 px-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                            Answer choices
                        </span>
                        {/* Selection mode toggle */}
                        <div className="inline-flex rounded-lg p-1 bg-gray-200 dark:bg-[#222222]">
                            <div
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium cursor-pointer transition-all ${isSingle ? "bg-white text-black dark:bg-[#333333] dark:text-white" : "text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"}`}
                                onClick={() => {
                                    updateProps({
                                        selectionMode: "single",
                                        correctOptionIds: JSON.stringify(correctOptionIds.slice(0, 1)),
                                    });
                                }}
                            >
                                <CircleDot size={11} />
                                Single
                            </div>
                            <div
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium cursor-pointer transition-all ${!isSingle ? "bg-white text-black dark:bg-[#333333] dark:text-white" : "text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"}`}
                                onClick={() => {
                                    updateProps({ selectionMode: "multi" });
                                }}
                            >
                                <CheckSquare size={11} />
                                Multiple
                            </div>
                        </div>
                    </div>

                    {/* Options rows */}
                    <div className="space-y-2 mb-2">
                        {options.map((option, index) => {
                            const isCorrect = correctOptionIds.includes(option.id);
                            return (
                                <div
                                    key={option.id}
                                    className="flex items-center gap-3 bg-gray-100 dark:bg-[#2A2A2A] rounded-md px-3 py-2.5"
                                >
                                    {/* Correct answer toggle */}
                                    <div
                                        className={`shrink-0 w-[18px] h-[18px] flex items-center justify-center cursor-pointer transition-all border-2 ${isCorrect ? "border-green-500 bg-green-500" : "border-gray-300 dark:border-gray-600 bg-transparent hover:border-green-400"} ${isSingle ? "rounded-full" : "rounded"}`}
                                        title={isCorrect ? "Unmark correct answer" : "Mark as correct answer"}
                                        aria-label={isCorrect ? "Unmark correct answer" : "Mark as correct answer"}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            let newCorrectIds: string[];
                                            if (isSingle) {
                                                newCorrectIds = isCorrect ? [] : [option.id];
                                            } else {
                                                newCorrectIds = isCorrect
                                                    ? correctOptionIds.filter(id => id !== option.id)
                                                    : [...correctOptionIds, option.id];
                                            }
                                            updateProps({ correctOptionIds: JSON.stringify(newCorrectIds) });
                                        }}
                                    >
                                        {isCorrect && <Check size={11} strokeWidth={3} color="white" />}
                                    </div>

                                    {/* Option text input */}
                                    <input
                                        ref={(el) => { optionInputRefs.current[index] = el; }}
                                        type="text"
                                        value={option.text}
                                        onChange={(e) => {
                                            const newOptions = options.map(o =>
                                                o.id === option.id ? { ...o, text: e.target.value } : o
                                            );
                                            updateProps({ options: JSON.stringify(newOptions) });
                                        }}
                                        onKeyDown={(e) => handleOptionEnterKey(e, index)}
                                        placeholder={`Option ${index + 1}`}
                                        className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    />

                                    {/* Delete button */}
                                    {options.length > 2 && (
                                        <div
                                            className="shrink-0 p-1 rounded-full hover:bg-red-100 dark:hover:bg-[#4F2828] text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer"
                                            title="Delete option"
                                            onClick={() => {
                                                const newOptions = options.filter(o => o.id !== option.id);
                                                const newCorrectIds = correctOptionIds.filter(id => id !== option.id);
                                                updateProps({
                                                    options: JSON.stringify(newOptions),
                                                    correctOptionIds: JSON.stringify(newCorrectIds),
                                                });
                                            }}
                                        >
                                            <X size={14} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Add option button */}
                    <div className="flex justify-center">
                        <div
                            className="flex items-center px-4 py-2 rounded-full bg-gray-200 hover:bg-green-100 text-gray-600 hover:text-green-700 dark:bg-[#2A2A2A] dark:hover:bg-[#2A4A3A] dark:text-gray-300 dark:hover:text-green-300 transition-colors cursor-pointer"
                            onClick={() => {
                                const newId = crypto.randomUUID();
                                const newOptions = [...options, { id: newId, text: "" }];
                                updateProps({ options: JSON.stringify(newOptions) });
                                requestAnimationFrame(() => {
                                    optionInputRefs.current[options.length]?.focus();
                                });
                            }}
                        >
                            <Plus size={14} className="mr-1" />
                            <span className="text-sm">Add</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Learner (read-only) view — interactive if MCQContext is provided
    const filteredOptions = options.filter(o => o.text.trim());

    return (
        <div className="w-full" contentEditable={false}>
            <div className="w-full bg-white dark:bg-[#1F1F1F] rounded-lg p-2">
                <div className="space-y-2">
                    {filteredOptions.map((option) => {
                        const isSelected = mcqContext?.selectedIds.includes(option.id) ?? false;
                        const isInteractive = !!mcqContext && !mcqContext.disabled;

                        return (
                            <div
                                key={option.id}
                                className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-all ${
                                    isInteractive ? 'cursor-pointer' : ''
                                } ${
                                    isSelected
                                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-500 dark:border-green-500'
                                        : `bg-gray-100 dark:bg-[#2A2A2A] border border-transparent ${isInteractive ? 'hover:border-gray-300 dark:hover:border-[#444444]' : ''}`
                                }`}
                                onClick={() => {
                                    if (isInteractive) {
                                        mcqContext.onSelect(option.id);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
                                        e.preventDefault();
                                        mcqContext.onSelect(option.id);
                                    }
                                }}
                                role={isInteractive ? "button" : undefined}
                                tabIndex={isInteractive ? 0 : undefined}
                            >
                                <div
                                    className={`shrink-0 w-[18px] h-[18px] flex items-center justify-center border-2 transition-colors ${
                                        isSelected
                                            ? 'bg-green-500 border-green-500'
                                            : 'border-gray-300 dark:border-gray-600 bg-transparent'
                                    } ${isSingle ? "rounded-full" : "rounded"}`}
                                >
                                    {isSelected && <Check size={11} strokeWidth={3} color="white" />}
                                </div>
                                <span className="text-sm text-gray-900 dark:text-white">
                                    {option.text}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// createReactBlockSpec returns the block spec directly
export const createMCQBlockSpec = createReactBlockSpec(
    {
        type: "mcq",
        propSchema: {
            textAlignment: defaultProps.textAlignment,
            backgroundColor: defaultProps.backgroundColor,
            options: {
                default: JSON.stringify([
                    { id: "1", text: "" },
                    { id: "2", text: "" },
                ]),
            },
            selectionMode: {
                default: "single" as const,
                values: ["single", "multi"] as const,
            },
            correctOptionIds: {
                default: "[]",
            },
        },
        content: "none",
    },
    {
        render: (props) => <MCQBlockRenderer props={props} />,
    }
);
