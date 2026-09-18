import fs from "fs";
import path from "path";
import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import BulkImportDialog from "@/components/BulkImportDialog";

const MODULES = [{ id: "42", title: "New Module" }];
const SCORECARDS = [{ id: 7, title: "Comms Rubric" }];
const HEADER = "module,type,title,content,question,question_type,input_type,response_type,answer,coding_languages";

const renderDialog = (props = {}) => {
    const onImported = jest.fn();
    const onClose = jest.fn();
    const utils = render(
        <BulkImportDialog open onClose={onClose} courseId="388" schoolId="8" modules={MODULES} onImported={onImported} {...props} />
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

// The dialog fetches this school's scorecards on open, so every mock has to
// answer that call as well as the bulk POST.
const mockBackend = (bulk: { ok: boolean; body: unknown } = { ok: true, body: { created: [] } }) => {
    global.fetch = jest.fn().mockImplementation((url: string) =>
        Promise.resolve(
            url.includes("/scorecards")
                ? { ok: true, json: async () => SCORECARDS }
                : { ok: bulk.ok, json: async () => bulk.body }
        )
    );
};

const bulkCalls = () =>
    (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).includes("/tasks/bulk"));

beforeEach(() => {
    mockBackend();
    Object.defineProperty(global.URL, "createObjectURL", { value: jest.fn(() => "blob:x"), writable: true });
    Object.defineProperty(global.URL, "revokeObjectURL", { value: jest.fn(), writable: true });
});

afterEach(() => jest.resetAllMocks());

describe("BulkImportDialog", () => {
    it.each(["cancel", "backdrop", "success"])("clears the file and status immediately on %s, before parent unmount", async (method) => {
        mockBackend({ ok: true, body: { created: [1] } });
        const { onClose } = renderDialog();
        choose([HEADER, "New Module,quiz,Check,,Q", "Missing,quiz,Bad,,Q"].join("\n"));
        await screen.findByText("1 task ready to import");
        if (method === "success") {
            fireEvent.click(importButton());
            await screen.findByText("1 task added as a draft");
        }
        if (method === "backdrop") {
            fireEvent.click(screen.getByRole("heading", { name: "Import tasks" }).closest(".fixed")!);
        } else {
            fireEvent.click(screen.getByRole("button", { name: method === "success" ? "Close" : "Cancel" }));
        }
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(importButton()).toBeDisabled();
        expect(screen.queryByText(/ready to import|added as a draft|row skipped/)).not.toBeInTheDocument();
        expect(screen.queryByText("tasks.csv")).not.toBeInTheDocument();
    });

    it.each([false, true])("reopens with no previous file or status after success=%s", async (success) => {
        mockBackend({ ok: true, body: { created: [1] } });
        function Harness() {
            const [open, setOpen] = React.useState(true);
            return <>
                <button onClick={() => setOpen(true)}>Open importer</button>
                <BulkImportDialog open={open} onClose={() => setOpen(false)} courseId="388" schoolId="8"
                    modules={MODULES.map(m => ({ ...m }))} onImported={() => undefined} />
            </>;
        }
        render(<Harness />);
        choose([HEADER, "New Module,quiz,Check,,Q", "Missing,quiz,Bad,,Q"].join("\n"));
        await screen.findByText("1 task ready to import");
        if (success) {
            fireEvent.click(importButton());
            await screen.findByText("1 task added as a draft");
        }
        fireEvent.click(screen.getByRole("button", { name: success ? "Close" : "Cancel" }));
        fireEvent.click(screen.getByRole("button", { name: "Open importer" }));
        await waitFor(() => expect(screen.queryByText("Loading scorecards…")).not.toBeInTheDocument());
        expect(importButton()).toBeDisabled();
        expect(screen.queryByText(/ready to import|added as a draft|row skipped/)).not.toBeInTheDocument();
        expect(screen.queryByText("tasks.csv")).not.toBeInTheDocument();
    });

    it("rejects more than 2000 questions even when grouped into one task", async () => {
        renderDialog();
        choose([HEADER, ...Array.from({ length: 2001 }, () => "New Module,quiz,Check,,Q")].join("\n"));
        await screen.findByText(/Import at most 2000/);
        expect(importButton()).toBeDisabled();
        expect(bulkCalls()).toHaveLength(0);
    });

    it("blocks malformed CSV instead of silently merging tasks", async () => {
        renderDialog();
        choose('module,type,title,content\nNew Module,learning_material,First,"Unclosed\nNew Module,learning_material,Second,Body');
        await screen.findByText(/missing its closing quote/);
        expect(importButton()).toBeDisabled();
    });
    it("waits for scorecards before resolving and posting a chosen CSV", async () => {
        let resolveLookup!: (response: unknown) => void;
        global.fetch = jest.fn().mockImplementation((url: string) =>
            url.includes("/scorecards")
                ? new Promise(resolve => { resolveLookup = resolve; })
                : Promise.resolve({ ok: true, json: async () => ({ created: [1] }) })
        );
        renderDialog();
        choose("module,type,title,question,scorecard\nNew Module,quiz,Check,Q,Comms Rubric");
        expect(importButton()).toBeDisabled();
        expect(screen.getByText("Loading scorecards…")).toBeInTheDocument();
        await act(async () => {
            resolveLookup({ ok: true, json: async () => SCORECARDS });
        });
        await screen.findByText("1 task ready to import");
        fireEvent.click(importButton());
        await screen.findByText("1 task added as a draft");
        expect(JSON.parse(bulkCalls()[0][1].body).items[0].questions[0].scorecard_id).toBe(7);
    });

    it("blocks import when scorecard lookup fails and reparses after retry", async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false });
        renderDialog();
        choose("module,type,title,question,scorecard\nNew Module,quiz,Check,Q,Comms Rubric");
        await screen.findByText(/Could not load scorecards/);
        expect(importButton()).toBeDisabled();
        expect(screen.queryByText(/does not exist in this school/)).not.toBeInTheDocument();
        mockBackend();
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        await screen.findByText("1 task ready to import");
        expect(importButton()).toBeEnabled();
    });

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
        mockBackend({ ok: true, body: { created: [1] } });

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
        mockBackend();

        renderDialog();
        choose([HEADER, "New Module,quiz,Check,,Q1", "Nope,quiz,Bad,,Q"].join("\n"));
        await screen.findByText("1 task ready to import");
        fireEvent.click(importButton());

        await waitFor(() => expect(bulkCalls()).toHaveLength(1));
        const [url, options] = bulkCalls()[0];
        expect(url).toBe("/api/backend/courses/388/tasks/bulk");
        const body = JSON.parse(options.body);
        expect(body.items).toHaveLength(1);
        expect(body.items[0]).toMatchObject({ milestone_id: 42, type: "quiz", title: "Check" });
    });

    it("surfaces the server message when the import is rejected", async () => {
        mockBackend({
            ok: false,
            body: { detail: "Some modules are no longer part of this course. Refresh and try again." },
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
        expect(bulkCalls()).toHaveLength(0);
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
