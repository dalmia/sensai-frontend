import {
    parseCsv,
    parseImportCsv,
    buildTemplateCsv,
    groupSkipped,
    TEMPLATE_HEADERS,
} from "@/lib/utils/csvImport";
import { markdownToBlocks } from "@/lib/utils/markdownToBlocks";

const MODULES = [
    { id: "42", title: "New Module" },
    { id: "43", title: "Week 2" },
];

const SCORECARDS = [
    { id: 7, title: "Comms Rubric" },
    { id: 8, title: "Code Quality" },
];

const csv = (...lines: string[]) => lines.join("\n");
const header = TEMPLATE_HEADERS.join(",");

describe("parseCsv", () => {
    it.each(['a,"unclosed\nb,c', 'a,"closed"junk', 'a,b"c'])('rejects malformed quoting: %s', (value) => {
        expect(() => parseCsv(value)).toThrow(/Invalid CSV/);
    });

    it("supports bare CR row separators and a quoted empty final field", () => {
        expect(parseCsv('a,b\rc,""')).toEqual([["a", "b"], ["c", ""]]);
    });
    it("handles quoted commas, escaped quotes and embedded newlines", () => {
        const rows = parseCsv('a,"b,c","say ""hi""","line1\nline2"');
        expect(rows).toEqual([["a", "b,c", 'say "hi"', "line1\nline2"]]);
    });

    it("strips a BOM and tolerates CRLF", () => {
        expect(parseCsv("﻿a,b\r\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
    });

    it("drops blank lines including a trailing newline", () => {
        expect(parseCsv("a,b\n\n\nc,d\n")).toEqual([["a", "b"], ["c", "d"]]);
    });

    it("returns nothing for an empty file", () => {
        expect(parseCsv("")).toEqual([]);
    });
});

describe("parseImportCsv", () => {
    it("maps a learning material row", () => {
        const result = parseImportCsv(
            csv(header, "New Module,learning_material,Intro,Some body text,,,,,,,"),
            MODULES
        );

        expect(result.skipped).toEqual([]);
        expect(result.items).toEqual([
            {
                milestone_id: 42,
                type: "learning_material",
                title: "Intro",
                blocks: markdownToBlocks("Some body text"),
                questions: [],
            },
        ]);
    });

    it("applies defaults to a sparse quiz row", () => {
        const result = parseImportCsv(
            csv(header, "New Module,quiz,Check,,What is REST?,,,,,,"),
            MODULES
        );

        expect(result.items[0].questions[0]).toMatchObject({
            title: "What is REST?",
            type: "objective",
            input_type: "text",
            response_type: "chat",
            answer: null,
        });
    });

    it("uses a plain text question title but keeps markup in the blocks", () => {
        const result = parseImportCsv(
            csv(header, "New Module,quiz,T,,What does **REST** stand for?"),
            MODULES
        );
        const question = result.items[0].questions[0];

        expect(question.title).toBe("What does REST stand for?");
        expect(question.blocks[0].content).toEqual([
            { type: "text", text: "What does ", styles: {} },
            { type: "text", text: "REST", styles: { bold: true } },
            { type: "text", text: " stand for?", styles: {} },
        ]);
    });

    it("groups consecutive quiz rows with the same module and title", () => {
        const result = parseImportCsv(
            csv(
                header,
                "New Module,quiz,Check,,Q1,,,,,,",
                "New Module,quiz,Check,,Q2,,,,,,",
                "New Module,quiz,Other,,Q3,,,,,,"
            ),
            MODULES
        );

        expect(result.items).toHaveLength(2);
        expect(result.items[0].questions.map((q) => q.title)).toEqual(["Q1", "Q2"]);
        expect(result.items[1].questions.map((q) => q.title)).toEqual(["Q3"]);
    });

    it("does not group the same title across different modules", () => {
        const result = parseImportCsv(
            csv(header, "New Module,quiz,Check,,Q1,,,,,,", "Week 2,quiz,Check,,Q2,,,,,,"),
            MODULES
        );

        expect(result.items).toHaveLength(2);
        expect(result.items.map((i) => i.milestone_id)).toEqual([42, 43]);
    });

    it("keeps one quiz together across a skipped row", () => {
        const result = parseImportCsv(
            csv(
                header,
                "New Module,quiz,Check,,Q1,,,,,,",
                "Nope,quiz,Check,,Q2,,,,,,",
                "New Module,quiz,Check,,Q3,,,,,,"
            ),
            MODULES
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0].questions.map((q) => q.title)).toEqual(["Q1", "Q3"]);
        expect(result.skipped).toHaveLength(1);
    });

    it("accepts type aliases and is case insensitive on module names", () => {
        const result = parseImportCsv(
            csv(header, "new module,Question,Check,,Q1,,,,,,", "NEW MODULE,Material,Intro,Body,,,,,,,"),
            MODULES
        );

        expect(result.items.map((i) => i.type)).toEqual(["quiz", "learning_material"]);
    });

    it("keeps valid rows and reports the invalid ones with line numbers", () => {
        const result = parseImportCsv(
            csv(
                header,
                "New Module,learning_material,Good,Body,,,,,,,",
                "Missing Module,quiz,Bad module,,Q,,,,,,",
                "New Module,sometype,Bad type,,,,,,,,",
                "New Module,quiz,,,Q,,,,,,",
                "New Module,quiz,Bad input,,Q,objective,video"
            ),
            MODULES
        );

        expect(result.items).toHaveLength(1);
        expect(result.skipped).toEqual([
            { line: 3, reason: 'Module "Missing Module" does not exist in this course' },
            { line: 4, reason: 'Type "sometype" is not learning material or quiz' },
            { line: 5, reason: "Title is empty" },
            { line: 6, reason: 'Input type "video" is not text, code or audio' },
        ]);
    });

    it("does not send attempts or feedback - the server derives them", () => {
        const question = parseImportCsv(
            csv(header, "New Module,quiz,A,,Q,objective,text,exam"), MODULES
        ).items[0].questions[0] as unknown as Record<string, unknown>;

        expect("max_attempts" in question).toBe(false);
        expect("is_feedback_shown" in question).toBe(false);
    });

    it("links a question to an existing scorecard by title", () => {
        const result = parseImportCsv(
            csv(header, "New Module,quiz,T,,Q,subjective,text,chat,,,Comms Rubric"),
            MODULES,
            SCORECARDS
        );

        expect(result.skipped).toEqual([]);
        expect(result.items[0].questions[0].scorecard_id).toBe(7);
    });

    it("matches the scorecard title case-insensitively and trimmed", () => {
        const result = parseImportCsv(
            csv(header, "New Module,quiz,T,,Q,subjective,text,chat,,,  comms RUBRIC  "),
            MODULES,
            SCORECARDS
        );
        expect(result.items[0].questions[0].scorecard_id).toBe(7);
    });

    it("leaves scorecard_id null when the column is empty", () => {
        const result = parseImportCsv(csv(header, "New Module,quiz,T,,Q"), MODULES, SCORECARDS);
        expect(result.items[0].questions[0].scorecard_id).toBeNull();
    });

    it("skips a row naming a scorecard that does not exist", () => {
        const result = parseImportCsv(
            csv(header, "New Module,quiz,T,,Q,,,,,,No Such Rubric"),
            MODULES,
            SCORECARDS
        );

        expect(result.items).toEqual([]);
        expect(result.skipped).toEqual([
            { line: 2, reason: 'Scorecard "No Such Rubric" does not exist in this school' },
        ]);
    });

    it("refuses to guess between same-named scorecards", () => {
        const result = parseImportCsv(
            csv(header, "New Module,quiz,T,,Q,,,,,,Duplicate"),
            MODULES,
            [
                { id: 1, title: "Duplicate" },
                { id: 2, title: "Duplicate" },
            ]
        );

        expect(result.items).toEqual([]);
        expect(result.skipped[0].reason).toBe('More than one scorecard is named "Duplicate"');
    });

    it("does not look for scorecards on a learning material row", () => {
        const result = parseImportCsv(
            csv(header, "New Module,learning_material,Intro,Body,,,,,,,No Such Rubric"),
            MODULES,
            SCORECARDS
        );
        expect(result.skipped).toEqual([]);
        expect(result.items).toHaveLength(1);
    });

    it("rejects an ambiguous module name rather than guessing", () => {
        const result = parseImportCsv(csv(header, "Dup,quiz,Check,,Q,,,,,,"), [
            { id: "1", title: "Dup" },
            { id: "2", title: "Dup" },
        ]);

        expect(result.items).toEqual([]);
        expect(result.skipped[0].reason).toBe('More than one module is named "Dup"');
    });

    it("throws when required columns are missing", () => {
        expect(() => parseImportCsv("title,content\nx,y", MODULES)).toThrow(/module, type/);
    });

    it("returns nothing for an empty file", () => {
        expect(parseImportCsv("", MODULES)).toEqual({ items: [], skipped: [] });
    });

    it("skips a quiz row with no question rather than importing an empty quiz", () => {
        const result = parseImportCsv(
            csv(header, "New Module,quiz,Empty,the question went in the wrong column,,,,,,"),
            MODULES
        );

        expect(result.items).toEqual([]);
        expect(result.skipped).toEqual([{ line: 2, reason: "Question is empty" }]);
    });

    it("reads columns by header name, not position", () => {
        const result = parseImportCsv(csv("title,type,module", "Intro,learning_material,New Module"), MODULES);
        expect(result.items[0]).toMatchObject({ title: "Intro", milestone_id: 42 });
    });
});

describe("buildTemplateCsv", () => {
    it("starts with the documented headers and round-trips through the parser", () => {
        const template = buildTemplateCsv(MODULES);
        expect(parseCsv(template)[0]).toEqual(TEMPLATE_HEADERS);

        const result = parseImportCsv(template, MODULES);
        expect(result.skipped).toEqual([]);
        expect(result.items.map((i) => i.title)).toEqual([
            "Read me first",
            "Markdown you can use",
            "Sample quiz",
            "An open ended question",
            "A coding question",
            "A spoken question",
        ]);
        // the two Sample quiz rows demonstrate grouping
        expect(result.items[2].questions).toHaveLength(2);
        expect(result.items[4].questions[0].coding_languages).toEqual(["python", "javascript"]);
        expect(result.items[5].questions[0].input_type).toBe("audio");
    });


    it("the guide rows render as real markdown, not flat text", () => {
        const result = parseImportCsv(buildTemplateCsv(MODULES), MODULES);
        const guide = result.items[1].blocks;
        const kinds = new Set(guide.map((b: any) => b.type));

        expect(kinds).toContain("heading");
        expect(kinds).toContain("bulletListItem");
        expect(kinds).toContain("numberedListItem");
        expect(kinds).toContain("checkListItem");
        expect(kinds).toContain("codeBlock");
        expect(kinds).toContain("quote");
        expect(kinds).toContain("paragraph");

        expect(kinds).toContain("table");
        expect(guide.some((b: any) => b.props.level === 1)).toBe(true);
        expect(guide.some((b: any) => b.children?.length > 0)).toBe(true);
    });

    it("is rectangular, so a spreadsheet shows no phantom columns", () => {
        parseCsv(buildTemplateCsv(MODULES)).forEach((row) =>
            expect(row).toHaveLength(TEMPLATE_HEADERS.length)
        );
    });

    it("falls back to a placeholder module when the course has none", () => {
        expect(buildTemplateCsv([])).toContain("Module 1");
    });
});

describe("groupSkipped", () => {
    it("collapses identical reasons, most frequent first", () => {
        expect(
            groupSkipped([
                { line: 9, reason: "Title is empty" },
                { line: 3, reason: "Module is empty" },
                { line: 5, reason: "Module is empty" },
                { line: 4, reason: "Module is empty" },
            ])
        ).toEqual([
            { reason: "Module is empty", lines: [3, 5, 4] },
            { reason: "Title is empty", lines: [9] },
        ]);
    });

    it("breaks ties by first row so the order is stable", () => {
        expect(
            groupSkipped([
                { line: 8, reason: "B" },
                { line: 2, reason: "A" },
            ]).map((g) => g.reason)
        ).toEqual(["A", "B"]);
    });

    it("returns nothing for nothing", () => {
        expect(groupSkipped([])).toEqual([]);
    });
});
