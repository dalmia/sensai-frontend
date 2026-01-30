import { safeLocalStorage } from "../../../lib/utils/localStorage";

describe("safeLocalStorage", () => {
    // Store original window and localStorage
    const originalWindow = global.window;
    const originalLocalStorage = global.localStorage;

    // Mock localStorage
    let mockLocalStorage: {
        getItem: jest.Mock;
        setItem: jest.Mock;
        removeItem: jest.Mock;
        clear: jest.Mock;
    };

    beforeEach(() => {
        // Reset mocks before each test
        mockLocalStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn(),
        };

        // Define window with localStorage
        Object.defineProperty(global, "window", {
            value: {},
            writable: true,
        });

        Object.defineProperty(global, "localStorage", {
            value: mockLocalStorage,
            writable: true,
        });
    });

    afterEach(() => {
        // Restore original window and localStorage
        Object.defineProperty(global, "window", {
            value: originalWindow,
            writable: true,
        });

        Object.defineProperty(global, "localStorage", {
            value: originalLocalStorage,
            writable: true,
        });

        jest.restoreAllMocks();
    });

    describe("getItem", () => {
        test("returns value when localStorage has the key", () => {
            mockLocalStorage.getItem.mockReturnValue("testValue");

            const result = safeLocalStorage.getItem("testKey");

            expect(result).toBe("testValue");
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith("testKey");
        });

        test("returns null when key does not exist", () => {
            mockLocalStorage.getItem.mockReturnValue(null);

            const result = safeLocalStorage.getItem("nonExistentKey");

            expect(result).toBeNull();
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith("nonExistentKey");
        });

        test("returns null when window is undefined (SSR)", () => {
            // Simulate SSR environment
            Object.defineProperty(global, "window", {
                value: undefined,
                writable: true,
            });

            const result = safeLocalStorage.getItem("testKey");

            expect(result).toBeNull();
            expect(mockLocalStorage.getItem).not.toHaveBeenCalled();
        });

        test("returns null and logs error when localStorage throws", () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const testError = new Error("localStorage access denied");
            mockLocalStorage.getItem.mockImplementation(() => {
                throw testError;
            });

            const result = safeLocalStorage.getItem("testKey");

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Error accessing localStorage:",
                testError
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe("setItem", () => {
        test("successfully sets value in localStorage", () => {
            safeLocalStorage.setItem("testKey", "testValue");

            expect(mockLocalStorage.setItem).toHaveBeenCalledWith("testKey", "testValue");
        });

        test("does nothing when window is undefined (SSR)", () => {
            // Simulate SSR environment
            Object.defineProperty(global, "window", {
                value: undefined,
                writable: true,
            });

            safeLocalStorage.setItem("testKey", "testValue");

            expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
        });

        test("logs error when localStorage throws", () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const testError = new Error("QuotaExceededError");
            mockLocalStorage.setItem.mockImplementation(() => {
                throw testError;
            });

            safeLocalStorage.setItem("testKey", "testValue");

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Error writing to localStorage:",
                testError
            );

            consoleErrorSpy.mockRestore();
        });

        test("handles empty string value", () => {
            safeLocalStorage.setItem("testKey", "");

            expect(mockLocalStorage.setItem).toHaveBeenCalledWith("testKey", "");
        });

        test("handles special characters in key and value", () => {
            const specialKey = "test-key_123!@#";
            const specialValue = '{"data": "value with spaces & symbols!"}';

            safeLocalStorage.setItem(specialKey, specialValue);

            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(specialKey, specialValue);
        });
    });
});
