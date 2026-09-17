"use client";

import React, { useState, useEffect, useRef } from "react";
import { Upload, Download, CheckCircle, AlertCircle } from "lucide-react";
import {
    parseImportCsv,
    buildTemplateCsv,
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

interface ImportResult {
    imported: number;
    skipped: SkippedRow[];
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
    const [result, setResult] = useState<ImportResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setParsed(null);
            setFileName("");
            setError("");
            setIsImporting(false);
            setResult(null);
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
        URL.revokeObjectURL(url);
    };

    const readFile = (file: File) => {
        setError("");
        setResult(null);
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const next = parseImportCsv((event.target?.result as string) ?? "", modules);
                if (next.items.length > MAX_IMPORT_TASKS) {
                    setParsed(null);
                    setError(
                        `This file has ${next.items.length} tasks. Import at most ${MAX_IMPORT_TASKS} at a time`
                    );
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
            setResult({ imported: data.created.length, skipped: parsed.skipped });
            onImported();
        } catch (importError) {
            setError(importError instanceof Error ? importError.message : "Could not import these tasks");
        } finally {
            setIsImporting(false);
        }
    };

    const skippedList = (rows: SkippedRow[]) => (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-[#222] divide-y divide-gray-200 dark:divide-[#222]">
            {rows.map((row) => (
                <div key={row.line} className="flex items-baseline gap-2 px-3 py-2 text-sm">
                    <span className="shrink-0 text-gray-500 dark:text-gray-500">Row {row.line}</span>
                    <span
                        className="shrink-0 max-w-[12rem] truncate text-black dark:text-white font-light"
                        title={row.title}
                    >
                        {row.title}
                    </span>
                    <span className="text-red-500">{row.reason}</span>
                </div>
            ))}
        </div>
    );

    const renderBody = () => {
        if (result) {
            return (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <CheckCircle size={20} className="text-green-500 shrink-0" />
                        <p className="text-lg font-light">
                            {result.imported} {result.imported === 1 ? "task" : "tasks"} added as {result.imported === 1 ? "a draft" : "drafts"}
                        </p>
                    </div>

                    {result.skipped.length > 0 ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <AlertCircle size={20} className="text-amber-500 shrink-0" />
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {result.skipped.length} {result.skipped.length === 1 ? "row was" : "rows were"} skipped
                                </p>
                            </div>
                            {skippedList(result.skipped)}
                            <p className="text-xs text-gray-500">
                                Fix these rows and import them on their own - importing the whole file again would add the others a second time
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Every row in your file was imported</p>
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="flex items-center gap-4 w-full bg-gray-50 dark:bg-[#0A0A0A] rounded-lg p-4 border border-dashed border-gray-200 dark:border-[#222] hover:border-gray-400 dark:hover:border-white transition-colors cursor-pointer group disabled:opacity-50"
                >
                    <div className="w-12 h-12 rounded-full bg-white dark:bg-[#1A1A1A] flex items-center justify-center border border-gray-200 dark:border-transparent shrink-0">
                        <Upload size={20} className="text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex flex-col items-start text-left">
                        <span className="text-black dark:text-white text-base font-light">
                            {fileName || "Choose a CSV file"}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">
                            Added as drafts to modules that already exist. Content, questions and answers accept Markdown
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
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {parsed.items.length} of {parsed.totalRows} {parsed.totalRows === 1 ? "row" : "rows"} ready to import
                            {parsed.skipped.length > 0 && `, ${parsed.skipped.length} will be skipped`}
                        </p>
                        {parsed.skipped.length > 0 && skippedList(parsed.skipped)}
                        {parsed.totalRows > 0 && parsed.items.length === 0 && (
                            <p className="text-sm text-red-500">No row in this file can be imported</p>
                        )}
                    </div>
                )}

                {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={isImporting ? undefined : onClose}
        >
            <div
                className="w-full max-w-xl rounded-lg shadow-2xl bg-white dark:bg-[#1A1A1A] text-black dark:text-white border border-gray-200 dark:border-transparent"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 pt-6">
                    <h2 className="text-xl font-light">Import tasks</h2>
                    {!result && (
                        <button
                            onClick={downloadTemplate}
                            className="flex items-center gap-2 text-sm font-light text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                        >
                            <Download size={16} />
                            Download template
                        </button>
                    )}
                </div>

                <div className="p-6">{renderBody()}</div>

                <div className="flex justify-end gap-3 px-6 pb-6">
                    <button
                        onClick={onClose}
                        disabled={isImporting}
                        className="px-4 py-2 text-sm font-light rounded-full text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {result ? "Close" : "Cancel"}
                    </button>
                    {!result && (
                        <button
                            onClick={handleImport}
                            disabled={isImporting || !parsed || parsed.items.length === 0}
                            className="px-6 py-2 text-sm font-light rounded-full bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isImporting
                                ? "Importing"
                                : parsed
                                    ? `Import ${parsed.items.length} ${parsed.items.length === 1 ? "task" : "tasks"}`
                                    : "Import"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
