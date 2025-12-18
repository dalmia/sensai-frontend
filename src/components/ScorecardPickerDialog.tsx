import React, { useState, useRef } from 'react';
import { X, Plus, Check, FileText, Mic } from 'lucide-react';

export interface CriterionData {
    name: string;
    description: string;
    maxScore: number;
    minScore: number;
    passScore: number;
}

interface Scorecard {
    id: string;
    name: string;
    status?: string;
    criteria: CriterionData[];
}

export interface ScorecardTemplate extends Scorecard {
    icon?: React.ReactNode;
    description?: string;
    is_template?: boolean; // Identifies hard-coded templates
    new: boolean; // Identifies user-created scorecards in current session
}

interface ScorecardTemplatesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateNew: () => void;
    onSelectTemplate: (template: ScorecardTemplate) => void;
    position?: { top: number; left: number };
    schoolScorecards?: ScorecardTemplate[]; // New prop for school-specific scorecards
    type?: 'quiz' | 'assignment'; // Type to determine if this is for quiz or assignment
}

// Tab type for the dialog
type TabType = 'yours' | 'templates';

// Preview component to show on hover - now matching the Issue Tracking design
const TemplatePreview: React.FC<{ template: ScorecardTemplate; templateElement: HTMLDivElement | null; type?: 'user' | 'standard' }> = ({ template, templateElement, type = 'standard' }) => {
    // Get the template-specific data or use defaults
    const getStatusPills = () => {
        if (template.id === 'issue-tracking') {
            return ['Backlog', 'Open', 'In progress'];
        }
        // Default status pills for other templates
        return ['Status 1', 'Status 2', 'Status 3'];
    };

    const statusPills = getStatusPills();

    // Default criteria if not provided
    const criteria = template.criteria || [
        { name: "Grammar", maxScore: 5 },
        { name: "Relevance", maxScore: 5 },
        { name: "Confidence", maxScore: 5 }
    ];

    // Calculate position based on template position in the viewport
    const previewStyle = React.useMemo(() => {
        if (!templateElement) {
            // Default positioning
            return { left: '100%', marginLeft: '10px', top: '0' };
        }

        const templateRect = templateElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const previewHeight = 350; // Approximate height of preview

        // Calculate available space below the template
        const spaceBelow = viewportHeight - templateRect.top;

        // Always position on the right side (outside the dialog)
        const horizontalPosition = { left: '100%', marginLeft: '10px' };

        // If there's not enough space below, position from bottom up
        if (spaceBelow < previewHeight) {
            return {
                ...horizontalPosition,
                bottom: '0',
                top: 'auto'
            };
        }

        // Otherwise position from top down (default)
        return {
            ...horizontalPosition,
            top: '0',
            bottom: 'auto'
        };
    }, [templateElement]);

    return (
        <div className="absolute z-[100] w-[350px] bg-[#2F2F2F] rounded-lg shadow-xl p-2" style={previewStyle}>
            {/* Header with name */}
            <div className="p-5 pb-3 bg-[#1F1F1F] mb-2">
                <div className="flex items-center mb-4">
                    {template.icon && (
                        <div className="w-6 h-6 bg-[#712828] rounded flex items-center justify-center mr-2">
                            {template.icon}
                        </div>
                    )}
                    <h3 className="text-white text-lg font-normal">{template.name}</h3>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-3 gap-2 mb-2 text-xs text-gray-300">
                    <div className="px-2">Parameter</div>
                    <div className="px-2">Description</div>
                    <div className="px-2">Maximum</div>
                </div>

                {/* Table rows */}
                <div className="space-y-2 mb-3">
                    {criteria.map((criterion, index) => {
                        // Generate a unique background color for each criterion pill
                        const pillColors = ["#5E3B5D", "#3B5E4F", "#3B4E5E", "#5E3B3B", "#4F5E3B"];
                        const pillColor = pillColors[index % pillColors.length];

                        return (
                            <div key={index} className="grid grid-cols-3 gap-2 bg-[#2A2A2A] rounded-md p-1 text-white">
                                <div className="px-2 py-1 text-sm flex items-center">
                                    <span
                                        className="inline-block px-2 py-0.5 rounded-full text-xs text-white truncate"
                                        style={{ backgroundColor: pillColor }}
                                    >
                                        {criterion.name}
                                    </span>
                                </div>
                                <div className="px-2 py-1 flex items-center">
                                    <div className="h-3 bg-[#333] rounded w-full"></div>
                                </div>
                                <div className="px-2 py-1 text-sm text-center">{criterion.maxScore}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Description text - show for both standard and user types */}
            {template.description && (
                <p className="text-white text-sm font-normal px-1">{template.description}</p>
            )}
        </div>
    );
};

const ScorecardPickerDialog: React.FC<ScorecardTemplatesDialogProps> = ({
    isOpen,
    onClose,
    onCreateNew,
    onSelectTemplate,
    position,
    schoolScorecards = [],
    type = 'quiz'
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>(() =>
        schoolScorecards.length > 0 ? 'yours' : 'templates'
    );

    // Define quiz template options
    const quizTemplates: ScorecardTemplate[] = [
        {
            id: 'written-communication',
            name: 'Written Communication',
            icon: <Check size={16} className="text-white" />,
            description: "Assess written communication skills",
            is_template: true, // This is a hard-coded template
            criteria: [
                { name: "Relevance", description: "How relevant is the content to the task?", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Grammar", description: "How grammatically correct is the content? Check for grammar, punctuation, syntax and tense errors.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Clarity", description: "How clear is the content? Check for structure, organization, and readability.", maxScore: 5, minScore: 1, passScore: 3 }
            ],
            new: false
        },
        {
            id: 'interview-prep',
            name: 'Interview Preparation',
            icon: <Mic size={16} className="text-white" />,
            description: "Assess the quality of interviewing skills",
            is_template: true, // This is a hard-coded template
            criteria: [
                { name: "Relevance", description: "How relevant is the content to the question posed to them?", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Fluency", description: "How fluently does the candidate speak? Their pace should be neither slow nor fast but at a regular speaking speed. They should not use filler speech or pause frequently.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Confidence", description: "How confident does the candidate sound? The tone should be confident and not hesitant. Check for nervous pauses or stutters.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Pronunciation", description: "How well does the candidate pronounce the words? Their pronunciation should be clear and coherent. The words must be intelligible.", maxScore: 5, minScore: 1, passScore: 3 }
            ],
            new: false
        },
        {
            id: 'product-pitch',
            name: 'Product Pitch',
            icon: <FileText size={16} className="text-white" />,
            description: "Assess a product pitch",
            is_template: true, // This is a hard-coded template
            criteria: [
                { name: "Problem", description: "How clearly does the pitch identify the problem being solved?", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Value", description: "How compelling is the value proposition for the target audience?", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Clarity", description: "How clear and concise is the overall pitch?", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Engagement", description: "How engaging and persuasive is the delivery of the pitch?", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Market Fit", description: "How well does the pitch demonstrate product-market fit?", maxScore: 5, minScore: 1, passScore: 3 }
            ],
            new: false
        },
        // {
        //     id: 'written-communication2',
        //     name: 'Written Communication',
        //     icon: <Check size={16} className="text-white" />,
        //     description: "Assess the quality of written communication",
        //     criteria: [
        //         { name: "Relevance", description: "How relevant is the content to the task?", maxScore: 5, passScore: 3 },
        //         { name: "Grammar", description: "How grammatically correct is the content? Check for grammar, punctuation, syntax and tense errors.", maxScore: 5, passScore: 3 },
        //         { name: "Clarity", description: "How clear is the content? Check for structure, organization, and readability.", maxScore: 5, passScore: 3 }
        //     ]
        // },
        // {
        //     id: 'interview-prep3',
        //     name: 'Interview Preparation',
        //     icon: <Sparkles size={16} className="text-white" />,
        //     description: "Assess the quality of interviewing skills",
        //     criteria: [
        //         { name: "Relevance", description: "How relevant is the content to the question posed to them?", maxScore: 5, passScore: 3 },
        //         { name: "Fluency", description: "How fluently does the candidate speak? Their pace should be neither slow nor fast but at a regular speaking speed. They should not use filler speech or pause frequently.", maxScore: 5, passScore: 3 },
        //         { name: "Confidence", description: "How confident does the candidate sound? The tone should be confident and not hesitant. Check for nervous pauses or stutters.", maxScore: 5, passScore: 3 },
        //         { name: "Pronunciation", description: "How well does the candidate pronounce the words? Their pronunciation should be clear and coherent. The words must be intelligible.", maxScore: 5, passScore: 3 }
        //     ]
        // },
    ];

    const assignmentTemplates: ScorecardTemplate[] = [
        {
            id: 'assignment-submission',
            name: 'Assignment Submission',
            icon: <FileText size={16} className="text-white" />,
            description: "General rubric to evaluate student submissions to open-ended assignment questions",
            is_template: true,
            criteria: [
                { name: "Understanding of the Problem", description: "Checks if the assignment correctly interprets what the problem is asking and focuses on the right objective.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Approach and Reasoning", description: "Checks if the assignment outlines a clear, logical approach and explains why that approach was chosen.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Implementation Details", description: "Checks if the assignment covers the important steps, structures, or components needed to implement the solution.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Edge Cases and Constraints", description: "Checks if the assignment considers edge cases, limitations, performance, or constraints that might affect the solution.", maxScore: 5, minScore: 1, passScore: 3 },
            ],
            new: false
        },
        {
            id: 'python-programming-assignment',
            name: 'Python Programming',
            icon: <FileText size={16} className="text-white" />,
            description: "Evaluate Python coding assignments with a focus on correctness, style, and problem solving",
            is_template: true,
            criteria: [
                { name: "Correctness", description: "Checks if the code produces the expected output for typical and edge case inputs.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Code Quality", description: "Checks if the code follows Python best practices, is readable, and avoids unnecessary complexity.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Problem Decomposition", description: "Checks if the solution is broken down into clear functions or logical steps.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Testing and Edge Cases", description: "Checks if the student has considered edge cases and validated their solution.", maxScore: 5, minScore: 1, passScore: 3 },
            ],
            new: false
        },
        {
            id: 'web-development-assignment',
            name: 'Web Development',
            icon: <FileText size={16} className="text-white" />,
            description: "Evaluate frontend or full-stack web development assignments",
            is_template: true,
            criteria: [
                { name: "Functionality", description: "Checks if the core features work as described in the assignment requirements.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Code Structure", description: "Checks if the project is organized logically with clear separation of concerns.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "User Experience", description: "Checks if the interface is usable, responsive, and visually coherent.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Performance and Reliability", description: "Checks if the app loads efficiently and handles errors or edge cases gracefully.", maxScore: 5, minScore: 1, passScore: 3 },
            ],
            new: false
        },
        {
            id: 'presentation-skills-assignment',
            name: 'Presentation Skills',
            icon: <FileText size={16} className="text-white" />,
            description: "Evaluate presentations, talks, or project demos",
            is_template: true,
            criteria: [
                { name: "Structure and Flow", description: "Checks if the presentation has a clear introduction, body, and conclusion.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Clarity of Communication", description: "Checks if ideas are explained clearly and at an appropriate level for the audience.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Engagement", description: "Checks if the presenter keeps the audience engaged through pacing, examples, and storytelling.", maxScore: 5, minScore: 1, passScore: 3 },
                { name: "Use of Visuals", description: "Checks if slides or other visuals are clear, minimal, and support the spoken content.", maxScore: 5, minScore: 1, passScore: 3 },
            ],
            new: false
        },
    ];

    // Select templates based on type
    const templates = type === 'assignment' ? assignmentTemplates : quizTemplates;

    // Simpler approach: create a ref and track DOM element
    const [hoveredElement, setHoveredElement] = useState<HTMLDivElement | null>(null);

    if (!isOpen) return null;

    // Calculate position - default if not provided
    const dialogPosition = position || { top: 0, left: 0 };

    // Check if there are any school-specific scorecards to show
    const hasSchoolScorecards = schoolScorecards.length > 0;

    // Tab navigation logic
    const renderTabs = () => {
        if (!hasSchoolScorecards) return null;

        return (
            <div className={`flex border-b border-[#333333]`}>
                <button
                    className={`px-4 py-2 text-sm font-light flex-1 cursor-pointer ${activeTab === 'yours' ?
                        'text-white border-b-2 border-white' :
                        'text-gray-400 hover:text-white'}`}
                    onClick={() => setActiveTab('yours')}
                >
                    Your Scorecards
                </button>
                <button
                    className={`px-4 py-2 text-sm font-light flex-1 cursor-pointer ${activeTab === 'templates' ?
                        'text-white border-b-2 border-white' :
                        'text-gray-400 hover:text-white'}`}
                    onClick={() => setActiveTab('templates')}
                >
                    Templates
                </button>
            </div>
        );
    };

    // Render your scorecards section with fixed height and scrollable
    const renderYourScorecards = () => {
        if (!hasSchoolScorecards || activeTab !== 'yours') return null;

        // Filter scorecards based on search query
        const filteredScorecards = schoolScorecards.filter(scorecard =>
            scorecard.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
            <div className="relative">
                {/* Search input for user scorecards */}
                <div className="p-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search your scorecards"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#111] rounded-md px-3 py-2 text-white"
                        />
                    </div>
                </div>

                <div className="h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
                    {filteredScorecards.length > 0 ? (
                        filteredScorecards.map((template) => (
                            <div
                                key={template.id}
                                className="flex items-center px-4 py-3 hover:bg-[#2A2A2A] cursor-pointer transition-colors relative"
                                onClick={() => onSelectTemplate(template)}
                                onMouseEnter={(e) => {
                                    setHoveredTemplate(template.id);
                                    setHoveredElement(e.currentTarget as HTMLDivElement);
                                }}
                                onMouseLeave={() => {
                                    setHoveredTemplate(null);
                                    setHoveredElement(null);
                                }}
                            >
                                <span className="text-white text-sm">{template.name}</span>
                                {/* {template.new && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-700 text-white ml-2">
                                        NEW
                                    </span>
                                )} */}
                            </div>
                        ))
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                                {searchQuery
                                    ? 'No scorecards match your search'
                                    : 'No scorecards available'
                                }
                        </div>
                    )}
                </div>

                {/* Preview positioned outside the scrollable container */}
                {hoveredTemplate && hoveredElement && activeTab === 'yours' && (
                    <TemplatePreview
                        template={schoolScorecards.find(t => t.id === hoveredTemplate)!}
                        templateElement={hoveredElement}
                        type="user"
                    />
                )}
            </div>
        );
    };

    // Render templates section
    const renderTemplates = () => {
        if (hasSchoolScorecards && activeTab !== 'templates') return null;

        return (
            <div>
                {!hasSchoolScorecards && (
                    <div className="px-4 py-2 text-sm text-gray-400">Templates</div>
                )}

                {templates.map((template) => (
                    <div
                        key={template.id}
                        className="flex items-center px-4 py-3 hover:bg-[#2A2A2A] cursor-pointer transition-colors relative"
                        onClick={() => onSelectTemplate(template)}
                        onMouseEnter={(e) => {
                            setHoveredTemplate(template.id);
                            setHoveredElement(e.currentTarget as HTMLDivElement);
                        }}
                        onMouseLeave={() => {
                            setHoveredTemplate(null);
                            setHoveredElement(null);
                        }}
                    >
                        <div className="w-8 h-8 bg-[#712828] rounded flex items-center justify-center mr-3">
                            {template.icon}
                        </div>
                        <span className="text-white text-sm">{template.name}</span>

                        {/* Preview on hover */}
                        {hoveredTemplate === template.id && hoveredElement && (
                            <TemplatePreview
                                template={template}
                                templateElement={hoveredElement}
                            />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 ${activeTab === 'yours' ? 'mt-2' : 'mt-20'}"
            onClick={onClose}
        >
            <div
                className="absolute bg-[#1E1E1E] rounded-lg shadow-lg w-[296px] overflow-visible"
                style={{
                    top: dialogPosition.top,
                    left: dialogPosition.left
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4">
                    <h2 className="text-white text-lg font-normal">New scorecard</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Create new option */}
                <div
                    className="flex items-center px-4 py-3 hover:bg-[#2A2A2A] cursor-pointer transition-colors"
                    onClick={onCreateNew}
                >
                    <div className="w-8 h-8 bg-[#313131] rounded flex items-center justify-center mr-3">
                        <Plus size={20} className="text-white" />
                    </div>
                    <span className="text-white text-sm">New empty scorecard</span>
                </div>

                {/* Tab navigation */}
                {renderTabs()}

                {/* Your Scorecards Tab Content */}
                {renderYourScorecards()}

                {/* Templates Tab Content */}
                {renderTemplates()}
            </div>
        </div>
    );
};

export default ScorecardPickerDialog; 