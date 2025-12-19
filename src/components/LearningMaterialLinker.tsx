"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, X, Search, Plus } from "lucide-react";

// Define the LearningMaterial interface
export interface LearningMaterial {
    id: number;
    title: string;
    type: string;
    status: string;
}

// Define props for the component
export interface LearningMaterialLinkerProps {
    courseId: string;
    linkedMaterialIds: string[];
    readOnly?: boolean;
    onMaterialsChange: (linkedMaterialIds: string[]) => void;
}

const LearningMaterialLinker = ({
    courseId,
    linkedMaterialIds = [],
    readOnly = false,
    onMaterialsChange,
}: LearningMaterialLinkerProps) => {
    // State variables for learning material selection
    const [availableLearningMaterials, setAvailableLearningMaterials] = useState<LearningMaterial[]>([]);
    const [selectedLearningMaterials, setSelectedLearningMaterials] = useState<LearningMaterial[]>([]);
    const [learningMaterialSearchQuery, setLearningMaterialSearchQuery] = useState('');
    const [filteredLearningMaterials, setFilteredLearningMaterials] = useState<LearningMaterial[]>([]);
    const [isLearningMaterialDropdownOpen, setIsLearningMaterialDropdownOpen] = useState(false);
    const [isLoadingLearningMaterials, setIsLoadingLearningMaterials] = useState(false);
    const learningMaterialDropdownRef = useRef<HTMLDivElement>(null);

    // Effect to handle clicks outside the dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;

            if (
                learningMaterialDropdownRef.current &&
                !learningMaterialDropdownRef.current.contains(target) &&
                !(target as Element).closest('[data-learning-material-dropdown="true"]')
            ) {
                setIsLearningMaterialDropdownOpen(false);
            }
        }

        if (isLearningMaterialDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isLearningMaterialDropdownOpen]);

    // Fetch learning materials when component mounts or linkedMaterialIds change
    useEffect(() => {
        if (linkedMaterialIds && linkedMaterialIds.length > 0) {
            // When question changes, fetch linked materials if there are any linked IDs
            fetchLinkedMaterials();
        } else {
            // Reset selections when there are no linked materials
            setSelectedLearningMaterials([]);
        }
    }, [courseId, linkedMaterialIds]);

    // Function to fetch learning materials
    const fetchLearningMaterials = async () => {
        setIsLoadingLearningMaterials(true);
        try {
            // Use the courseId from props
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/course/${courseId}/learning_material`
            );
            if (!response.ok) {
                throw new Error(`Failed to fetch learning materials: ${response.status}`);
            }
            const data: LearningMaterial[] = await response.json();

            // Filter to only include published learning materials
            const publishedMaterials = data.filter(material => material.status === "published");

            // Filter out already selected materials
            const availableMaterials = publishedMaterials.filter(
                material => !linkedMaterialIds.includes(material.id.toString())
            );

            setAvailableLearningMaterials(publishedMaterials);
            setFilteredLearningMaterials(availableMaterials);
        } catch (error) {
            console.error("Error fetching learning materials:", error);
        } finally {
            setIsLoadingLearningMaterials(false);
        }
    };

    // Function to fetch linked materials
    const fetchLinkedMaterials = async () => {
        setIsLoadingLearningMaterials(true);
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/course/${courseId}/learning_material`
            );
            if (!response.ok) {
                throw new Error(`Failed to fetch learning materials: ${response.status}`);
            }
            const data: LearningMaterial[] = await response.json();

            // Filter to get only the linked materials (convert string IDs to numbers for comparison)
            const linkedMaterials = data.filter(material =>
                linkedMaterialIds.includes(material.id.toString())
            );

            setSelectedLearningMaterials(linkedMaterials);

            // Set available materials excluding the linked ones
            const publishedMaterials = data.filter(
                material =>
                    material.status === "published" &&
                    !linkedMaterialIds.includes(material.id.toString())
            );

            setFilteredLearningMaterials(publishedMaterials);
        } catch (error) {
            console.error("Error fetching linked learning materials:", error);
        } finally {
            setIsLoadingLearningMaterials(false);
        }
    };

    // Function to handle learning material search
    const handleLearningMaterialSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setLearningMaterialSearchQuery(query);

        if (availableLearningMaterials.length > 0) {
            if (query.trim() === "") {
                // Show all available materials that aren't already selected
                setFilteredLearningMaterials(
                    availableLearningMaterials.filter(
                        material => !selectedLearningMaterials.some(selected => selected.id === material.id)
                    )
                );
            } else {
                // Filter by title AND exclude already selected materials
                const filtered = availableLearningMaterials.filter(
                    material =>
                        material.title.toLowerCase().includes(query.toLowerCase()) &&
                        !selectedLearningMaterials.some(selected => selected.id === material.id)
                );
                setFilteredLearningMaterials(filtered);
            }
        }
    };

    // Function to select a learning material
    const selectLearningMaterial = (material: LearningMaterial) => {
        // Check if already selected
        if (selectedLearningMaterials.some(m => m.id === material.id)) {
            return; // Already selected, do nothing
        }

        // Add to selection
        const newSelectedMaterials = [...selectedLearningMaterials, material];
        setSelectedLearningMaterials(newSelectedMaterials);

        // Remove from filtered materials immediately for better UX
        setFilteredLearningMaterials(prev => prev.filter(m => m.id !== material.id));

        // Update parent component with the new IDs
        const newLinkedIds = newSelectedMaterials.map(m => m.id.toString());
        onMaterialsChange(newLinkedIds);
    };

    // Function to remove a learning material
    const removeLearningMaterial = (materialId: number) => {
        // Find the material to remove
        const materialToRemove = selectedLearningMaterials.find(material => material.id === materialId);

        // Remove from selection
        const newSelectedMaterials = selectedLearningMaterials.filter(material => material.id !== materialId);
        setSelectedLearningMaterials(newSelectedMaterials);

        // Add back to filtered materials if it matches the current search
        if (
            materialToRemove &&
            (learningMaterialSearchQuery.trim() === "" ||
                materialToRemove.title.toLowerCase().includes(learningMaterialSearchQuery.toLowerCase()))
        ) {
            setFilteredLearningMaterials(prev => [...prev, materialToRemove]);
        }

        // Update parent component with the new IDs
        const newLinkedIds = newSelectedMaterials.map(m => m.id.toString());
        onMaterialsChange(newLinkedIds);
    };

    // Function to toggle the dropdown
    const toggleLearningMaterialDropdown = () => {
        const newState = !isLearningMaterialDropdownOpen;
        setIsLearningMaterialDropdownOpen(newState);

        if (newState) {
            // Fetch learning materials when opening the dropdown
            fetchLearningMaterials();
            // Reset search query when opening the dropdown
            setLearningMaterialSearchQuery('');
        }
    };

    // Render the read-only view for linked materials
    const renderReadOnlyView = () => {
        if (selectedLearningMaterials.length === 0) {
            return null;
        }

        return (
            <div>
                <div className="flex flex-wrap gap-2">
                    {selectedLearningMaterials.map(material => (
                        <div
                            key={material.id}
                            className="flex items-center bg-[#222] px-3 py-1 rounded-full"
                        >
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center mr-2 ${material.id % 5 === 0 ? "bg-blue-900" :
                                material.id % 5 === 1 ? "bg-purple-900" :
                                    material.id % 5 === 2 ? "bg-green-900" :
                                        material.id % 5 === 3 ? "bg-amber-900" :
                                            "bg-rose-900"
                                }`}>
                                <FileText size={12} className="text-white" />
                            </div>
                            <span className="text-white text-sm font-light">{material.title}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Render the editable view with dropdown
    const renderEditableView = () => {
        return (
            <div>
                <div className={`relative w-md ${isLearningMaterialDropdownOpen ? 'shadow-xl' : ''}`}>
                    <button
                        data-learning-material-dropdown="true"
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-orange-200 dark:bg-orange-300 text-black text-sm font-light rounded-md hover:bg-orange-300 hover:dark:bg-orange-400 transition-colors cursor-pointer mb-3"
                        onClick={toggleLearningMaterialDropdown}
                    >
                        <Plus size={16} />
                        <span>Link learning material</span>
                    </button>

                    {isLearningMaterialDropdownOpen && (
                        <div
                            ref={learningMaterialDropdownRef}
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute top-full left-0 mt-1 py-2 w-full rounded-lg shadow-xl z-50 ${isLearningMaterialDropdownOpen ? '' : ''} bg-white text-gray-900 dark:bg-[#1A1A1A] dark:text-white`}
                        >
                            <div className="px-4 pb-2">
                                {/* Add Close Button */}
                                <div className="flex justify-end mb-2">
                                    <button
                                        onClick={toggleLearningMaterialDropdown}
                                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-[#333] rounded-full transition-colors cursor-pointer"
                                        aria-label="Close dropdown"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                {availableLearningMaterials.length > 0 && (
                                    <div className="relative focus:outline-none">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search size={14} className="text-gray-400 dark:text-gray-500" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search by name"
                                            className="w-full rounded-md pl-9 pr-3 py-2 bg-white text-black border border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:bg-[#111] dark:text-white dark:border-gray-700 dark:focus:ring-gray-600"
                                            value={learningMaterialSearchQuery}
                                            onChange={handleLearningMaterialSearch}
                                        />
                                    </div>
                                )}

                                {/* Display selected learning materials */}
                                {selectedLearningMaterials.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedLearningMaterials.map(material => (
                                            <div
                                                key={material.id}
                                                className="flex items-center bg-[#222] px-3 py-1 rounded-full"
                                            >
                                                <span className="text-white text-sm font-light mr-2">{material.title}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeLearningMaterial(material.id);
                                                    }}
                                                    className="text-gray-400 hover:text-white cursor-pointer"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="max-h-48 overflow-y-auto py-2 px-2">
                                {isLoadingLearningMaterials ? (
                                    <div className="flex justify-center items-center py-4">
                                        <div className="w-6 h-6 border-2 border-t-purple-500 border-r-purple-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : filteredLearningMaterials.length === 0 ? (
                                    <div className="p-4 text-center">
                                        {availableLearningMaterials.length === 0 ? (
                                            // No learning materials available at all
                                            <>
                                                <h3 className="text-lg font-light mb-1">No learning materials available</h3>
                                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                                    Create learning materials in this course first to link them here
                                                </p>
                                            </>
                                        ) : selectedLearningMaterials.length > 0 && filteredLearningMaterials.length === 0 ? (
                                            // All materials have been selected
                                            <>
                                                <h3 className="text-lg font-light mb-1">All materials selected</h3>
                                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                                    You have selected all available learning materials
                                                </p>
                                            </>
                                        ) : (
                                            // No matches for search term
                                            <>
                                                <h3 className="text-lg font-light mb-1">No match found</h3>
                                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                                    Try a different search term
                                                </p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-0.5">
                                        {filteredLearningMaterials.map(material => (
                                            <div
                                                key={material.id}
                                                className="flex items-center px-3 py-1.5 hover:bg-[#222] rounded-md cursor-pointer"
                                                onClick={() => selectLearningMaterial(material)}
                                            >
                                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center mr-2 ${material.id % 5 === 0 ? "bg-blue-900" :
                                                        material.id % 5 === 1 ? "bg-purple-900" :
                                                            material.id % 5 === 2 ? "bg-green-900" :
                                                                material.id % 5 === 3 ? "bg-amber-900" :
                                                                    "bg-rose-900"
                                                    }`}>
                                                    <FileText size={14} className="text-white" />
                                                </div>
                                                <p className="text-sm font-light text-gray-900 dark:text-white">{material.title}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Display selected learning materials outside dropdown */}
                {selectedLearningMaterials.length > 0 && !isLearningMaterialDropdownOpen && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {selectedLearningMaterials.map(material => (
                            <div
                                key={material.id}
                                className="flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-900 dark:bg-[#222] dark:text-white"
                            >
                                <span className="text-sm font-light mr-2">{material.title}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeLearningMaterial(material.id);
                                    }}
                                    className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Conditional rendering based on readOnly prop
    return readOnly ? renderReadOnlyView() : renderEditableView();
};

export default LearningMaterialLinker; 