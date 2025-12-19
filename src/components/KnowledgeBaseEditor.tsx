"use client";

import { useRef, useCallback } from "react";
import { BookOpen } from "lucide-react";
import BlockNoteEditor from "./BlockNoteEditor";
import LearningMaterialLinker from "./LearningMaterialLinker";
import { extractTextFromBlocks } from "@/lib/utils/blockUtils";
import { useThemePreference } from "@/lib/hooks/useThemePreference";

interface KnowledgeBaseEditorProps {
    knowledgeBaseBlocks: any[];
    linkedMaterialIds: string[];
    courseId?: string;
    readOnly: boolean;
    onKnowledgeBaseChange: (knowledgeBaseBlocks: any[]) => void;
    onLinkedMaterialsChange: (linkedMaterialIds: string[]) => void;
    className?: string;
}

const KnowledgeBaseEditor = ({
    knowledgeBaseBlocks,
    linkedMaterialIds,
    courseId,
    readOnly,
    onKnowledgeBaseChange,
    onLinkedMaterialsChange,
    className = ""
}: KnowledgeBaseEditorProps) => {
    const { isDarkMode } = useThemePreference();
    // Reference to the knowledge base editor
    const knowledgeBaseEditorRef = useRef<any>(null);

    // Function to set the knowledge base editor reference
    const setKnowledgeBaseEditorInstance = useCallback((editor: any) => {
        knowledgeBaseEditorRef.current = editor;
    }, []);

    // Check if there's any knowledge base content
    const hasKnowledgeBaseContent = () => {
        const hasLinkedMaterials = linkedMaterialIds.length > 0;
        const hasNonEmptyBlocks = knowledgeBaseBlocks.length > 0 &&
            extractTextFromBlocks(knowledgeBaseBlocks).trim().length > 0;

        return hasLinkedMaterials || hasNonEmptyBlocks;
    };

    return (
        <div className={`w-full h-full flex flex-row overflow-y-auto px-16 space-y-6 ${className}`}>
            {/* Left column with callout (20-30% width) */}
            <div className="w-[20%]">
                <div className="bg-[#222222] p-3 rounded-md">
                    <BookOpen size={16} className="text-amber-400 mb-2" />
                    <div>
                        <p className="text-gray-400 text-xs leading-tight mb-2">
                            These resources are <span className="font-bold text-white">optional</span> and will <span className="font-bold text-white">not be shown to learners</span> but can be used by AI to provide more accurate and helpful feedback
                        </p>
                    </div>
                </div>
            </div>

            {/* Right column with linker and editor (70-80% width) */}
            <div className="w-[80%] flex flex-col">
                {readOnly && !hasKnowledgeBaseContent() ? (
                    <div className="w-full flex flex-col items-center justify-center p-8 text-center rounded-lg bg-[#1A1A1A] h-full">
                        <div className="max-w-md">
                            <h3 className="text-xl font-light text-white mb-3">No knowledge base found</h3>
                            <p className="text-gray-400 mb-6">
                                This {className.includes('assignment') ? 'assignment' : 'question'} does not have any knowledge base attached to it
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="h-full">
                        {/* Add learning material selection component */}
                        <div className="mb-4 ml-12">
                            <LearningMaterialLinker
                                courseId={courseId || ''}
                                linkedMaterialIds={linkedMaterialIds}
                                readOnly={readOnly}
                                onMaterialsChange={onLinkedMaterialsChange}
                            />
                        </div>

                        <div className="w-full flex-1 bg-[#1A1A1A] rounded-md overflow-hidden relative z-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                // Ensure the knowledge base editor keeps focus
                                if (knowledgeBaseEditorRef.current) {
                                    try {
                                        // Try to focus the editor
                                        knowledgeBaseEditorRef.current.focusEditor();
                                    } catch (err) {
                                        console.error("Error focusing knowledge base editor:", err);
                                    }
                                }
                            }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                            }}
                        >
                            <BlockNoteEditor
                                initialContent={knowledgeBaseBlocks}
                                onChange={onKnowledgeBaseChange}
                                isDarkMode={isDarkMode}
                                readOnly={readOnly}
                                onEditorReady={setKnowledgeBaseEditorInstance}
                                className="knowledge-base-editor"
                                placeholder="Link existing materials using the button above or add new material here"
                                allowMedia={false}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KnowledgeBaseEditor;
