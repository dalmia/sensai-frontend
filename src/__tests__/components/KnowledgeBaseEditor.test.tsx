/* eslint-disable @typescript-eslint/no-explicit-any, react/display-name */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import KnowledgeBaseEditor from '@/components/KnowledgeBaseEditor';

// Mock extractTextFromBlocks with controllable return value
let extractReturn = '';
jest.mock('@/lib/utils/blockUtils', () => ({
    extractTextFromBlocks: () => extractReturn,
}));

// Capture props passed to linker
let lastLinkerProps: any = null;
jest.mock('@/components/LearningMaterialLinker', () => (props: any) => {
    lastLinkerProps = props;
    return (
        <div data-testid="linker" onClick={() => props.onMaterialsChange?.(['m1'])}>
            Linker
        </div>
    );
});

// Mock BlockNoteEditor and expose props
let lastOnChange: any = null;
let lastOnReady: any = null;
jest.mock('@/components/BlockNoteEditor', () => (props: any) => {
    lastOnChange = props.onChange;
    lastOnReady = props.onEditorReady;
    return (
        <div data-testid="editor" className={props.className} onClick={() => props.onChange?.([{ id: 'b1' }])}>
            {props.placeholder}
        </div>
    );
});

describe('KnowledgeBaseEditor', () => {
    beforeEach(() => {
        extractReturn = '';
        lastLinkerProps = null;
        lastOnChange = null;
        lastOnReady = null;
        jest.clearAllMocks();
    });

    it('shows placeholder when readOnly and no content', () => {
        render(
            <KnowledgeBaseEditor
                knowledgeBaseBlocks={[]}
                linkedMaterialIds={[]}
                readOnly={true}
                onKnowledgeBaseChange={jest.fn()}
                onLinkedMaterialsChange={jest.fn()}
                className="assignment"
            />
        );

        expect(screen.getByText('No knowledge base found')).toBeInTheDocument();
        expect(screen.getByText(/assignment/)).toBeInTheDocument();
    });

    it('renders linker and editor when linked materials exist and wires callbacks', () => {
        const onKBChange = jest.fn();
        const onMaterials = jest.fn();

        render(
            <KnowledgeBaseEditor
                knowledgeBaseBlocks={[]}
                linkedMaterialIds={["x1"]}
                courseId="c1"
                readOnly={false}
                onKnowledgeBaseChange={onKBChange}
                onLinkedMaterialsChange={onMaterials}
            />
        );

        // Linker rendered with props
        expect(screen.getByTestId('linker')).toBeInTheDocument();
        expect(lastLinkerProps.courseId).toBe('c1');
        expect(lastLinkerProps.linkedMaterialIds).toEqual(['x1']);
        // Trigger materials change
        fireEvent.click(screen.getByTestId('linker'));
        expect(onMaterials).toHaveBeenCalledWith(['m1']);

        // Editor rendered with default dark mode and placeholder
        expect(screen.getByTestId('editor')).toBeInTheDocument();
        expect(screen.getByText('Link existing materials using the button above or add new material here')).toBeInTheDocument();
        // Trigger change from editor
        fireEvent.click(screen.getByTestId('editor'));
        expect(onKBChange).toHaveBeenCalled();
    });

    it('focuses editor on wrapper click when editorRef is ready', () => {
        const focusEditor = jest.fn();
        render(
            <KnowledgeBaseEditor
                knowledgeBaseBlocks={[]}
                linkedMaterialIds={["x1"]}
                readOnly={false}
                onKnowledgeBaseChange={jest.fn()}
                onLinkedMaterialsChange={jest.fn()}
            />
        );

        // Provide editor instance through onEditorReady
        lastOnReady?.({ focusEditor });

        // Click the wrapper (parent of editor)
        const editorDiv = screen.getByTestId('editor');
        const wrapper = editorDiv.parentElement as HTMLElement;
        fireEvent.click(wrapper);
        expect(focusEditor).toHaveBeenCalled();
    });

    it('handles focus error gracefully and logs to console', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        const badEditor = { focusEditor: () => { throw new Error('boom'); } };

        render(
            <KnowledgeBaseEditor
                knowledgeBaseBlocks={[]}
                linkedMaterialIds={["x1"]}
                readOnly={false}
                onKnowledgeBaseChange={jest.fn()}
                onLinkedMaterialsChange={jest.fn()}
            />
        );

        lastOnReady?.(badEditor);
        const wrapper = (screen.getByTestId('editor').parentElement as HTMLElement);
        fireEvent.click(wrapper);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('treats non-empty blocks as content when readOnly', () => {
        extractReturn = ' some text ';
        render(
            <KnowledgeBaseEditor
                knowledgeBaseBlocks={[{ id: 'b' }]}
                linkedMaterialIds={[]}
                readOnly={true}
                onKnowledgeBaseChange={jest.fn()}
                onLinkedMaterialsChange={jest.fn()}
            />
        );

        // Should not see the placeholder; editor should render
        expect(screen.queryByText('No knowledge base found')).not.toBeInTheDocument();
        expect(screen.getByTestId('editor')).toBeInTheDocument();
    });
});


