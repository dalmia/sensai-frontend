// Parse JSON safely with a fallback
export function parseJSON<T>(str: string, fallback: T): T {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

// Extract MCQ settings from BlockNote document blocks
export function extractMCQFromBlocks(blocks: any[]): { enabled: boolean; selectionMode: 'single' | 'multi'; options: { id: string; text: string }[]; correctOptionIds: string[] } | null {
    if (!blocks || !Array.isArray(blocks)) return null;

    for (const block of blocks) {
        if (block.type === "mcq" && block.props) {
            const options = typeof block.props.options === "string"
                ? parseJSON(block.props.options, [])
                : block.props.options || [];
            const correctOptionIds = typeof block.props.correctOptionIds === "string"
                ? parseJSON(block.props.correctOptionIds, [])
                : block.props.correctOptionIds || [];
            return {
                enabled: true,
                selectionMode: block.props.selectionMode || "single",
                options,
                correctOptionIds,
            };
        }
        if (block.children && Array.isArray(block.children)) {
            const found = extractMCQFromBlocks(block.children);
            if (found) return found;
        }
    }
    return null;
}

// Extracts plain text from blocks across common block types
export const extractTextFromBlocks = (blocks: any[]): string => {
    if (!blocks || blocks.length === 0) return "";

    return blocks.map(block => {
        // Handle different block types
        if (block.type === "paragraph") {
            // For paragraph blocks, extract text content
            return block.content ? block.content.map((item: any) =>
                typeof item === 'string' ? item : (item.text || "")
            ).join("") : "";
        } else if (block.type === "heading") {
            // For heading blocks, extract text content
            return block.content ? block.content.map((item: any) =>
                typeof item === 'string' ? item : (item.text || "")
            ).join("") : "";
        } else if (block.type === "bulletListItem" || block.type === "numberedListItem" || block.type === "checkListItem") {
            // For list items, extract text content
            return block.content ? block.content.map((item: any) =>
                typeof item === 'string' ? item : (item.text || "")
            ).join("") : "";
        } else if (block.type === "codeBlock") {
            // For code blocks, extract text content from content array
            return block.content ? block.content.map((item: any) =>
                typeof item === 'string' ? item : (item.text || "")
            ).join("") : "";
        } else if (block.text) {
            // Fallback for blocks with direct text property
            return block.text;
        }
        return "";
    }).join("\n").trim();
};

// Determines if blocks have meaningful content: Notion blocks with inner content, non-empty text, or media blocks
export const hasBlocksContent = (blocks: any[]): boolean => {
    if (!blocks || blocks.length === 0) {
        return false;
    }

    // Check for integration blocks (Notion)
    const integrationBlock = blocks.find(block => block.type === 'notion');
    // If there's an integration block, it's considered valid content
    if (integrationBlock && integrationBlock.content.length > 0) {
        return true;
    }

    // Check for text content
    const textContent = extractTextFromBlocks(blocks);
    if (textContent.trim().length > 0) {
        return true;
    }

    // Any media blocks
    const hasMediaBlocks = blocks.some(block =>
        block.type === 'image' ||
        block.type === 'audio' ||
        block.type === 'video'
    );
    if (hasMediaBlocks) return true;

    // MCQ block with at least one non-empty option counts as content
    const mcqData = extractMCQFromBlocks(blocks);
    if (mcqData && mcqData.options.some(o => o.text?.trim())) {
        return true;
    }

    return false;
};


