import { ScorecardTemplate } from "../../components/ScorecardPickerDialog";

export interface ValidationCallbacks {
    showErrorMessage?: (title: string, message: string, emoji?: string) => void;
}

/**
 * Validates scorecard criteria for empty names and descriptions
 * @param scorecard - The scorecard to validate
 * @param callbacks - Callbacks for showing error messages
 * @returns true if valid, false if invalid
 */
export const validateScorecardCriteria = (
    scorecard: ScorecardTemplate | undefined,
    callbacks: ValidationCallbacks
): boolean => {
    // If no scorecard or not a user-created scorecard (new), return true (valid)
    if (!scorecard) {
        return true;
    }

    const { showErrorMessage } = callbacks;

    // Check each criterion for empty name or description
    for (let i = 0; i < scorecard.criteria.length; i++) {
        const criterion = scorecard.criteria[i];

        // Check for empty name
        if (!criterion.name || criterion.name.trim() === '') {
            // Use a self-invoking function for delayed highlight and error message
            (function (index) {
                setTimeout(() => {
                    // Create event to highlight the problematic row
                    const event = new CustomEvent('highlight-criterion', {
                        detail: {
                            index,
                            field: 'name'
                        }
                    });
                    document.dispatchEvent(event);

                    // Show error message if callback is provided
                    if (showErrorMessage) {
                        showErrorMessage(
                            "Empty Scorecard Parameter",
                            `Please provide a name for parameter ${index + 1} in the scorecard`,
                            "🚫"
                        );
                    }
                }, 250);
            })(i);

            return false;
        }

        // Check for empty description
        if (!criterion.description || criterion.description.trim() === '') {
            // Use a self-invoking function for delayed highlight and error message
            (function (index, name) {
                setTimeout(() => {
                    // Create event to highlight the problematic row
                    const event = new CustomEvent('highlight-criterion', {
                        detail: {
                            index,
                            field: 'description'
                        }
                    });
                    document.dispatchEvent(event);

                    // Show error message if callback is provided
                    if (showErrorMessage) {
                        const parameterName = name || `parameter ${index + 1}`;
                        showErrorMessage(
                            "Empty Scorecard Parameter",
                            `Please provide a description for ${parameterName} in the scorecard`,
                            "🚫"
                        );
                    }
                }, 250);
            })(i, criterion.name);

            return false;
        }
    }

    // If all criteria passed validation
    return true;
};
