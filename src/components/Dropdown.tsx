import React, { useState, useRef, useEffect, ReactNode } from 'react';
import Tooltip from './Tooltip';

export interface DropdownOption {
    label: string;
    value: string;
    color: string;
    tooltip?: string;
}

interface DropdownProps {
    icon?: ReactNode;
    title: string;
    options: DropdownOption[];
    selectedOption?: DropdownOption;
    selectedOptions?: DropdownOption[];
    onChange: (option: DropdownOption | DropdownOption[]) => void;
    disabled?: boolean;
    disabledTooltip?: string;
    multiselect?: boolean;
    placeholder?: string;
}

const Dropdown: React.FC<DropdownProps> = ({
    icon,
    title,
    options,
    selectedOption,
    selectedOptions = [],
    onChange,
    disabled = false,
    disabledTooltip = "",
    multiselect = false,
    placeholder = "Select one or more options",
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Determine which options are selected based on mode
    const effectiveSelectedOptions = multiselect
        ? selectedOptions
        : (selectedOption ? [selectedOption] : []);

    // Check if an option is selected (for multiselect mode)
    const isSelected = (option: DropdownOption) => {
        return effectiveSelectedOptions.some(selected => selected.value === option.value);
    };

    const toggleDropdown = () => {
        if (disabled) return; // Don't toggle if disabled
        setShowDropdown(!showDropdown);
    };

    // Handle option selection based on mode
    const handleOptionSelect = (option: DropdownOption, e?: React.MouseEvent) => {
        // Stop event propagation if provided to prevent dropdown from closing in multiselect mode
        if (e) {
            e.stopPropagation();
        }

        if (multiselect) {
            // In multiselect mode, toggle the selection
            const updatedSelection = isSelected(option)
                ? effectiveSelectedOptions.filter(selected => selected.value !== option.value)
                : [...effectiveSelectedOptions, option];

            onChange(updatedSelection);
            // Don't close dropdown in multiselect mode
        } else {
            // In single select mode, select the option and close dropdown
            onChange(option);
            setShowDropdown(false);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Render dropdown's selectable portion with optional tooltip if disabled
    const renderDropdownSelectable = () => {
        const content = (
            <div
                className={`relative w-5/6 py-1.5 px-1.5 ${disabled ? 'opacity-70 cursor-default' : 'cursor-pointer'} ${showDropdown ? 'bg-gray-200 dark:bg-[#2A2A2A] rounded-t-md' : `${!disabled ? 'hover:bg-gray-200 dark:hover:bg-[#2A2A2A]' : ''} rounded-md`}`}
                ref={dropdownRef}
                onClick={toggleDropdown}
            >
                <div className={`inline-flex items-center ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
                    {effectiveSelectedOptions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {effectiveSelectedOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className="inline-flex items-center px-2 py-0.5 rounded-md"
                                    style={{ backgroundColor: option.color }}
                                >
                                    <span className="text-white text-sm">{option.label}</span>
                                    {multiselect && !disabled && (
                                        <button
                                            className="ml-1 text-white opacity-70 hover:opacity-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOptionSelect(option);
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-gray-500 dark:text-gray-400">{placeholder}</div>
                    )}
                </div>

                {showDropdown && !disabled && (
                    <div className="w-full absolute top-full left-0 z-50 w-64 bg-gray-100 border-t border-gray-300 dark:bg-[#1A1A1A] dark:border-[#3A3A3A] rounded-b-lg shadow-lg overflow-visible">
                        <div className="p-3">
                            <div className="space-y-0">
                                {options.map((option) => (
                                    <div key={option.value} className="mb-2 relative">
                                        {/* Option content */}
                                        <div
                                            className={`flex items-center px-2 py-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-[#2A2A2A] cursor-pointer transition-colors ${isSelected(option) && multiselect ? 'bg-gray-200 dark:bg-[#2A2A2A]' : ''}`}
                                            onClick={(e) => handleOptionSelect(option, e)}
                                        >
                                            {multiselect && (
                                                <div className="mr-2">
                                                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected(option) ? 'bg-blue-500 border-blue-500' : 'border-gray-400 dark:border-gray-500'}`}>
                                                        {isSelected(option) && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="inline-flex items-center px-2 py-0.5 rounded-md" style={{ backgroundColor: option.color }}>
                                                <span className="text-white text-sm">{option.label}</span>
                                            </div>
                                        </div>

                                        {/* Tooltip content displayed directly under the option */}
                                        {option.tooltip && (
                                            <div className="px-3 text-xs text-gray-600 dark:text-gray-400">
                                                {option.tooltip}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );

        // If disabled and has disabled tooltip, wrap in tooltip
        if (disabled && disabledTooltip) {
            return (
                <Tooltip content={disabledTooltip} position="right">
                    {content}
                </Tooltip>
            );
        }

        return content;
    };

    return (
        <div className="flex items-center text-gray-500 text-sm w-full">
            <span className="w-1/6 mr-2 flex items-center hover:bg-gray-200 dark:hover:bg-[#2A2A2A] px-3 py-2 rounded-md">
                {icon && <span className="mr-2">{icon}</span>}
                {title}
            </span>
            {renderDropdownSelectable()}
        </div>
    );
};

export default Dropdown; 