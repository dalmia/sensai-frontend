import { convertFileToBase64, base64ToBlob, uploadFile, downloadFile } from "../../../lib/utils/fileUtils";

describe("fileUtils", () => {
    const originalFileReader = global.FileReader;
    const originalFetch = global.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        (global as any).FileReader = originalFileReader;
    });

    describe("convertFileToBase64", () => {
        test("successfully converts file to base64", async () => {
            // Create a mock FileReader that triggers onloadend
            const MockFileReader = jest.fn().mockImplementation(() => ({
                readAsDataURL: jest.fn().mockImplementation(function(this: any) {
                    setTimeout(() => {
                        this.result = "data:application/pdf;base64,SGVsbG9Xb3JsZA==";
                        if (this.onloadend) this.onloadend();
                    }, 0);
                }),
                result: null,
                onloadend: null,
                onerror: null
            }));
            (global as any).FileReader = MockFileReader;

            const file = new File(["Hello World"], "test.pdf", { type: "application/pdf" });
            const result = await convertFileToBase64(file);

            expect(result).toBe("SGVsbG9Xb3JsZA==");
        });

        test("rejects when FileReader errors", async () => {
            // Create a mock FileReader that triggers onerror
            const MockFileReader = jest.fn().mockImplementation(() => ({
                readAsDataURL: jest.fn().mockImplementation(function(this: any) {
                    setTimeout(() => {
                        if (this.onerror) this.onerror();
                    }, 0);
                }),
                result: null,
                onloadend: null,
                onerror: null
            }));
            (global as any).FileReader = MockFileReader;

            const file = new File(["test"], "test.pdf", { type: "application/pdf" });
            await expect(convertFileToBase64(file)).rejects.toThrow("Failed to read file");
        });
    });

    describe("base64ToBlob", () => {
        test("converts base64 to blob with correct content type", () => {
            // "Hello" in base64
            const base64Data = "SGVsbG8=";
            const contentType = "text/plain";

            const blob = base64ToBlob(base64Data, contentType);

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe(contentType);
            expect(blob.size).toBe(5); // "Hello" is 5 bytes
        });

        test("handles empty base64 data", () => {
            const blob = base64ToBlob("", "application/octet-stream");

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.size).toBe(0);
        });

        test("converts binary data correctly", () => {
            // Binary data [0, 1, 2, 3] in base64
            const base64Data = "AAECAw==";
            const blob = base64ToBlob(base64Data, "application/octet-stream");

            expect(blob.size).toBe(4);
        });
    });

    describe("uploadFile", () => {
        const mockBase64Data = "SGVsbG9Xb3JsZA==";
        const mockFilename = "test.pdf";
        const mockContentType = "application/pdf";

        test("successfully uploads via presigned URL (S3)", async () => {
            const mockFileUuid = "test-uuid-123";
            const mockPresignedUrl = "https://s3.example.com/presigned-url";

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ presigned_url: mockPresignedUrl, file_uuid: mockFileUuid })
                })
                .mockResolvedValueOnce({
                    ok: true
                });

            const result = await uploadFile(mockBase64Data, mockFilename, mockContentType);

            expect(result).toBe(mockFileUuid);
            expect(fetch).toHaveBeenCalledTimes(2);
            // First call - get presigned URL
            expect(fetch).toHaveBeenNthCalledWith(1,
                expect.stringContaining("/file/presigned-url/create"),
                expect.objectContaining({ method: "PUT" })
            );
            // Second call - upload to S3
            expect(fetch).toHaveBeenNthCalledWith(2,
                mockPresignedUrl,
                expect.objectContaining({ method: "PUT" })
            );
        });

        test("falls back to direct upload when presigned URL fails", async () => {
            const mockFileUuid = "fallback-uuid-456";
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: false
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ file_uuid: mockFileUuid })
                });

            const result = await uploadFile(mockBase64Data, mockFilename, mockContentType);

            expect(result).toBe(mockFileUuid);
            expect(fetch).toHaveBeenCalledTimes(2);
            // Second call should be direct upload
            expect(fetch).toHaveBeenNthCalledWith(2,
                expect.stringContaining("/file/upload-local"),
                expect.objectContaining({ method: "POST" })
            );

            consoleErrorSpy.mockRestore();
        });

        test("throws error when direct upload fails", async () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: false
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500
                });

            await expect(uploadFile(mockBase64Data, mockFilename, mockContentType))
                .rejects.toThrow("Error with direct upload to backend");

            consoleErrorSpy.mockRestore();
        });

        test("throws error when S3 upload fails", async () => {
            const mockPresignedUrl = "https://s3.example.com/presigned-url";
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ presigned_url: mockPresignedUrl, file_uuid: "test-uuid" })
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 403
                });

            await expect(uploadFile(mockBase64Data, mockFilename, mockContentType))
                .rejects.toThrow("Error uploading file to S3");

            consoleErrorSpy.mockRestore();
        });

        test("throws error when file_uuid is not returned", async () => {
            const mockPresignedUrl = "https://s3.example.com/presigned-url";

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ presigned_url: mockPresignedUrl, file_uuid: "" })
                })
                .mockResolvedValueOnce({
                    ok: true
                });

            await expect(uploadFile(mockBase64Data, mockFilename, mockContentType))
                .rejects.toThrow("Failed to get file UUID after upload");
        });

        test("handles network error when getting presigned URL", async () => {
            const mockFileUuid = "fallback-uuid-789";
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            global.fetch = jest.fn()
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ file_uuid: mockFileUuid })
                });

            const result = await uploadFile(mockBase64Data, mockFilename, mockContentType);

            expect(result).toBe(mockFileUuid);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Error getting presigned URL:",
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe("downloadFile", () => {
        const mockFileUuid = "download-uuid-123";
        const mockFileName = "document.pdf";

        let mockLink: { href: string; download: string; click: jest.Mock };
        let appendChildSpy: jest.SpyInstance;
        let removeChildSpy: jest.SpyInstance;

        beforeEach(() => {
            mockLink = {
                href: "",
                download: "",
                click: jest.fn()
            };

            jest.spyOn(document, "createElement").mockReturnValue(mockLink as any);
            appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as any);
            removeChildSpy = jest.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as any);

            URL.createObjectURL = jest.fn().mockReturnValue("blob:http://localhost/mock-blob-url");
            URL.revokeObjectURL = jest.fn();
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test("successfully downloads via presigned URL", async () => {
            const mockPresignedUrl = "https://s3.example.com/download-url";
            const mockBlob = new Blob(["test content"], { type: "application/pdf" });

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ url: mockPresignedUrl })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    blob: async () => mockBlob
                });

            await downloadFile(mockFileUuid, mockFileName);

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(fetch).toHaveBeenNthCalledWith(1,
                expect.stringContaining(`/file/presigned-url/get?uuid=${mockFileUuid}&file_extension=pdf`),
                { method: "GET" }
            );
            expect(fetch).toHaveBeenNthCalledWith(2, mockPresignedUrl);
            expect(mockLink.download).toBe(mockFileName);
            expect(mockLink.click).toHaveBeenCalled();
            expect(URL.revokeObjectURL).toHaveBeenCalled();
        });

        test("falls back to direct download when presigned URL fails", async () => {
            const mockBlob = new Blob(["test content"], { type: "application/pdf" });

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: false
                })
                .mockResolvedValueOnce({
                    ok: true,
                    blob: async () => mockBlob
                });

            await downloadFile(mockFileUuid, mockFileName);

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(fetch).toHaveBeenNthCalledWith(2,
                expect.stringContaining(`/file/download-local/?uuid=${mockFileUuid}&file_extension=pdf`)
            );
            expect(mockLink.click).toHaveBeenCalled();
        });

        test("uses default extension when filename has no extension", async () => {
            const mockBlob = new Blob(["test"], { type: "application/zip" });

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ url: "https://s3.example.com/url" })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    blob: async () => mockBlob
                });

            await downloadFile(mockFileUuid, "noextension", "zip");

            expect(fetch).toHaveBeenNthCalledWith(1,
                expect.stringContaining("file_extension=noextension"),
                { method: "GET" }
            );
        });

        test("throws error when file download fails", async () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ url: "https://s3.example.com/url" })
                })
                .mockResolvedValueOnce({
                    ok: false
                });

            await expect(downloadFile(mockFileUuid, mockFileName))
                .rejects.toThrow("Failed to download file");

            consoleErrorSpy.mockRestore();
        });

        test("extracts file extension correctly from filename", async () => {
            const mockBlob = new Blob(["test"], { type: "image/png" });

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ url: "https://s3.example.com/url" })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    blob: async () => mockBlob
                });

            await downloadFile(mockFileUuid, "image.PNG");

            expect(fetch).toHaveBeenNthCalledWith(1,
                expect.stringContaining("file_extension=png"),
                { method: "GET" }
            );
        });

        test("uses default extension when filename ends with dot (empty extension)", async () => {
            const mockBlob = new Blob(["test"], { type: "application/zip" });

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ url: "https://s3.example.com/url" })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    blob: async () => mockBlob
                });

            // Filename ending with dot - pop() returns empty string, fallback to default
            await downloadFile(mockFileUuid, "file.", "zip");

            expect(fetch).toHaveBeenNthCalledWith(1,
                expect.stringContaining("file_extension=zip"),
                { method: "GET" }
            );
        });
    });
});
