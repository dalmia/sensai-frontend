import { validateScorecardCriteria } from "../../../lib/utils/scorecardValidation";

type Criterion = { name?: string; description?: string };
type ScorecardLike = { criteria: Criterion[] };

describe("scorecardValidation", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(global, "setTimeout");
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test("returns true when scorecard is undefined", () => {
        const result = validateScorecardCriteria(undefined, {});
        expect(result).toBe(true);
    });

    test("invalid when criterion name is empty: sets tab, dispatches event, shows error (no question index)", () => {
        const setActiveTab = jest.fn();
        const showErrorMessage = jest.fn();
        const scorecard: ScorecardLike = {
            criteria: [
                { name: "", description: "desc" },
                { name: "ok", description: "ok" }
            ]
        };

        let receivedEvent: CustomEvent | null = null;
        const handler = (e: Event) => {
            receivedEvent = e as CustomEvent;
        };
        document.addEventListener("highlight-criterion", handler as EventListener);

        const valid = validateScorecardCriteria(scorecard as any, { setActiveTab, showErrorMessage });
        expect(valid).toBe(false);
        expect(setActiveTab).toHaveBeenCalledWith("scorecard");
        expect(showErrorMessage).not.toHaveBeenCalled();

        // Execute delayed callbacks
        expect(setTimeout).toHaveBeenCalled();
        jest.advanceTimersByTime(300);

        // Event dispatched with correct detail
        expect(receivedEvent).not.toBeNull();
        expect((receivedEvent as CustomEvent).detail).toEqual({ index: 0, field: "name" });

        // Message shown with expected content
        expect(showErrorMessage).toHaveBeenCalledTimes(1);
        expect(showErrorMessage).toHaveBeenCalledWith(
            "Empty Scorecard Parameter",
            "Please provide a name for parameter 1 in the scorecard",
            "🚫"
        );

        document.removeEventListener("highlight-criterion", handler as EventListener);
    });

    test("invalid when criterion name is empty: includes question index in message", () => {
        const setActiveTab = jest.fn();
        const showErrorMessage = jest.fn();
        const scorecard: ScorecardLike = {
            criteria: [{ name: "  ", description: "desc" }]
        };

        const valid = validateScorecardCriteria(scorecard as any, { setActiveTab, showErrorMessage, questionIndex: 2 });
        expect(valid).toBe(false);
        expect(setActiveTab).toHaveBeenCalledWith("scorecard");
        jest.advanceTimersByTime(300);
        expect(showErrorMessage).toHaveBeenCalledWith(
            "Empty Scorecard Parameter",
            "Please provide a name for parameter 1 in the scorecard for question 3",
            "🚫"
        );
    });

    test("invalid when description is empty: sets tab, dispatches event, shows error using parameter name", () => {
        const setActiveTab = jest.fn();
        const showErrorMessage = jest.fn();
        const scorecard: ScorecardLike = {
            criteria: [
                { name: "Clarity", description: "" },
                { name: "ok", description: "ok" }
            ]
        };

        let receivedEvent: CustomEvent | null = null;
        const handler = (e: Event) => {
            receivedEvent = e as CustomEvent;
        };
        document.addEventListener("highlight-criterion", handler as EventListener);

        const valid = validateScorecardCriteria(scorecard as any, { setActiveTab, showErrorMessage });
        expect(valid).toBe(false);
        expect(setActiveTab).toHaveBeenCalledWith("scorecard");
        expect(showErrorMessage).not.toHaveBeenCalled();

        jest.advanceTimersByTime(300);

        expect(receivedEvent).not.toBeNull();
        expect((receivedEvent as CustomEvent).detail).toEqual({ index: 0, field: "description" });
        expect(showErrorMessage).toHaveBeenCalledWith(
            "Empty Scorecard Parameter",
            "Please provide a description for Clarity in the scorecard",
            "🚫"
        );

        document.removeEventListener("highlight-criterion", handler as EventListener);
    });

    test("returns true when all criteria have non-empty name and description", () => {
        const setActiveTab = jest.fn();
        const showErrorMessage = jest.fn();
        const scorecard: ScorecardLike = {
            criteria: [
                { name: "Clarity", description: "Evaluate clarity of response" },
                { name: "Depth", description: "Assess depth and completeness" }
            ]
        };

        const valid = validateScorecardCriteria(scorecard as any, { setActiveTab, showErrorMessage });
        expect(valid).toBe(true);
        // No errors, so no tab switch or error message should occur
        expect(setActiveTab).not.toHaveBeenCalled();
        expect(showErrorMessage).not.toHaveBeenCalled();
        // No delayed actions should be queued
        expect(setTimeout).not.toHaveBeenCalled();
    });
});


