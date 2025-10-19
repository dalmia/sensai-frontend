import { extractTextFromBlocks, hasBlocksContent } from "../../../lib/utils/blockUtils";

describe("blockUtils", () => {
    describe("extractTextFromBlocks", () => {
        it("returns empty string for empty or undefined blocks", () => {
            // @ts-expect-error testing undefined input
            expect(extractTextFromBlocks(undefined)).toBe("");
            expect(extractTextFromBlocks([])).toBe("");
        });

        it("extracts text from various supported block types", () => {
            const blocks = [
                { type: "paragraph", content: [{ text: "Para" }] },
                { type: "heading", content: ["Heading"] },
                { type: "bulletListItem", content: [{ text: "Item1" }, { text: "Item2" }] },
                { type: "codeBlock", content: ["console.log(1)"] },
                { text: "Fallback text" }
            ];
            const result = extractTextFromBlocks(blocks);
            expect(result).toBe(["Para", "Heading", "Item1Item2", "console.log(1)", "Fallback text"].join("\n"));
        });
    });

    describe("hasBlocksContent", () => {
        it("returns false for empty or undefined blocks", () => {
            // @ts-expect-error testing undefined input
            expect(hasBlocksContent(undefined)).toBe(false);
            expect(hasBlocksContent([])).toBe(false);
        });

        it("returns true when integration block has inner content (integration path)", () => {
            const blocks = [
                { type: "notion", content: [{ id: "1" }] }
            ];
            expect(hasBlocksContent(blocks)).toBe(true);
        });

        it("returns true when text content exists (text path)", () => {
            const blocks = [
                { type: "paragraph", content: [{ text: "Hello" }] }
            ];
            expect(hasBlocksContent(blocks)).toBe(true);
        });

        it("returns true when any media block exists (media path true)", () => {
            const blocksImage = [{ type: "image", src: "x" }];
            const blocksAudio = [{ type: "audio", src: "x" }];
            const blocksVideo = [{ type: "video", src: "x" }];
            expect(hasBlocksContent(blocksImage)).toBe(true);
            expect(hasBlocksContent(blocksAudio)).toBe(true);
            expect(hasBlocksContent(blocksVideo)).toBe(true);
        });

        it("returns false when no media and no text (media path false)", () => {
            const blocks = [
                { type: "paragraph", content: [] },
                { type: "heading", content: [] }
            ];
            expect(hasBlocksContent(blocks)).toBe(false);
        });
    });
});


