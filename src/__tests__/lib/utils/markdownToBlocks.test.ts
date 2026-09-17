import { markdownToBlocks, parseInline } from "@/lib/utils/markdownToBlocks";

const TEXT_PROPS = { textColor: "default", backgroundColor: "default", textAlignment: "left" };
const text = (t: string, styles = {}) => ({ type: "text", text: t, styles });
const types = (md: string) => markdownToBlocks(md).map((b) => b.type);
const plain = (b: any): string =>
    (b.content ?? []).map((n: any) => (n.type === "link" ? plain(n) : n.text)).join("");

describe("headings", () => {
    it("maps # ## ### to levels 1 2 3 like a .md file", () => {
        const blocks = markdownToBlocks("# One\n\n## Two\n\n### Three");
        expect(blocks.map((b) => [b.type, b.props.level])).toEqual([
            ["heading", 1],
            ["heading", 2],
            ["heading", 3],
        ]);
    });

    it("clamps #### and deeper to 3, the deepest level the schema has", () => {
        expect(markdownToBlocks("#### Four\n\n###### Six").map((b) => b.props.level)).toEqual([3, 3]);
    });

    it("needs a space, so a bare # is a paragraph", () => {
        expect(types("#NotAHeading")).toEqual(["paragraph"]);
    });
});

describe("paragraphs", () => {
    it("joins consecutive lines and splits on a blank line", () => {
        const blocks = markdownToBlocks("Line one.\nLine two.\n\nA new paragraph.");
        expect(blocks).toHaveLength(2);
        expect(plain(blocks[0])).toBe("Line one. Line two.");
        expect(plain(blocks[1])).toBe("A new paragraph.");
    });

    it("carries the schema-safe props", () => {
        expect(markdownToBlocks("hi")[0]).toEqual({
            type: "paragraph",
            props: TEXT_PROPS,
            content: [text("hi")],
            children: [],
        });
    });

    it("returns nothing for blank input", () => {
        expect(markdownToBlocks("")).toEqual([]);
        expect(markdownToBlocks("   \n  \n")).toEqual([]);
    });
});

describe("lists", () => {
    it("handles bullets, numbers and checkboxes", () => {
        const blocks = markdownToBlocks("- a\n\n1. b\n\n- [x] done\n\n- [ ] todo");
        expect(blocks.map((b) => b.type)).toEqual([
            "bulletListItem",
            "numberedListItem",
            "checkListItem",
            "checkListItem",
        ]);
        expect(blocks[2].props.checked).toBe(true);
        expect(blocks[3].props.checked).toBe(false);
    });

    it("accepts *, + and 1) as list markers", () => {
        expect(types("* a\n+ b\n1) c")).toEqual([
            "bulletListItem",
            "bulletListItem",
            "numberedListItem",
        ]);
    });

    it("nests indented items as children", () => {
        const blocks = markdownToBlocks("- top\n  - nested\n    - deeper\n- second");
        expect(blocks).toHaveLength(2);
        expect(plain(blocks[0])).toBe("top");
        expect(plain(blocks[0].children[0])).toBe("nested");
        expect(plain(blocks[0].children[0].children[0])).toBe("deeper");
        expect(plain(blocks[1])).toBe("second");
    });
});

describe("code blocks", () => {
    it("keeps the fence language and the raw body", () => {
        const blocks = markdownToBlocks("```python\nx = 1\n\ny = 2\n```");
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe("codeBlock");
        expect(blocks[0].props.language).toBe("python");
        expect(plain(blocks[0])).toBe("x = 1\n\ny = 2");
    });

    it("defaults the language and does not parse markdown inside", () => {
        const blocks = markdownToBlocks("```\n# not a heading\n**not bold**\n```");
        expect(blocks[0].props.language).toBe("text");
        expect(plain(blocks[0])).toBe("# not a heading\n**not bold**");
    });

    it("supports ~~~ fences", () => {
        expect(types("~~~js\ncode\n~~~")).toEqual(["codeBlock"]);
    });
});

describe("quotes, rules and tables", () => {
    it("maps > to a quote with its own prop set", () => {
        const blocks = markdownToBlocks("> quoted");
        expect(blocks[0].type).toBe("quote");
        expect(blocks[0].props).toEqual({ backgroundColor: "default", textColor: "default" });
    });

    it("drops horizontal rules, which the schema has no block for", () => {
        expect(types("a\n\n---\n\nb")).toEqual(["paragraph", "paragraph"]);
    });

    it("builds a real table block with a header row", () => {
        const blocks = markdownToBlocks("| A | B |\n| --- | --- |\n| 1 | 2 |");
        expect(blocks).toHaveLength(1);

        const table: any = blocks[0];
        expect(table.type).toBe("table");
        expect(table.props).toEqual({ textColor: "default" });
        expect(table.children).toEqual([]);
        expect(table.content.type).toBe("tableContent");
        expect(table.content.headerRows).toBe(1);
        expect(table.content.columnWidths).toEqual([undefined, undefined]);
        expect(table.content.rows).toHaveLength(2);
        expect(table.content.rows[0].cells[0]).toEqual({
            type: "tableCell",
            props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
            content: [text("A")],
        });
        expect(table.content.rows[1].cells.map((c: any) => c.content[0].text)).toEqual(["1", "2"]);
    });

    it("omits headerRows when there is no divider", () => {
        const table: any = markdownToBlocks("| a | b |\n| c | d |")[0];
        expect(table.content.headerRows).toBeUndefined();
        expect(table.content.rows).toHaveLength(2);
    });

    it("pads short rows so every row has the same number of cells", () => {
        const table: any = markdownToBlocks("| a | b | c |\n| --- | --- | --- |\n| 1 |")[0];
        expect(table.content.rows[1].cells).toHaveLength(3);
        expect(table.content.rows[1].cells[2].content).toEqual([]);
    });

    it("keeps inline markup inside a cell", () => {
        const table: any = markdownToBlocks("| **bold** | `code` |")[0];
        expect(table.content.rows[0].cells[0].content).toEqual([text("bold", { bold: true })]);
        expect(table.content.rows[0].cells[1].content).toEqual([text("code", { code: true })]);
    });

    it("ends the table at the first line that is not a row", () => {
        const blocks = markdownToBlocks("| a |\n| --- |\n| b |\n\nAfter the table.");
        expect(blocks.map((b) => b.type)).toEqual(["table", "paragraph"]);
        expect(plain(blocks[1])).toBe("After the table.");
    });

    it("handles two tables separated by text", () => {
        const blocks = markdownToBlocks("| a |\n\nmiddle\n\n| b |");
        expect(blocks.map((b) => b.type)).toEqual(["table", "paragraph", "table"]);
    });

    it("never emits a block type outside the app schema", () => {
        const allowed = new Set([
            "paragraph",
            "heading",
            "bulletListItem",
            "numberedListItem",
            "checkListItem",
            "codeBlock",
            "quote",
            "table",
        ]);
        const everything =
            "# H1\n## H2\n### H3\n#### H4\n\npara\n\n- a\n1. b\n- [x] c\n\n> q\n\n---\n\n| a | b |\n| - | - |\n\n```js\ncode\n```\n\n![img](http://x/y.png)";
        markdownToBlocks(everything).forEach((b) => expect(allowed.has(b.type)).toBe(true));
    });
});

describe("inline formatting", () => {
    it("handles bold, italic, strike and code", () => {
        expect(parseInline("a **b** _c_ ~~d~~ `e`")).toEqual([
            text("a "),
            text("b", { bold: true }),
            text(" "),
            text("c", { italic: true }),
            text(" "),
            text("d", { strike: true }),
            text(" "),
            text("e", { code: true }),
        ]);
    });

    it("combines nested styles", () => {
        expect(parseInline("**_both_**")).toEqual([text("both", { italic: true, bold: true })]);
    });

    it("builds link nodes and falls back to the url as the label", () => {
        expect(parseInline("see [docs](https://x.dev)")).toEqual([
            text("see "),
            { type: "link", href: "https://x.dev", content: [text("docs")] },
        ]);
        expect(parseInline("[](https://x.dev)")).toEqual([
            { type: "link", href: "https://x.dev", content: [text("https://x.dev")] },
        ]);
    });

    it("turns an image into a link, since media must live in our own S3", () => {
        expect(parseInline("![alt](https://x.dev/i.png)")).toEqual([
            { type: "link", href: "https://x.dev/i.png", content: [text("alt")] },
        ]);
    });

    it("does not treat markdown inside a code span as markup", () => {
        expect(parseInline("`**raw**`")).toEqual([text("**raw**", { code: true })]);
    });

    it("leaves unmatched markers as plain text", () => {
        expect(parseInline("2 * 3 * 4 is not italic").every((n) => !n.styles?.italic)).toBe(false);
        expect(parseInline("a ** b")).toEqual([text("a ** b")]);
    });

    it("styles link text when the link sits inside bold", () => {
        expect(parseInline("**[x](http://y)**")).toEqual([
            { type: "link", href: "http://y", content: [text("x", { bold: true })] },
        ]);
    });
});

describe("a realistic pasted document", () => {
    const doc = `# What is HyperVerge Academy (HVA)?

Welcome to HyperVerge Academy (HVA).

## Program Structure

The HVA program runs for **1 year**.

### First 6 Months: Learning & Mentorship

You will also learn:

- Programming
- English Communication
- Soft Skills

\`\`\`js
const hva = true;
\`\`\`

> Learning content will be available on SensAI.`;

    it("produces the same structure as the rendered page", () => {
        expect(markdownToBlocks(doc).map((b) => `${b.type}${b.props.level ?? ""}`)).toEqual([
            "heading1",
            "paragraph",
            "heading2",
            "paragraph",
            "heading3",
            "paragraph",
            "bulletListItem",
            "bulletListItem",
            "bulletListItem",
            "codeBlock",
            "quote",
        ]);
    });

    it("keeps inline bold inside a paragraph", () => {
        const para = markdownToBlocks(doc).find((b) => plain(b).startsWith("The HVA program"))!;
        expect(para.content).toEqual([
            text("The HVA program runs for "),
            text("1 year", { bold: true }),
            text("."),
        ]);
    });
});
