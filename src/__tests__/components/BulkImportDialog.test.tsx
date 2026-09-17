import fs from "fs";
import path from "path";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BulkImportDialog from "@/components/BulkImportDialog";

const MODULES = [{ id: "42", title: "New Module" }];
const HEADER = "module,type,title,content,question,question_type,input_type,response_type,answer,coding_languages";

const renderDialog = (props = {}) => {
    const onImported = jest.fn();
    const onClose = jest.fn();
    const utils = render(
        <BulkImportDialog open onClose={onClose} courseId="388" modules={MODULES} onImported={onImported} {...props} />
    );
    return { ...utils, onImported, onClose };
};

const choose = (content: string) => {
    const file = new File([content], "tasks.csv", { type: "text/csv" });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [file] },
    });
};

const importButton = () => screen.getByRole("button", { name: "Import tasks" });

beforeEach(() => {
    global.fetch = jest.fn();
    Object.defineProperty(global.URL, "createObjectURL", { value: jest.fn(() => "blob:x"), writable: true });
    Object.defineProperty(global.URL, "revokeObjectURL", { value: jest.fn(), writable: true });
});

afterEach(() => jest.resetAllMocks());

describe("BulkImportDialog", () => {
    it("renders nothing when closed", () => {
        const { container } = renderDialog({ open: false });
        expect(container).toBeEmptyDOMElement();
    });

    it("disables import until a usable file is chosen", () => {
        renderDialog();
        expect(importButton()).toBeDisabled();
    });

    it("leads with what will be imported, not with what failed", async () => {
        renderDialog();
        choose([HEADER, "New Module,learning_material,Good,Body", "Nope,quiz,Bad,,Q"].join("\n"));

        expect(await screen.findByText("1 task ready to import")).toBeInTheDocument();
        expect(screen.getByText("1 row skipped")).toBeInTheDocument();
        expect(screen.getByText('Module "Nope" does not exist in this course')).toBeInTheDocument();
        expect(screen.getByText("Row 3")).toBeInTheDocument();
    });

    it("groups repeated reasons instead of repeating them per row", async () => {
        renderDialog();
        choose(
            [
                HEADER,
                "New Module,learning_material,Good,Body",
                "Nope,quiz,A,,Q",
                "Nope,quiz,B,,Q",
                "Nope,quiz,C,,Q",
                "New Module,quiz,,,Q",
            ].join("\n")
        );

        expect(await screen.findByText("4 rows skipped")).toBeInTheDocument();
        // one entry for the three identical reasons, with a count and the row list
        expect(screen.getAllByText('Module "Nope" does not exist in this course')).toHaveLength(1);
        expect(screen.getByText("×3")).toBeInTheDocument();
        expect(screen.getByText("Rows 3, 4, 5")).toBeInTheDocument();
        expect(screen.getByText("Title is empty")).toBeInTheDocument();
    });

    it("reports how many were imported and what was skipped", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ created: [1] }) });

        const { onImported } = renderDialog();
        choose([HEADER, "New Module,learning_material,Good,Body", "Nope,quiz,Bad,,Q"].join("\n"));
        await screen.findByText("1 task ready to import");

        fireEvent.click(importButton());

        expect(await screen.findByText("1 task added as a draft")).toBeInTheDocument();
        expect(screen.getByText("1 row skipped")).toBeInTheDocument();
        expect(onImported).toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });

    it("posts only the valid rows to the bulk endpoint", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ created: [] }) });

        renderDialog();
        choose([HEADER, "New Module,quiz,Check,,Q1", "Nope,quiz,Bad,,Q"].join("\n"));
        await screen.findByText("1 task ready to import");
        fireEvent.click(importButton());

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toBe("/api/backend/courses/388/tasks/bulk");
        const body = JSON.parse(options.body);
        expect(body.items).toHaveLength(1);
        expect(body.items[0]).toMatchObject({ milestone_id: 42, type: "quiz", title: "Check" });
    });

    it("surfaces the server message when the import is rejected", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: "Some modules are no longer part of this course. Refresh and try again." }),
        });

        const { onImported } = renderDialog();
        choose([HEADER, "New Module,quiz,Check,,Q1"].join("\n"));
        await screen.findByText("1 task ready to import");
        fireEvent.click(importButton());

        expect(await screen.findByText(/no longer part of this course/)).toBeInTheDocument();
        expect(onImported).not.toHaveBeenCalled();
    });

    it("explains a file with the wrong columns instead of importing it", async () => {
        renderDialog();
        choose("name,notes\na,b");

        expect(await screen.findByText(/missing the module, type, title columns/)).toBeInTheDocument();
        expect(importButton()).toBeDisabled();
    });

    it("says so when no row can be imported", async () => {
        renderDialog();
        choose([HEADER, "Nope,quiz,Bad,,Q"].join("\n"));

        expect(await screen.findByText("No row in this file can be imported")).toBeInTheDocument();
        expect(importButton()).toBeDisabled();
    });

    it("refuses a file above the per-import cap before sending it", async () => {
        const rows = Array.from({ length: 501 }, (_, i) => `New Module,learning_material,T${i},body`);
        renderDialog();
        choose([HEADER, ...rows].join("\n"));

        expect(await screen.findByText(/Import at most 500 at a time/)).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(importButton()).toBeDisabled();
    });

    it("offers a template download", () => {
        renderDialog();
        fireEvent.click(screen.getByRole("button", { name: /Download template/ }));
        expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it("matches the cohort invite dialog's primary button styling", () => {
        // Read out of the component this dialog is meant to match, so a restyle
        // there fails here instead of letting the two drift apart silently.
        const source = fs.readFileSync(
            path.join(process.cwd(), "src/components/CohortMemberManagement.tsx"),
            "utf8"
        );
        const cohortButton = source
            .split("\n")
            .find((line) => line.includes("bg-[#e5e7eb]"))!
            .trim()
            .replace(/^className="/, "")
            .replace(/"$/, "");

        renderDialog();
        const ours = importButton().className;
        cohortButton
            .split(/\s+/)
            .filter((c) => c && !c.startsWith("disabled:"))
            .forEach((cls) => expect(ours).toContain(cls));
    });
});
