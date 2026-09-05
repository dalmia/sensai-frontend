import { dropUnknownBlocks } from '@/components/BlockNoteEditor';

// Mirrors the shape of BlockNote's defaultBlockSpecs after SensAI removes
// `table` and `file` (and media when allowMedia is false).
const enabledBlocks = {
    paragraph: {},
    heading: {},
    bulletListItem: {},
    numberedListItem: {},
    checkListItem: {},
    codeBlock: {},
    quote: {},
    image: {},
    video: {},
    audio: {},
};

const noMediaBlocks = {
    paragraph: {},
    heading: {},
    bulletListItem: {},
};

describe('dropUnknownBlocks', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
        warn = jest.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        warn.mockRestore();
    });

    it('keeps every block when all types are in the schema', () => {
        const blocks = [
            { type: 'paragraph', content: [] },
            { type: 'heading', content: [] },
            { type: 'codeBlock', content: [] },
        ];
        expect(dropUnknownBlocks(blocks, enabledBlocks)).toEqual(blocks);
        expect(warn).not.toHaveBeenCalled();
    });

    // The reason this function exists: a leftover notion block used to crash
    // BlockNote at construction, taking the whole page down.
    it('drops a leftover notion block rather than passing it to the editor', () => {
        const blocks = [
            { type: 'paragraph', content: [] },
            { type: 'notion', content: [{ id: '1' }], props: { integration_id: 155 } },
            { type: 'heading', content: [] },
        ];

        const result = dropUnknownBlocks(blocks, enabledBlocks);

        expect(result).toHaveLength(2);
        expect(result.map((b) => b.type)).toEqual(['paragraph', 'heading']);
        expect(warn).toHaveBeenCalled();
    });

    it('drops table blocks, which SensAI removes from the schema', () => {
        const blocks = [
            { type: 'paragraph', content: [] },
            { type: 'table', content: { type: 'tableContent', rows: [] } },
        ];
        expect(dropUnknownBlocks(blocks, enabledBlocks).map((b) => b.type)).toEqual([
            'paragraph',
        ]);
    });

    it('drops media blocks when the schema has media disabled', () => {
        const blocks = [
            { type: 'paragraph', content: [] },
            { type: 'image', props: { url: 'https://example.com/a.png' } },
            { type: 'video', props: { url: 'https://example.com/a.mp4' } },
        ];
        expect(dropUnknownBlocks(blocks, noMediaBlocks).map((b) => b.type)).toEqual([
            'paragraph',
        ]);
    });

    it('drops malformed blocks with no type', () => {
        const blocks = [{ type: 'paragraph', content: [] }, {}, null, undefined];
        expect(dropUnknownBlocks(blocks as any[], enabledBlocks)).toEqual([
            { type: 'paragraph', content: [] },
        ]);
    });

    it('handles empty and non-array input', () => {
        expect(dropUnknownBlocks([], enabledBlocks)).toEqual([]);
        expect(dropUnknownBlocks(undefined as any, enabledBlocks)).toEqual([]);
        expect(dropUnknownBlocks(null as any, enabledBlocks)).toEqual([]);
    });
});
