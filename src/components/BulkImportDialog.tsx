"use client";

import React, { useState, useEffect, useRef } from "react";
import { Upload, Download, CheckCircle, AlertTriangle } from "lucide-react";
import {
    parseImportCsv,
    buildTemplateCsv,
    groupSkipped,
    ImportModule,
    ParsedImport,
    SkippedRow,
    MAX_IMPORT_TASKS,
} from "@/lib/utils/csvImport";

interface BulkImportDialogProps {
    open: boolean;
    onClose: () => void;
    courseId: string;
    modules: ImportModule[];
    onImported: () => void;
}

export default function BulkImportDialog({
    open,
    onClose,
    courseId,
    modules,
    onImported,
}: BulkImportDialogProps) {
    const [parsed, setParsed] = useState<ParsedImport | null>(null);
    const [fileName, setFileName] = useState("");
    const [error, setError] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [imported, setImported] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setParsed(null);
            setFileName("");
            setError("");
            setIsImporting(false);
            setImported(null);
        }
    }, [open]);

    if (!open) return null;

    const downloadTemplate = () => {
        const blob = new Blob([buildTemplateCsv(modules)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "sensai-tasks-template.csv";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    const readFile = (file: File) => {
        setError("");
        setImported(null);
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const next = parseImportCsv((event.target?.result as string) ?? "", modules);
                if (next.items.length > MAX_IMPORT_TASKS) {
                    setParsed(null);
                    setError(`This file has ${next.items.length} tasks. Import at most ${MAX_IMPORT_TASKS} at a time`);
                    return;
                }
                setParsed(next);
            } catch (parseError) {
                setParsed(null);
                setError(parseError instanceof Error ? parseError.message : "Could not read this file");
            }
        };
        reader.onerror = () => setError("Could not read this file");
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!parsed || parsed.items.length === 0) return;

        setIsImporting(true);
        setError("");

        try {
            const response = await fetch(`/api/backend/courses/${courseId}/tasks/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: parsed.items }),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(
                    typeof body.detail === "string"
                        ? body.detail
                        : "Could not import these tasks. Please try again"
                );
            }

            const data = await response.json();
            setImported(data.created.length);
            onImported();
        } catch (importError) {
            setError(importError instanceof Error ? importError.message : "Could not import these tasks");
        } finally {
            setIsImporting(false);
        }
    };

    const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

    // Grouped by reason: a long file usually has a few mistakes repeated, and one
    // line per row hides that behind a wall of near-identical sentences.
    const skippedSummary = (rows: SkippedRow[]) => (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertTriangle size={16} className="shrink-0" />
                <span className="text-sm font-light">{plural(rows.length, "row")} skipped</span>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-lg bg-gray-50 dark:bg-[#0A0A0A] divide-y divide-gray-200 dark:divide-[#1A1A1A]">
                {groupSkipped(rows).map(({ reason, lines }) => (
                    <div key={reason} className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm text-black dark:text-white font-light">{reason}</span>
                            {lines.length > 1 && (
                                <span className="shrink-0 text-xs text-gray-600 dark:text-gray-400">
                                    ×{lines.length}
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            {lines.length === 1 ? "Row " : "Rows "}
                            {lines.join(", ")}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );

    const body = () => {
        if (imported !== null) {
            return (
                <div className="space-y-5">
                    <div className="flex items-center gap-3">
                        <CheckCircle size={20} className="text-green-500 shrink-0" />
                        <p className="text-lg font-light">
                            {plural(imported, "task")} added as {imported === 1 ? "a draft" : "drafts"}
                        </p>
                    </div>

                    {parsed && parsed.skipped.length > 0 ? (
                        <>
                            {skippedSummary(parsed.skipped)}
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                Fix those rows and import them on their own — importing the whole file
                                again would add the others a second time
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Every row in your file was imported
                        </p>
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-5">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="flex items-center gap-4 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer w-full bg-gray-50 dark:bg-[#0A0A0A] rounded-lg p-4 pr-2 border border-dashed border-gray-200 dark:border-[#0A0A0A] hover:border-gray-400 dark:hover:border-white hover:bg-gray-100 dark:hover:bg-[#111] focus:outline-none group disabled:opacity-50"
                >
                    <div className="w-12 h-12 rounded-full bg-white dark:bg-[#1A1A1A] flex items-center justify-center border border-gray-200 dark:border-transparent shrink-0">
                        <Upload size={20} className="text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex flex-col items-start text-left">
                        <span className="text-black dark:text-white text-base font-light">
                            {fileName || "Import CSV"}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">
                            Tasks are added as drafts to modules that already exist
                        </span>
                    </div>
                </button>

                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) readFile(file);
                        event.target.value = "";
                    }}
                />

                {parsed && (
                    <div className="space-y-4">
                        {parsed.items.length > 0 ? (
                            <div className="flex items-center gap-3">
                                <CheckCircle size={20} className="text-green-500 shrink-0" />
                                <p className="text-lg font-light">
                                    {plural(parsed.items.length, "task")} ready to import
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-red-500">No row in this file can be imported</p>
                        )}

                        {parsed.skipped.length > 0 && skippedSummary(parsed.skipped)}
                    </div>
                )}

                {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={isImporting ? undefined : onClose}
        >
            <div
                className="w-full max-w-lg bg-white dark:bg-[#1A1A1A] text-black dark:text-white rounded-lg shadow-2xl py-2"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 pt-4">
                    <h2 className="text-xl font-light">Import tasks</h2>
                    {imported === null && (
                        <button
                            onClick={downloadTemplate}
                            className="flex items-center gap-2 text-sm font-light text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer focus:outline-none"
                        >
                            <Download size={16} />
                            Download template
                        </button>
                    )}
                </div>

                <div className="px-6 py-4">{body()}</div>

                <div className="flex justify-end gap-4 px-6 py-4">
                    <button
                        onClick={onClose}
                        disabled={isImporting}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors font-light cursor-pointer focus:outline-none disabled:opacity-50"
                    >
                        {imported === null ? "Cancel" : "Close"}
                    </button>
                    {imported === null && (
                        <button
                            onClick={handleImport}
                            disabled={isImporting || !parsed || parsed.items.length === 0}
                            className="px-6 py-3 bg-[#e5e7eb] text-[#000000] dark:bg-[#ffffff] dark:text-[#000000] text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isImporting ? "Importing..." : "Import tasks"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
