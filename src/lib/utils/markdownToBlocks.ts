/**
 * Markdown -> BlockNote blocks, for content pasted in from a document or an LLM.
 *
 * Standard Markdown rules: `#` is H1, `##` is H2, `###` is H3, a blank line starts
 * a new paragraph and a single newline is just a space inside one.
 *
 * Only emits block types this app's schema actually keeps. `BlockNoteEditor.tsx`
 * drops `file` (and all media when allowMedia is false) from defaultBlockSpecs,
 * and BlockNote throws at construction on a type it does not know, which
 * white-screens the page. Horizontal rules have no block, so they are dropped.
 */

const TEXT_PROPS = { textColor: "default", backgroundColor: "default", textAlignment: "left" };

const PROPS: Record<string, Record<string, unknown>> = {
    paragraph: TEXT_PROPS,
    heading: { ...TEXT_PROPS, level: 1 },
    bulletListItem: TEXT_PROPS,
    numberedListItem: TEXT_PROPS,
    checkListItem: { ...TEXT_PROPS, checked: false },
    quote: { backgroundColor: "default", textColor: "default" },
    codeBlock: { language: "text" },
};

// BlockNote's default heading spec only has levels 1-3.
const MAX_HEADING_LEVEL = 3;

export interface InlineNode {
    type: "text" | "link";
    text?: string;
    styles?: Record<string, boolean>;
    href?: string;
    content?: InlineNode[];
}

export interface TableCell {
    type: "tableCell";
    props: { backgroundColor: string; textColor: string; textAlignment: string };
    content: InlineNode[];
}

export interface TableContent {
    type: "tableContent";
    columnWidths: (number | undefined)[];
    headerRows?: number;
    rows: { cells: TableCell[] }[];
}

export interface MdBlock {
    type: string;
    props: Record<string, unknown>;
    content: InlineNode[] | TableContent;
    children: MdBlock[];
}

const CELL_PROPS = { backgroundColor: "default", textColor: "default", textAlignment: "left" };

const splitRow = (row: string): string[] =>
    row
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim());

const makeTable = (rows: string[][], hasHeader: boolean): MdBlock => {
    const width = Math.max(...rows.map((row) => row.length));

    return {
        type: "table",
        props: { textColor: "default" },
        content: {
            type: "tableContent",
            columnWidths: new Array(width).fill(undefined),
            ...(hasHeader ? { headerRows: 1 } : {}),
            rows: rows.map((cells) => ({
                cells: Array.from({ length: width }, (_, column) => ({
                    type: "tableCell" as const,
                    props: { ...CELL_PROPS },
                    content: parseInline(cells[column] ?? ""),
                })),
            })),
        },
        children: [],
    };
};

const makeBlock = (
    type: string,
    content: InlineNode[],
    props: Record<string, unknown> = {}
): MdBlock => ({
    type,
    props: { ...(PROPS[type] ?? TEXT_PROPS), ...props },
    content,
    children: [],
});

const withStyle = (nodes: InlineNode[], style: string): InlineNode[] =>
    nodes.map((node) =>
        node.type === "link"
            ? { ...node, content: withStyle(node.content ?? [], style) }
            : { ...node, styles: { ...node.styles, [style]: true } }
    );

const STYLE_RULES: { pattern: RegExp; style: string }[] = [
    { pattern: /^\*\*([\s\S]+?)\*\*/, style: "bold" },
    { pattern: /^__([\s\S]+?)__/, style: "bold" },
    { pattern: /^~~([\s\S]+?)~~/, style: "strike" },
    { pattern: /^\*([\s\S]+?)\*/, style: "italic" },
    { pattern: /^_([\s\S]+?)_/, style: "italic" },
];

const CODE_SPAN = /^`([^`]+)`/;
const LINK = /^!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;

export const parseInline = (text: string): InlineNode[] => {
    const nodes: InlineNode[] = [];
    let plain = "";
    let rest = text;

    const flush = () => {
        if (plain) {
            nodes.push({ type: "text", text: plain, styles: {} });
            plain = "";
        }
    };

    while (rest.length > 0) {
        const code = CODE_SPAN.exec(rest);
        if (code) {
            flush();
            nodes.push({ type: "text", text: code[1], styles: { code: true } });
            rest = rest.slice(code[0].length);
            continue;
        }

        const link = LINK.exec(rest);
        if (link) {
            flush();
            const label = link[1] || link[2];
            nodes.push({
                type: "link",
                href: link[2],
                content: [{ type: "text", text: label, styles: {} }],
            });
            rest = rest.slice(link[0].length);
            continue;
        }

        const rule = STYLE_RULES.find((candidate) => candidate.pattern.test(rest));
        if (rule) {
            const match = rule.pattern.exec(rest)!;
            const inner = parseInline(match[1]);
            if (inner.length > 0) {
                flush();
                nodes.push(...withStyle(inner, rule.style));
                rest = rest.slice(match[0].length);
                continue;
            }
        }

        plain += rest[0];
        rest = rest.slice(1);
    }

    flush();
    return nodes;
};

/** Flattens inline nodes back to plain text, for labels that cannot show markup. */
export const inlineText = (nodes: InlineNode[]): string =>
    nodes.map((node) => (node.type === "link" ? inlineText(node.content ?? []) : node.text ?? "")).join("");

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^(?:```|~~~)\s*(\S*)\s*$/;
const QUOTE = /^>\s?(.*)$/;
const CHECK_ITEM = /^[-*+]\s+\[([ xX])\]\s*(.*)$/;
const BULLET_ITEM = /^[-*+]\s+(.*)$/;
const NUMBERED_ITEM = /^\d+[.)]\s+(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const TABLE_ROW = /^\|(.*)\|$/;
const TABLE_DIVIDER = /^\|[\s:|-]+\|$/;

const indentWidth = (line: string): number => {
    const leading = /^[ \t]*/.exec(line)![0];
    return leading.replace(/\t/g, "    ").length;
};

export const markdownToBlocks = (markdown: string): MdBlock[] => {
    if (!markdown?.trim()) return [];

    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const blocks: MdBlock[] = [];
    let paragraph: string[] = [];
    // Open list items by indent, so nested bullets become children.
    let stack: { indent: number; block: MdBlock }[] = [];

    const flushParagraph = () => {
        if (paragraph.length > 0) {
            blocks.push(makeBlock("paragraph", parseInline(paragraph.join(" "))));
            paragraph = [];
        }
    };

    const closeLists = () => {
        stack = [];
    };

    const pushListItem = (block: MdBlock, indent: number) => {
        flushParagraph();
        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();

        if (stack.length > 0) stack[stack.length - 1].block.children.push(block);
        else blocks.push(block);

        stack.push({ indent, block });
    };

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const trimmed = line.trim();

        const fence = FENCE.exec(trimmed);
        if (fence) {
            flushParagraph();
            closeLists();
            const code: string[] = [];
            index++;
            while (index < lines.length && !FENCE.test(lines[index].trim())) {
                code.push(lines[index]);
                index++;
            }
            blocks.push(
                makeBlock("codeBlock", code.join("\n") ? [{ type: "text", text: code.join("\n"), styles: {} }] : [], {
                    language: fence[1].toLowerCase() || "text",
                })
            );
            continue;
        }

        if (!trimmed) {
            flushParagraph();
            closeLists();
            continue;
        }

        if (RULE.test(trimmed)) {
            flushParagraph();
            closeLists();
            continue;
        }

        const heading = HEADING.exec(trimmed);
        if (heading) {
            flushParagraph();
            closeLists();
            blocks.push(
                makeBlock("heading", parseInline(heading[2]), {
                    level: Math.min(heading[1].length, MAX_HEADING_LEVEL),
                })
            );
            continue;
        }

        const quote = QUOTE.exec(trimmed);
        if (quote) {
            flushParagraph();
            closeLists();
            blocks.push(makeBlock("quote", parseInline(quote[1])));
            continue;
        }

        if (TABLE_ROW.test(trimmed) && !TABLE_DIVIDER.test(trimmed)) {
            flushParagraph();
            closeLists();

            const rows: string[][] = [];
            let hasHeader = false;

            while (index < lines.length) {
                const candidate = lines[index].trim();
                if (!TABLE_ROW.test(candidate)) break;

                if (TABLE_DIVIDER.test(candidate)) {
                    // A divider on the second line marks the row above as the header.
                    hasHeader = rows.length === 1;
                } else {
                    rows.push(splitRow(candidate));
                }
                index++;
            }
            index--;

            blocks.push(makeTable(rows, hasHeader));
            continue;
        }

        const check = CHECK_ITEM.exec(trimmed);
        if (check) {
            pushListItem(
                makeBlock("checkListItem", parseInline(check[2]), {
                    checked: check[1].toLowerCase() === "x",
                }),
                indentWidth(line)
            );
            continue;
        }

        const numbered = NUMBERED_ITEM.exec(trimmed);
        if (numbered) {
            pushListItem(makeBlock("numberedListItem", parseInline(numbered[1])), indentWidth(line));
            continue;
        }

        const bullet = BULLET_ITEM.exec(trimmed);
        if (bullet) {
            pushListItem(makeBlock("bulletListItem", parseInline(bullet[1])), indentWidth(line));
            continue;
        }

        closeLists();
        paragraph.push(trimmed);
    }

    flushParagraph();
    return blocks;
};
