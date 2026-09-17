import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BulkImportDialog from "@/components/BulkImportDialog";

const MODULES = [{ id: "42", title: "New Module" }];
const HEADER = "module,type,title,content,question,question_type,input_type,response_type,answer,max_attempts,is_feedback_shown";

const renderDialog = (props = {}) => {
    const onImported = jest.fn();
    const onClose = jest.fn();
    const utils = render(
        <BulkImportDialog
            open
            onClose={onClose}
            courseId="388"
            modules={MODULES}
            onImported={onImported}
            {...props}
        />
    );
    return { ...utils, onImported, onClose };
};

const upload = async (content: string) => {
    const file = new File([content], "tasks.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText(/ready to import/);
};

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
        expect(screen.getByRole("button", { name: /^Import$/ })).toBeDisabled();
    });

    it("counts importable rows and lists the skipped ones with a reason", async () => {
        renderDialog();
        await upload(
            [HEADER, "New Module,learning_material,Good,Body,,,,,,,", "Nope,quiz,Bad,,Q,,,,,,"].join("\n")
        );

        expect(screen.getByText(/1 of 2 rows ready to import, 1 will be skipped/)).toBeInTheDocument();
        expect(screen.getByText(/does not exist in this course/)).toBeInTheDocument();
        expect(screen.getByText("Row 3")).toBeInTheDocument();
    });

    it("reports how many were imported and what was skipped", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ created: [{ index: 0, task_id: 1, milestone_id: 42, ordering: 0 }] }),
        });

        const { onImported } = renderDialog();
        await upload(
            [HEADER, "New Module,learning_material,Good,Body,,,,,,,", "Nope,quiz,Bad,,Q,,,,,,"].join("\n")
        );

        fireEvent.click(screen.getByRole("button", { name: /Import 1 task/ }));

        await screen.findByText(/1 task added as a draft/);
        expect(screen.getByText(/1 row was skipped/)).toBeInTheDocument();
        expect(onImported).toHaveBeenCalled();
    });

    it("posts only the valid rows to the bulk endpoint", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ created: [] }) });

        renderDialog();
        await upload([HEADER, "New Module,quiz,Check,,Q1,,,,,,", "Nope,quiz,Bad,,Q,,,,,,"].join("\n"));
        fireEvent.click(screen.getByRole("button", { name: /Import 1 task/ }));

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
        await upload([HEADER, "New Module,quiz,Check,,Q1,,,,,,"].join("\n"));
        fireEvent.click(screen.getByRole("button", { name: /Import 1 task/ }));

        await screen.findByText(/no longer part of this course/);
        expect(onImported).not.toHaveBeenCalled();
    });

    it("explains a file with the wrong columns instead of importing it", async () => {
        renderDialog();
        const file = new File(["name,notes\na,b"], "wrong.csv", { type: "text/csv" });
        fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
            target: { files: [file] },
        });

        await screen.findByText(/missing the module, type, title columns/);
        expect(screen.getByRole("button", { name: /^Import$/ })).toBeDisabled();
    });

    it("says so when no row can be imported", async () => {
        renderDialog();
        await upload([HEADER, "Nope,quiz,Bad,,Q,,,,,,"].join("\n"));
        expect(screen.getByText("No row in this file can be imported")).toBeInTheDocument();
    });

    it("truncates a very long title but keeps it reachable on hover", async () => {
        const long = "x".repeat(256);
        renderDialog();
        await upload([HEADER, `New Module,quiz,${long},,Q`].join("\n"));

        const cell = screen.getByTitle(long);
        expect(cell).toHaveClass("truncate");
        expect(screen.getByText("Title is longer than 255 characters")).toBeInTheDocument();
    });

    it("offers a template download", () => {
        renderDialog();
        fireEvent.click(screen.getByRole("button", { name: /Download template/ }));
        expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
});

describe("BulkImportDialog limits", () => {
    it("refuses a file above the per-import cap before sending it", async () => {
        const header = "module,type,title,content";
        const rows = Array.from({ length: 501 }, (_, i) => `New Module,learning_material,T${i},body`);
        renderDialog();

        const file = new File([[header, ...rows].join("\n")], "big.csv", { type: "text/csv" });
        fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
            target: { files: [file] },
        });

        await screen.findByText(/Import at most 500 at a time/);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: /^Import$/ })).toBeDisabled();
    });
});
