"use client";

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { FileText, Plus } from "lucide-react";
import ScorecardPickerDialog, { CriterionData, ScorecardTemplate } from "./ScorecardPickerDialog";
import Scorecard, { ScorecardHandle } from "./Scorecard";
import ConfirmationDialog from "./ConfirmationDialog";
import Toast from "./Toast";
import { validateScorecardCriteria as validateScorecardCriteriaUtil } from "../lib/utils/scorecardValidation";

export interface ScorecardManagerHandle {
    hasScorecard: () => boolean;
    validateScorecardCriteria: (scorecard: ScorecardTemplate | undefined, callbacks: { showErrorMessage?: (title: string, message: string, emoji?: string) => void }) => boolean;
    hasUnsavedScorecardChanges: () => boolean;
    handleScorecardChangesRevert: () => void;
    getScorecardData: () => ScorecardTemplate | undefined;
    setScorecardData: (data: ScorecardTemplate | undefined) => void;
}

interface ScorecardManagerProps {
    schoolId?: string;
    readOnly?: boolean;
    onScorecardChange?: (scorecardData: ScorecardTemplate | undefined) => void;
    initialScorecardData?: ScorecardTemplate;
    scorecardId?: string | number;
    className?: string;
    type?: 'quiz' | 'assignment';
    // Quiz-specific props
    allQuestions?: Array<{ id: string; config: { scorecardData?: ScorecardTemplate } }>; // For quiz context to show usage across questions
    currentQuestionIndex?: number; // For quiz context
}

const ScorecardManager = forwardRef<ScorecardManagerHandle, ScorecardManagerProps>(({
    schoolId,
    readOnly = false,
    onScorecardChange,
    initialScorecardData,
    scorecardId,
    className = "",
    type = 'quiz',
    allQuestions = []
}, ref) => {
    // State for school scorecards
    const [schoolScorecards, setSchoolScorecards] = useState<ScorecardTemplate[]>([]);
    // Add loading state for fetching scorecards
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isLoadingScorecards, setIsLoadingScorecards] = useState(false);

    // State to track original scorecard data for change detection
    const [originalScorecardData, setOriginalScorecardData] = useState<Map<string, { name: string, criteria: CriterionData[] }>>(new Map());
    // Add ref to track if we're currently saving a scorecard
    const isSavingScorecardRef = useRef(false);

    // Add toast state
    const [showToast, setShowToast] = useState(false);
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");
    const [toastEmoji, setToastEmoji] = useState("🚀");

    // State for scorecard templates dialog
    const [showScorecardDialog, setShowScorecardDialog] = useState(false);
    const [scorecardDialogPosition, setScorecardDialogPosition] = useState<{ top: number, left: number } | null>(null);
    const scorecardButtonRef = useRef<HTMLButtonElement>(null);

    // State for scorecard delete confirmation
    const [showScorecardDeleteConfirm, setShowScorecardDeleteConfirm] = useState(false);
    // State to track if scorecard is used by multiple items
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [scorecardUsedByMultiple, setScorecardUsedByMultiple] = useState(false);
    // State for scorecard save confirmation
    const [showScorecardSaveConfirm, setShowScorecardSaveConfirm] = useState(false);

    // Current scorecard data state
    const [scorecardData, setScorecardData] = useState<ScorecardTemplate | undefined>(initialScorecardData);

    // Reference to the scorecard component
    const scorecardRef = useRef<ScorecardHandle>(null);

    // Ref to track if we've already processed a specific scorecardId
    const processedScorecardIdRef = useRef<string | number | undefined>(undefined);

    // Add useEffect to automatically hide toast after 5 seconds
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => {
                setShowToast(false);
            }, 5000);

            // Cleanup the timer when component unmounts or showToast changes
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // Fetch school scorecards when component mounts
    useEffect(() => {
        const fetchSchoolScorecards = async () => {
            if (schoolId) {
                setIsLoadingScorecards(true);
                try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/scorecards/?org_id=${schoolId}`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch school scorecards');
                    }

                    const data = await response.json();

                    // Transform the API response to ScorecardTemplate format
                    if (data && Array.isArray(data)) {
                        const transformedScorecards = data.map(scorecard => ({
                            id: scorecard.id,
                            name: scorecard.title,
                            icon: <FileText size={16} className="text-white" />,
                            is_template: false, // Not a hard-coded template
                            new: scorecard.status === 'draft', // Not newly created in this session
                            criteria: scorecard.criteria.map((criterion: { name: string; description: string; max_score: number; min_score: number; pass_score: number }) => ({
                                name: criterion.name,
                                description: criterion.description,
                                maxScore: criterion.max_score,
                                minScore: criterion.min_score,
                                passScore: criterion.pass_score
                            })) || []
                        }));

                        setSchoolScorecards(transformedScorecards);
                    }
                } catch (error) {
                    console.error('Error fetching school scorecards:', error);
                } finally {
                    setIsLoadingScorecards(false);
                }
            }
        };

        fetchSchoolScorecards();
    }, [schoolId]);

    // Reset processed scorecard ID when scorecardId changes
    useEffect(() => {
        processedScorecardIdRef.current = undefined;
    }, [scorecardId]);

    // Fetch specific scorecard data when scorecardId is provided and school scorecards are loaded
    useEffect(() => {
        const fetchScorecardById = async () => {
            if (scorecardId && schoolScorecards.length > 0 && processedScorecardIdRef.current !== scorecardId) {
                // Find matching scorecard from school scorecards
                const matchingScorecard = schoolScorecards.find(sc =>
                    parseInt(sc.id) === parseInt(String(scorecardId))
                );

                if (matchingScorecard) {
                    const scorecardData: ScorecardTemplate = {
                        id: matchingScorecard.id,
                        name: matchingScorecard.name,
                        new: matchingScorecard.new,
                        is_template: matchingScorecard.is_template,
                        criteria: matchingScorecard.criteria.map(criterion => ({
                            ...criterion,
                            minScore: criterion.minScore
                        })),
                    };

                    setScorecardData(scorecardData);

                    // Add to original scorecard data for change detection
                    setOriginalScorecardData(prev => {
                        const updated = new Map(prev);
                        updated.set(scorecardData.id, {
                            name: scorecardData.name,
                            criteria: JSON.parse(JSON.stringify(scorecardData.criteria))
                        });
                        return updated;
                    });

                    // Mark this scorecardId as processed
                    processedScorecardIdRef.current = scorecardId;

                    // Notify parent component
                    if (onScorecardChange) {
                        onScorecardChange(scorecardData);
                    }
                }
            }
        };

        fetchScorecardById();
    }, [scorecardId, schoolScorecards, onScorecardChange]);

    // Add a reusable function for creating scorecards
    const createScorecard = useCallback(async (title: string, criteria: CriterionData[]): Promise<{ id: string; title: string }> => {
        if (!schoolId) {
            throw new Error('School ID is required to create scorecard');
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/scorecards/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: title,
                org_id: schoolId,
                criteria: criteria.map(criterion => ({
                    name: criterion.name,
                    description: criterion.description,
                    min_score: criterion.minScore,
                    max_score: criterion.maxScore,
                    pass_score: criterion.passScore
                }))
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to create scorecard: ${response.status}`);
        }

        return await response.json();
    }, [schoolId]);

    // Function to handle opening the scorecard templates dialog
    const handleOpenScorecardDialog = () => {
        const buttonElement = scorecardButtonRef.current;
        if (buttonElement) {
            const rect = buttonElement.getBoundingClientRect();

            // Approximate height of the dialog (templates + header)
            const estimatedDialogHeight = 380;

            // Position the bottom of the dialog above the button with some spacing
            setScorecardDialogPosition({
                top: Math.max(10, schoolScorecards.length > 0 ? rect.top - estimatedDialogHeight - 80 : rect.top - estimatedDialogHeight - 10), // Ensure at least 10px from top of viewport
                left: Math.max(10, rect.left - 40) // Center horizontally but ensure it's not off-screen
            });
            setShowScorecardDialog(true);
        }
    };

    // Function to handle creating a new scorecard
    const handleCreateNewScorecard = async () => {
        setShowScorecardDialog(false);

        const newScorecardTitle = type === 'assignment' ? "Key Areas" : "New Scorecard";

        // Scorecard title is handled by the Scorecard component

        try {
            // Use the reusable function to create scorecard
            const createdScorecard = await createScorecard(newScorecardTitle, [
                { name: '', description: '', minScore: 1, maxScore: 5, passScore: 3 }
            ]);

            // Create scorecard data using the backend ID
            const newScorecardData: ScorecardTemplate = {
                id: createdScorecard.id, // Use the ID returned from backend
                name: createdScorecard.title,
                new: true, // Mark as newly created in this session
                is_template: false, // Not a template
                criteria: [
                    { name: '', description: '', minScore: 1, maxScore: 5, passScore: 3 }
                ]
            };

            // Set the scorecard data
            setScorecardData(newScorecardData);

            // Update school scorecards state with new scorecard
            const updatedScorecards = [...schoolScorecards, newScorecardData];
            setSchoolScorecards(updatedScorecards);

            // Add the new scorecard to originalScorecardData as the baseline for change detection
            const updatedOriginalData = new Map(originalScorecardData);
            updatedOriginalData.set(newScorecardData.id, {
                name: newScorecardData.name,
                criteria: JSON.parse(JSON.stringify(newScorecardData.criteria))
            });
            setOriginalScorecardData(updatedOriginalData);

            // Focus on the scorecard title after a short delay to allow rendering
            setTimeout(() => {
                scorecardRef.current?.focusName();
            }, 100);

            // Notify parent component
            if (onScorecardChange) {
                onScorecardChange(newScorecardData);
            }

        } catch (error) {
            console.error('Error creating scorecard:', error);

            // Show error toast
            setToastTitle("Creation Failed");
            setToastMessage("Failed to create scorecard. Please try again.");
            setToastEmoji("❌");
            setShowToast(true);
        }
    };

    // Function to handle selecting a scorecard template
    const handleSelectScorecardTemplate = async (template: ScorecardTemplate) => {
        setShowScorecardDialog(false);

        // Scorecard title is handled by the Scorecard component

        let scorecard: ScorecardTemplate;

        if (template.is_template) {
            // Creating from a hardcoded template - use the reusable function
            try {
                const createdScorecard = await createScorecard(template.name, template.criteria);

                // Use the backend ID for the new scorecard
                scorecard = {
                    id: createdScorecard.id, // Use the ID returned from backend
                    name: createdScorecard.title,
                    new: true,
                    is_template: false,
                    criteria: template.criteria,
                };

                // Update school scorecards state with new scorecard
                const updatedScorecards = [...schoolScorecards, scorecard];
                setSchoolScorecards(updatedScorecards);
            } catch (error) {
                console.error('Error creating scorecard from template:', error);

                // Show error toast
                setToastTitle("Creation Failed");
                setToastMessage("Failed to create scorecard from template. Please try again.");
                setToastEmoji("❌");
                setShowToast(true);
                return;
            }
        } else {
            // one of the user generated scorecards - could be both published scorecards or newly created scorecards in this session itself
            scorecard = {
                id: template.id,
                name: template.name,
                new: template.new,
                is_template: false,
                criteria: template.criteria,
            };
        }

        // Add the new scorecard to originalScorecardData as the baseline for change detection
        const updatedOriginalData = new Map(originalScorecardData);
        updatedOriginalData.set(scorecard.id, {
            name: scorecard.name,
            criteria: JSON.parse(JSON.stringify(scorecard.criteria))
        });
        setOriginalScorecardData(updatedOriginalData);

        // Set the scorecard data
        setScorecardData(scorecard);

        // Notify parent component
        if (onScorecardChange) {
            onScorecardChange(scorecard);
        }

        // Focus on the scorecard title after a short delay to allow rendering
        if (scorecard.new) {
            setTimeout(() => {
                scorecardRef.current?.focusName();
            }, 100);
        }
    };

    // Function that actually performs the scorecard save operation
    const performScorecardSave = useCallback(async () => {
        if (!scorecardData || !schoolId || isSavingScorecardRef.current) {
            return;
        }

        isSavingScorecardRef.current = true;

        try {
            // Prepare the scorecard data for the API
            const scorecardPayload = {
                title: scorecardData.name,
                criteria: scorecardData.criteria.map(criterion => ({
                    name: criterion.name,
                    description: criterion.description,
                    min_score: criterion.minScore,
                    max_score: criterion.maxScore,
                    pass_score: criterion.passScore
                }))
            };

            // Make the API call to update the scorecard
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/scorecards/${scorecardData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scorecardPayload),
            });

            if (!response.ok) {
                throw new Error(`Failed to save scorecard: ${response.status}`);
            }

            // Create the new original data immediately
            const newOriginalData = {
                name: scorecardData.name,
                criteria: JSON.parse(JSON.stringify(scorecardData.criteria))
            };

            // Update the original scorecard data to reflect the saved state
            const updatedOriginalData = new Map(originalScorecardData);
            updatedOriginalData.set(scorecardData.id, newOriginalData);
            setOriginalScorecardData(updatedOriginalData);

            // Also update the ref immediately for synchronous access
            // This ensures that any immediate checks will see the updated data
            originalScorecardData.set(scorecardData.id, newOriginalData);

            // Show success toast if this is not a new scorecard
            if (scorecardData.new) {
                return;
            }

            setToastTitle("Scorecard Saved");
            setToastMessage("Scorecard has been updated successfully");
            setToastEmoji("✅");
            setShowToast(true);
        } catch (error) {
            console.error('Error saving scorecard:', error);

            // Show error toast
            setToastTitle("Save Failed");
            setToastMessage("Failed to save scorecard changes. Please try again.");
            setToastEmoji("❌");
            setShowToast(true);
        } finally {
            isSavingScorecardRef.current = false;
        }
    }, [scorecardData, schoolId, originalScorecardData]);

    // Function to handle saving published scorecard changes
    const handleSaveScorecardChanges = useCallback(async () => {
        if (!scorecardData || !schoolId || isSavingScorecardRef.current) {
            return;
        }

        // Don't ask for confirmation if this is a new scorecard
        if (scorecardData.new) {
            performScorecardSave();
            return;
        }

        // Show confirmation dialog instead of saving directly
        setShowScorecardSaveConfirm(true);
    }, [scorecardData, schoolId, performScorecardSave]);

    // Function to handle complete scorecard revert
    const handleScorecardRevert = useCallback(() => {
        if (!scorecardData) {
            return;
        }

        const scorecardId = scorecardData.id;
        const originalData = originalScorecardData.get(scorecardId);

        if (!originalData) {
            return; // No original data to revert to
        }

        // Create the reverted scorecard data
        const revertedScorecardData = {
            ...scorecardData,
            name: originalData.name,
            criteria: [...originalData.criteria]
        };

        // Update the scorecard data atomically
        setScorecardData(revertedScorecardData);

        // Update the scorecard in schoolScorecards state
        const updatedScorecards = schoolScorecards.map(sc =>
            sc.id === scorecardId ? { ...sc, name: originalData.name, criteria: [...originalData.criteria] } : sc
        );
        setSchoolScorecards(updatedScorecards);

        // Notify parent component
        if (onScorecardChange) {
            onScorecardChange(revertedScorecardData);
        }
    }, [scorecardData, originalScorecardData, schoolScorecards, onScorecardChange]);

    // Function to remove scorecard from current item
    const removeScorecardFromCurrentItem = useCallback(() => {
        setScorecardData(undefined);

        // Notify parent component
        if (onScorecardChange) {
            onScorecardChange(undefined);
        }
    }, [onScorecardChange]);

    // Function to check for unsaved scorecard changes
    const checkUnsavedScorecardChanges = useCallback(() => {
        if (!scorecardData) {
            return false;
        }

        const scorecardId = scorecardData.id;
        const originalData = originalScorecardData.get(scorecardId);

        // If this is a new scorecard (not in original data), skip the check
        if (!originalData) {
            return false;
        }

        // Check if scorecard name has changed
        if (scorecardData.name !== originalData.name) {
            return true;
        }

        // Check if criteria have changed
        const currentCriteria = scorecardData.criteria;
        const originalCriteria = originalData.criteria;

        // Check if criteria length has changed
        if (currentCriteria.length !== originalCriteria.length) {
            return true;
        }

        // Check if any criterion has changed
        for (let j = 0; j < currentCriteria.length; j++) {
            const current = currentCriteria[j];
            const original = originalCriteria[j];

            if (!original) {
                return true;
            }

            if (current.name !== original.name ||
                current.description !== original.description ||
                current.minScore !== original.minScore ||
                current.maxScore !== original.maxScore) {
                return true;
            }
        }

        return false; // No unsaved changes found
    }, [scorecardData, originalScorecardData]);

    // Function to validate scorecard criteria for empty names and descriptions
    const validateScorecardCriteria = (
        scorecard: ScorecardTemplate | undefined,
        callbacks: {
            showErrorMessage?: (title: string, message: string, emoji?: string) => void;
        }
    ): boolean => {
        return validateScorecardCriteriaUtil(scorecard, callbacks);
    };

    // Function to validate if a question has a valid scorecard attached
    const validateScorecard = useCallback((scorecard: ScorecardTemplate | undefined) => {
        return !!(scorecard &&
            scorecard.criteria &&
            scorecard.criteria.length > 0);
    }, []);

    // Function to check if scorecard is linked (not new and not template)
    const isLinkedScorecard = (scorecard: ScorecardTemplate): boolean => {
        if (scorecard.new) return false;
        return !scorecard.is_template;
    };

    // Function to handle scorecard name change
    const handleScorecardNameChange = useCallback((newName: string) => {
        if (!scorecardData) {
            return;
        }

        const updatedScorecardData = {
            ...scorecardData,
            name: newName
        };

        setScorecardData(updatedScorecardData);

        // Update the scorecard in schoolScorecards state
        const updatedScorecards = schoolScorecards.map(sc =>
            sc.id === scorecardData.id ? { ...sc, name: newName } : sc
        );
        setSchoolScorecards(updatedScorecards);

        // Notify parent component
        if (onScorecardChange) {
            onScorecardChange(updatedScorecardData);
        }
    }, [scorecardData, schoolScorecards, onScorecardChange]);

    // Function to handle scorecard criteria change
    const handleScorecardCriteriaChange = useCallback((updatedCriteria: CriterionData[]) => {
        if (!scorecardData) {
            return;
        }

        const updatedScorecardData = {
            ...scorecardData,
            criteria: updatedCriteria
        };

        setScorecardData(updatedScorecardData);

        // Update the scorecard in schoolScorecards state
        const updatedScorecards = schoolScorecards.map(sc =>
            sc.id === scorecardData.id ? { ...sc, criteria: updatedCriteria } : sc
        );
        setSchoolScorecards(updatedScorecards);

        // Notify parent component
        if (onScorecardChange) {
            onScorecardChange(updatedScorecardData);
        }
    }, [scorecardData, schoolScorecards, onScorecardChange]);

    // Function to handle scorecard duplication
    const handleScorecardDuplicate = useCallback(async () => {
        if (!scorecardData) {
            return;
        }

        const originalScorecard = scorecardData;

        try {
            // Use the reusable function to create duplicated scorecard
            const createdScorecard = await createScorecard(
                `${originalScorecard.name} (Copy)`,
                originalScorecard.criteria
            );

            // Create a duplicate scorecard with the backend ID
            const duplicatedScorecard: ScorecardTemplate = {
                id: createdScorecard.id, // Use the ID returned from backend
                name: createdScorecard.title,
                new: true, // Mark as newly created to make it unlinked
                is_template: false,
                criteria: [...originalScorecard.criteria] // Deep copy the criteria
            };

            // Set the duplicated scorecard
            setScorecardData(duplicatedScorecard);

            // Add the duplicated scorecard to school scorecards
            const updatedScorecards = [...schoolScorecards, duplicatedScorecard];
            setSchoolScorecards(updatedScorecards);

            // Add the new scorecard to originalScorecardData as the baseline for change detection
            const updatedOriginalData = new Map(originalScorecardData);
            updatedOriginalData.set(duplicatedScorecard.id, {
                name: duplicatedScorecard.name,
                criteria: JSON.parse(JSON.stringify(duplicatedScorecard.criteria))
            });
            setOriginalScorecardData(updatedOriginalData);

            // Focus on the scorecard name for editing
            setTimeout(() => {
                scorecardRef.current?.focusName();
            }, 100);

            // Notify parent component
            if (onScorecardChange) {
                onScorecardChange(duplicatedScorecard);
            }

        } catch (error) {
            console.error('Error duplicating scorecard:', error);

            // Show error toast
            setToastTitle("Duplication Failed");
            setToastMessage("Failed to duplicate scorecard. Please try again.");
            setToastEmoji("❌");
            setShowToast(true);
        }
    }, [scorecardData, schoolScorecards, originalScorecardData, onScorecardChange, createScorecard]);

    // Expose methods to parent component via the ref
    useImperativeHandle(ref, () => ({
        hasScorecard: () => validateScorecard(scorecardData),
        validateScorecardCriteria: (scorecard: ScorecardTemplate | undefined, callbacks: { showErrorMessage?: (title: string, message: string, emoji?: string) => void }) =>
            validateScorecardCriteria(scorecard, callbacks),
        hasUnsavedScorecardChanges: checkUnsavedScorecardChanges,
        handleScorecardChangesRevert: handleScorecardRevert,
        getScorecardData: () => scorecardData,
        setScorecardData: (data: ScorecardTemplate | undefined) => {
            setScorecardData(data);
            if (onScorecardChange) {
                onScorecardChange(data);
            }
        }
    }));

    return (
        <div className={`h-full ${className}`}>
            {/* Scorecard delete confirmation modal */}
            <ConfirmationDialog
                show={showScorecardDeleteConfirm}
                title="Remove scorecard"
                message={type === 'quiz'
                    ? "Are you sure you want to remove this scorecard from this question? This will not affect other questions using this scorecard."
                    : "Are you sure you want to remove this scorecard from this item? This will not affect other items using this scorecard."
                }
                onConfirm={() => {
                    removeScorecardFromCurrentItem();
                    setShowScorecardDeleteConfirm(false);
                }}
                onCancel={() => setShowScorecardDeleteConfirm(false)}
                type="delete"
                confirmButtonText="Remove"
            />

            {/* Scorecard save confirmation modal */}
            <ConfirmationDialog
                show={showScorecardSaveConfirm}
                onConfirm={() => {
                    performScorecardSave();
                    setShowScorecardSaveConfirm(false);
                }}
                title="Are you sure you want to save?"
                message={type === 'quiz'
                    ? "These changes will be applied to all questions across quizzes using this scorecard. If you want to make changes only to this question, you can duplicate the scorecard and add your changes there."
                    : "These changes will be applied to all items using this scorecard. If you want to make changes only to this item, you can duplicate the scorecard and add your changes there."
                }
                onCancel={() => setShowScorecardSaveConfirm(false)}
                type="save"
                isLoading={isSavingScorecardRef.current}
            />

            {/* Scorecard Templates Dialog */}
            <ScorecardPickerDialog
                key={`scorecard-picker-${schoolScorecards.length}`}
                isOpen={showScorecardDialog}
                onClose={() => setShowScorecardDialog(false)}
                onCreateNew={handleCreateNewScorecard}
                onSelectTemplate={handleSelectScorecardTemplate}
                position={scorecardDialogPosition || undefined}
                schoolScorecards={schoolScorecards}
            />

            {/* Toast for notifications */}
            <Toast
                show={showToast}
                title={toastTitle}
                description={toastMessage}
                emoji={toastEmoji}
                onClose={() => setShowToast(false)}
            />

            {/* Scorecard Content */}
            {scorecardData ? (
                <div className="h-full overflow-y-auto">
                    <Scorecard
                        ref={scorecardRef}
                        name={scorecardData.name}
                        criteria={scorecardData.criteria}
                        onDelete={() => {
                            // For quiz context, check if scorecard is used by multiple questions
                            if (type === 'quiz' && allQuestions.length > 0) {
                                const questionsUsingThisScorecard = allQuestions.filter(q =>
                                    q.config.scorecardData && q.config.scorecardData.id === scorecardData.id
                                );
                                setScorecardUsedByMultiple(questionsUsingThisScorecard.length > 1);
                            } else {
                                setScorecardUsedByMultiple(false); // Single item, not used by multiple
                            }
                            setShowScorecardDeleteConfirm(true);
                        }}
                        new={scorecardData.new}
                        readOnly={readOnly}
                        linked={isLinkedScorecard(scorecardData)}
                        scorecardId={scorecardData.id}
                        allQuestions={type === 'quiz' ? allQuestions : [{ id: "assignment", config: { scorecardData: scorecardData } }]}
                        onSave={handleSaveScorecardChanges}
                        originalName={scorecardData.id ? originalScorecardData.get(scorecardData.id)?.name : undefined}
                        originalCriteria={scorecardData.id ? originalScorecardData.get(scorecardData.id)?.criteria : undefined}
                        onRevert={handleScorecardRevert}
                        onDuplicate={handleScorecardDuplicate}
                        onNameChange={handleScorecardNameChange}
                        onChange={handleScorecardCriteriaChange}
                    />
                </div>
            ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="max-w-md">
                            <h3 className="text-xl font-light text-white mb-3">
                                {type === 'assignment' ? 'What are evaluation criteria?' : 'What is a scorecard?'}
                            </h3>
                            <p className="text-gray-400 mb-6">
                                {type === 'assignment'
                                    ? 'Define parameters used to evaluate open-ended responses. Use a template or create your own.'
                                    : 'A scorecard is a set of parameters used to grade the answer to an open-ended question - either use one of our templates or create your own'
                                }
                            </p>
                            <button
                                className="flex items-center px-5 py-2.5 text-sm text-black bg-white hover:bg-gray-100 rounded-md transition-colors cursor-pointer mx-auto"
                                ref={scorecardButtonRef}
                                onClick={handleOpenScorecardDialog}
                                disabled={readOnly}
                            >
                                <div className="w-5 h-5 rounded-full border border-black flex items-center justify-center mr-2">
                                    <Plus size={12} className="text-black" />
                                </div>
                                {type === 'assignment' ? 'Add evaluation criteria' : 'Add a scorecard'}
                            </button>
                    </div>
                </div>
            )}
        </div>
    );
});

ScorecardManager.displayName = "ScorecardManager";

export default ScorecardManager;
