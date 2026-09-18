import { markdownToBlocks, inlineText } from "./markdownToBlocks";

export interface ImportModule {
    id: string;
    title: string;
}

export interface ImportScorecard {
    id: number;
    title: string;
}

export interface BulkQuestion {
    title: string;
    blocks: any[];
    answer: any[] | null;
    type: "objective" | "subjective";
    input_type: "text" | "code" | "audio";
    response_type: "chat" | "exam";
    coding_languages: string[] | null;
    scorecard_id: number | null;
}

export interface BulkTaskItem {
    milestone_id: number;
    type: "learning_material" | "quiz";
    title: string;
    blocks: any[];
    questions: BulkQuestion[];
}

export interface SkippedRow {
    line: number;
    reason: string;
}

export interface ParsedImport {
    items: BulkTaskItem[];
    skipped: SkippedRow[];
}

export const MAX_IMPORT_TASKS = 500;
export const MAX_IMPORT_QUESTIONS = 2000;

export const TEMPLATE_HEADERS = [
    "module",
    "type",
    "title",
    "content",
    "question",
    "question_type",
    "input_type",
    "response_type",
    "answer",
    "coding_languages",
    "scorecard",
];

const TYPE_ALIASES: Record<string, "learning_material" | "quiz"> = {
    learning_material: "learning_material",
    "learning material": "learning_material",
    material: "learning_material",
    lm: "learning_material",
    quiz: "quiz",
    question: "quiz",
    questions: "quiz",
};

const QUESTION_TYPES = ["objective", "subjective"];
const INPUT_TYPES = ["text", "code", "audio"];
const RESPONSE_TYPES = ["chat", "exam"];
const CODING_LANGUAGES = ["html", "css", "javascript", "nodejs", "python", "react", "sql"];


export const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;
    let closedQuote = false;
    let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

    const endField = () => {
        row.push(field);
        field = "";
        closedQuote = false;
    };
    const endRow = () => {
        endField();
        rows.push(row);
        row = [];
    };

    while (i < text.length) {
        const char = text[i];

        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                quoted = false;
                closedQuote = true;
                i++;
                continue;
            }
            field += char;
            i++;
            continue;
        }

        if (closedQuote && char !== "," && char !== "\n" && char !== "\r") {
            throw new Error("Invalid CSV: unexpected text after a closing quote. Export the file as CSV again.");
        }
        if (char === '"' && field === "" && !closedQuote) {
            quoted = true;
        } else if (char === '"') {
            throw new Error("Invalid CSV: a quote inside a field must be escaped. Export the file as CSV again.");
        } else if (char === ",") {
            endField();
        } else if (char === "\n" || char === "\r") {
            endRow();
            if (char === "\r" && text[i + 1] === "\n") i++;
        } else {
            field += char;
        }
        i++;
    }

    if (quoted) throw new Error("Invalid CSV: a quoted field is missing its closing quote. Export the file as CSV again.");
    if (field !== "" || row.length > 0 || closedQuote) endRow();

    return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
};

const byTitle = <T extends { title: string }>(items: T[]): Map<string, T[]> => {
    const index = new Map<string, T[]>();
    items.forEach((item) => {
        const key = item.title.trim().toLowerCase();
        index.set(key, [...(index.get(key) ?? []), item]);
    });
    return index;
};

const parseLanguages = (value: string): string[] =>
    value
        .split(/[|,]/)
        .map((language) => language.trim().toLowerCase())
        .filter(Boolean);

const buildQuestion = (
    row: Record<string, string>,
    scorecards: Map<string, ImportScorecard[]>
): BulkQuestion => {
    const questionText = row.question?.trim() ?? "";
    const answerText = row.answer?.trim() ?? "";
    const languages = parseLanguages(row.coding_languages ?? "");
    const responseType = (row.response_type?.trim().toLowerCase() || "chat") as BulkQuestion["response_type"];

    const blocks = markdownToBlocks(questionText);
    // A table block's content is not inline content, so it has no title text.
    const first = blocks[0]?.content;
    const titleSource = Array.isArray(first) ? first : [];

    return {
        // The title is a plain label in the editor, so it cannot carry markup.
        title: (inlineText(titleSource) || questionText).slice(0, 255),
        blocks,
        answer: answerText ? markdownToBlocks(answerText) : null,
        type: (row.question_type?.trim().toLowerCase() || "objective") as BulkQuestion["type"],
        input_type: (row.input_type?.trim().toLowerCase() || "text") as BulkQuestion["input_type"],
        response_type: responseType,
        coding_languages: languages.length > 0 ? languages : null,
        scorecard_id: scorecards.get(row.scorecard?.trim().toLowerCase() ?? "")?.[0]?.id ?? null,
    };
};

const rowError = (
    row: Record<string, string>,
    modulesByName: Map<string, ImportModule[]>,
    scorecardsByName: Map<string, ImportScorecard[]>
): string | null => {
    const moduleName = row.module?.trim() ?? "";
    const typeValue = row.type?.trim().toLowerCase() ?? "";
    const title = row.title?.trim() ?? "";

    if (!moduleName) return "Module is empty";

    const matches = modulesByName.get(moduleName.toLowerCase());
    if (!matches) return `Module "${moduleName}" does not exist in this course`;
    if (matches.length > 1) return `More than one module is named "${moduleName}"`;

    if (!typeValue) return "Type is empty";
    if (!TYPE_ALIASES[typeValue]) return `Type "${row.type.trim()}" is not learning material or quiz`;

    if (!title) return "Title is empty";
    if (title.length > 255) return "Title is longer than 255 characters";

    if (TYPE_ALIASES[typeValue] === "quiz") {
        if (!row.question?.trim()) return "Question is empty";

        const scorecardName = row.scorecard?.trim() ?? "";
        if (scorecardName) {
            const found = scorecardsByName.get(scorecardName.toLowerCase());
            if (!found) return `Scorecard "${scorecardName}" does not exist in this school`;
            if (found.length > 1) return `More than one scorecard is named "${scorecardName}"`;
        }

        const questionType = row.question_type?.trim().toLowerCase() ?? "";
        if (questionType && !QUESTION_TYPES.includes(questionType))
            return `Question type "${row.question_type.trim()}" is not objective or subjective`;

        const inputType = row.input_type?.trim().toLowerCase() ?? "";
        if (inputType && !INPUT_TYPES.includes(inputType))
            return `Input type "${row.input_type.trim()}" is not text, code or audio`;

        const responseType = row.response_type?.trim().toLowerCase() ?? "";
        if (responseType && !RESPONSE_TYPES.includes(responseType))
            return `Response type "${row.response_type.trim()}" is not chat or exam`;

        const unknownLanguage = parseLanguages(row.coding_languages ?? "").find(
            (language) => !CODING_LANGUAGES.includes(language)
        );
        if (unknownLanguage) return `Language "${unknownLanguage}" is not one of ${CODING_LANGUAGES.join(", ")}`;

    }

    return null;
};

export const groupSkipped = (
    skipped: SkippedRow[]
): { reason: string; lines: number[] }[] => {
    const byReason = new Map<string, number[]>();

    skipped.forEach(({ reason, line }) => {
        byReason.set(reason, [...(byReason.get(reason) ?? []), line]);
    });

    return [...byReason.entries()]
        .map(([reason, lines]) => ({ reason, lines }))
        .sort((a, b) => b.lines.length - a.lines.length || a.lines[0] - b.lines[0]);
};

export const parseImportCsv = (
    text: string,
    modules: ImportModule[],
    scorecards: ImportScorecard[] = []
): ParsedImport => {
    const rows = parseCsv(text);

    if (rows.length === 0) return { items: [], skipped: [] };

    const headers = rows[0].map((header) => header.trim().toLowerCase());
    const missing = ["module", "type", "title"].filter((header) => !headers.includes(header));

    if (missing.length > 0) {
        throw new Error(
            `The file is missing the ${missing.join(", ")} column${missing.length > 1 ? "s" : ""}. Download the template to see the expected format.`
        );
    }

    const modulesByName = byTitle(modules);
    const scorecardsByName = byTitle(scorecards);

    const items: BulkTaskItem[] = [];
    const skipped: SkippedRow[] = [];
    let previous: { key: string; item: BulkTaskItem } | null = null;

    rows.slice(1).forEach((cells, index) => {
        const line = index + 2;
        const row: Record<string, string> = {};
        headers.forEach((header, column) => {
            row[header] = cells[column] ?? "";
        });

        const title = row.title?.trim() ?? "";
        const reason = rowError(row, modulesByName, scorecardsByName);

        if (reason) {
            skipped.push({ line, reason });
            return;
        }

        const module = modulesByName.get(row.module.trim().toLowerCase())![0];
        const type = TYPE_ALIASES[row.type.trim().toLowerCase()];
        const milestoneId = Number(module.id);
        const key = `${milestoneId}|${type}|${title.toLowerCase()}`;

        // Consecutive quiz rows sharing a module and title are one quiz.
        if (type === "quiz" && previous?.key === key) {
            if (row.question?.trim()) previous.item.questions.push(buildQuestion(row, scorecardsByName));
            return;
        }

        const item: BulkTaskItem = {
            milestone_id: milestoneId,
            type,
            title,
            blocks: type === "learning_material" ? markdownToBlocks(row.content ?? "") : [],
            questions: type === "quiz" && row.question?.trim() ? [buildQuestion(row, scorecardsByName)] : [],
        };

        items.push(item);
        previous = { key, item };
    });

    return { items, skipped };
};

const GUIDE = [
    "# How to use this template",
    "",
    "Replace these example rows with your own. Every task is created as a **draft**, so nothing goes live until you publish it.",
    "",
    "## Columns",
    "",
    "- `module` - must match a module that already exists in this course",
    "- `type` - `learning_material` or `quiz`",
    "- `title` - the name of the task",
    "- `content` - the body of a learning material, written in Markdown",
    "- `question` - the question text, written in Markdown",
    "- `question_type` - `objective` or `subjective`, defaults to `objective`",
    "- `input_type` - `text`, `code` or `audio`, defaults to `text`",
    "- `response_type` - `chat` for practice with feedback, or `exam`, defaults to `chat`. Attempt limits and feedback follow from this, exactly as they do in the editor",
    "- `answer` - the correct answer, also Markdown",
    "- `coding_languages` - only for `code` questions, separated by `|`",
    "- `scorecard` - the title of an existing scorecard in this school (ignores case and surrounding spaces). Exactly one match links it to the question; missing or duplicate names skip that row with a reason. Import never creates scorecards. Leave empty for no scorecard",
    "",
    "## Two rules worth knowing",
    "",
    "1. A quiz with several questions uses **one row per question**, repeating the same `module` and `title` on rows next to each other. The two *Sample quiz* rows below become a single quiz with two questions.",
    "2. Modules are never created by an import. A row naming a module that does not exist is reported back to you and skipped, and the rest still import.",
].join("\n");

const MARKDOWN_GUIDE = [
    "# Heading 1",
    "## Heading 2",
    "### Heading 3",
    "",
    "Leave a blank line between paragraphs.",
    "",
    "Two lines with no blank line",
    "between them become one paragraph, exactly like a .md file.",
    "",
    "Inline you can use **bold**, *italic*, ~~strikethrough~~, `inline code` and [a link](https://example.com).",
    "",
    "Underscores are left alone, so `MAX_RETRY_COUNT` and snake_case survive. Use * for emphasis, not _.",
    "",
    "- A bullet",
    "- Another bullet",
    "  - Indent two spaces to nest",
    "",
    "1. A numbered item",
    "2. Another numbered item",
    "",
    "- [x] A finished task",
    "- [ ] An unfinished task",
    "",
    "> A quote.",
    "",
    "```python",
    "def greet(name):",
    '    return f"Hello, {name}"',
    "```",
    "",
    "| Column | What it does |",
    "| --- | --- |",
    "| Tables | render as real tables |",
    "| Cells | keep **bold** and `code` |",
].join("\n");

export const buildTemplateCsv = (modules: ImportModule[]): string => {
    const example = modules[0]?.title ?? "Module 1";
    const escape = (value: string) =>
        /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

    const rows = [
        TEMPLATE_HEADERS,
        [example, "learning_material", "Read me first", GUIDE, "", "", "", "", "", "", ""],
        [example, "learning_material", "Markdown you can use", MARKDOWN_GUIDE, "", "", "", "", "", "", ""],
        [example, "quiz", "Sample quiz", "", "What does **REST** stand for?", "objective", "text", "chat", "Representational State Transfer", "", ""],
        [example, "quiz", "Sample quiz", "", "Name one HTTP verb.", "objective", "text", "chat", "`GET`", "", ""],
        [example, "quiz", "An open ended question", "", "Why is `PUT` idempotent but `POST` is not?", "subjective", "text", "chat", "", "", ""],
        [example, "quiz", "A coding question", "", "Write a function that reverses a string", "objective", "code", "exam", "", "python|javascript", ""],
        [example, "quiz", "A spoken question", "", "Explain dependency injection out loud", "subjective", "audio", "chat", "", "", ""],
    ];

    return rows.map((cells) => cells.map(escape).join(",")).join("\n");
};
