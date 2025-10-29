import { formatScheduleDate, formatFullScheduleDate } from "../../../lib/utils/dateFormat";

describe("dateFormat utilities", () => {
    const baseDate = new Date(2025, 9, 17, 10, 15, 0, 0); // Oct 17, 2025 10:15:00 local

    let originalToLocaleTimeString: (this: Date, ...args: unknown[]) => string;
    let originalToLocaleDateString: (this: Date, ...args: unknown[]) => string;

    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(baseDate);
        originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
        originalToLocaleDateString = Date.prototype.toLocaleDateString;
    });

    afterAll(() => {
        Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
        Date.prototype.toLocaleDateString = originalToLocaleDateString;
        jest.useRealTimers();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        // Reset any per-test overrides back to a default deterministic mock for time string
        Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
        Date.prototype.toLocaleDateString = originalToLocaleDateString;
    });

    describe("formatScheduleDate", () => {
        it("returns empty string when date is null", () => {
            expect(formatScheduleDate(null)).toBe("");
        });

        it("formats today's date as 'Today at HH:MM'", () => {
            jest.spyOn(Date.prototype as unknown as { toLocaleTimeString: () => string }, "toLocaleTimeString").mockReturnValue("10:15");

            const result = formatScheduleDate(new Date(baseDate));
            expect(result).toBe("Today at 10:15");
        });

        it("formats tomorrow's date as 'Tomorrow at HH:MM'", () => {
            jest.spyOn(Date.prototype as unknown as { toLocaleTimeString: () => string }, "toLocaleTimeString").mockReturnValue("10:15");

            const tomorrow = new Date(baseDate);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const result = formatScheduleDate(tomorrow);
            expect(result).toBe("Tomorrow at 10:15");
        });

        it("falls back to full date formatting for non-today/tomorrow", () => {
            const otherDate = new Date(2025, 9, 20, 9, 5, 0, 0);

            // For this case, the util uses toLocaleDateString with { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
            // Stub a deterministic return value regardless of locale
            jest
                .spyOn(Date.prototype as unknown as { toLocaleDateString: () => string }, "toLocaleDateString")
                .mockReturnValue("Oct 20, 09:05");

            const result = formatScheduleDate(otherDate);
            expect(result).toBe("Oct 20, 09:05");
        });
    });

    describe("formatFullScheduleDate", () => {
        it("returns empty string when date is null", () => {
            expect(formatFullScheduleDate(null)).toBe("");
        });

        it("formats a full descriptive date string deterministically", () => {
            const fullDate = new Date(baseDate);

            // The util calls toLocaleDateString with weekday, year, month, day, hour, minute
            jest
                .spyOn(Date.prototype as unknown as { toLocaleDateString: () => string }, "toLocaleDateString")
                .mockReturnValue("Friday, October 17, 2025, 10:15");

            const result = formatFullScheduleDate(fullDate);
            expect(result).toBe("Friday, October 17, 2025, 10:15");
        });
    });
});


