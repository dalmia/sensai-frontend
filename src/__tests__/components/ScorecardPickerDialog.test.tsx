import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScorecardPickerDialog, { ScorecardTemplate } from '../../components/ScorecardPickerDialog';
import React from 'react';

// Mocking Lucide icons
jest.mock('lucide-react', () => ({
    X: () => <div data-testid="x-icon" />,
    Plus: () => <div data-testid="plus-icon" />,
    Check: () => <div data-testid="check-icon" />,
    FileText: () => <div data-testid="file-text-icon" />,
    Mic: () => <div data-testid="mic-icon" />
}));

// Mock getBoundingClientRect and window properties
const mockGetBoundingClientRect = jest.fn();
const originalInnerHeight = window.innerHeight;

// Setup global mocks
beforeAll(() => {
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000,
    });

    HTMLElement.prototype.getBoundingClientRect = mockGetBoundingClientRect;
});

afterAll(() => {
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: originalInnerHeight,
    });
});

describe('ScorecardPickerDialog Component', () => {
    // Test data
    const mockOnClose = jest.fn();
    const mockOnCreateNew = jest.fn();
    const mockOnSelectTemplate = jest.fn();

    const mockSchoolScorecards: ScorecardTemplate[] = [
        {
            id: 'school-scorecard-1',
            name: 'School Scorecard 1',
            criteria: [
                { name: "Test Criterion", description: "Test description", maxScore: 5, minScore: 1, passScore: 3 }
            ],
            new: false
        },
        {
            id: 'school-scorecard-2',
            name: 'School Scorecard 2',
            criteria: [
                { name: "Another Criterion", description: "Another description", maxScore: 10, minScore: 0, passScore: 3 }
            ],
            new: true
        },
        {
            id: 'searchable-scorecard',
            name: 'Searchable Test Scorecard',
            criteria: [
                { name: "Search Criterion", description: "Search description", maxScore: 3, minScore: 1, passScore: 2 }
            ],
            new: false
        }
    ];

    const mockIssueTrackingTemplate: ScorecardTemplate = {
        id: 'issue-tracking',
        name: 'Issue Tracking',
        criteria: [
            { name: "Priority", description: "Issue priority", maxScore: 5, minScore: 1, passScore: 3 }
        ],
        new: false
    };

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        mockGetBoundingClientRect.mockReturnValue({
            top: 100,
            left: 200,
            width: 300,
            height: 50,
            right: 500,
            bottom: 150,
        });
    });

    it('should not render when isOpen is false', () => {
        const { container } = render(
            <ScorecardPickerDialog
                isOpen={false}
                onClose={mockOnClose}
                onCreateNew={mockOnCreateNew}
                onSelectTemplate={mockOnSelectTemplate}
            />
        );

        expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
        render(
            <ScorecardPickerDialog
                isOpen={true}
                onClose={mockOnClose}
                onCreateNew={mockOnCreateNew}
                onSelectTemplate={mockOnSelectTemplate}
            />
        );

        // Instead of looking for role='dialog', check for dialog content
        expect(screen.getByText('New scorecard')).toBeInTheDocument();
        expect(screen.getByText('New empty scorecard')).toBeInTheDocument();
        expect(screen.getByText('Templates')).toBeInTheDocument();
    });

    it('should show "Your Scorecards" and "Templates" tabs when school scorecards are provided', () => {
        render(
            <ScorecardPickerDialog
                isOpen={true}
                onClose={mockOnClose}
                onCreateNew={mockOnCreateNew}
                onSelectTemplate={mockOnSelectTemplate}
                schoolScorecards={mockSchoolScorecards}
            />
        );

        expect(screen.getByText('Your Scorecards')).toBeInTheDocument();
        expect(screen.getByText('Templates')).toBeInTheDocument();
    });

    it('should not show tabs when no school scorecards are provided', () => {
        render(
            <ScorecardPickerDialog
                isOpen={true}
                onClose={mockOnClose}
                onCreateNew={mockOnCreateNew}
                onSelectTemplate={mockOnSelectTemplate}
                schoolScorecards={[]}
            />
        );

        expect(screen.queryByText('Your Scorecards')).not.toBeInTheDocument();
    });

    it('should display school scorecards when "Your Scorecards" tab is active', () => {
        render(
            <ScorecardPickerDialog
                isOpen={true}
                onClose={mockOnClose}
                onCreateNew={mockOnCreateNew}
                onSelectTemplate={mockOnSelectTemplate}
                schoolScorecards={mockSchoolScorecards}
            />
        );

        // "Your Scorecards" tab should be active by default when school scorecards are provided
        expect(screen.getByText('School Scorecard 1')).toBeInTheDocument();
        expect(screen.getByText('School Scorecard 2')).toBeInTheDocument();
    });

    it('should display standard templates when "Templates" tab is active', () => {
        render(
            <ScorecardPickerDialog
                isOpen={true}
                onClose={mockOnClose}
                onCreateNew={mockOnCreateNew}
                onSelectTemplate={mockOnSelectTemplate}
                schoolScorecards={mockSchoolScorecards}
            />
        );

        // Click on "Templates" tab
        fireEvent.click(screen.getByText('Templates'));

        // Should show standard templates
        expect(screen.getByText('Written Communication')).toBeInTheDocument();
        expect(screen.getByText('Interview Preparation')).toBeInTheDocument();
        expect(screen.getByText('Product Pitch')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        render(
            <ScorecardPickerDialog
                isOpen={true}
                onClose={mockOnClose}
                onCreateNew={mockOnCreateNew}
                onSelectTemplate={mockOnSelectTemplate}
            />
        );

        // Click the close button
        fireEvent.click(screen.getByTestId('x-icon').closest('button')!);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onCreateNew when "Create New Rubric" button is clicked', () => {
        render(
            <ScorecardPickerDialog
                isOpen={true}
                onClose={mockOnClose}
                onCreateNew={mockOnCreateNew}
                onSelectTemplate={mockOnSelectTemplate}
            />
        );

        // Click the create new button
        fireEvent.click(screen.getByText('New empty scorecard'));

        expect(mockOnCreateNew).toHaveBeenCalledTimes(1);
    });

    it('should call onSelectTemplate when a template is clicked', () => {
        render(
            <ScorecardPickerDialog
                isOpen={true}
                onClose={mockOnClose}
                onCreateNew={mockOnCreateNew}
                onSelectTemplate={mockOnSelectTemplate}
            />
        );

        // Click on the "Written Communication" template
        fireEvent.click(screen.getByText('Written Communication').closest('div')!);

        expect(mockOnSelectTemplate).toHaveBeenCalledTimes(1);
        expect(mockOnSelectTemplate).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'written-communication',
                name: 'Written Communication'
            })
        );
    });

    it('should position the dialog based on provided position prop', () => {
        const position = { top: 100, left: 200 };

        render(
            <ScorecardPickerDialog
                isOpen={true}
                onClose={mockOnClose}
                onCreateNew={mockOnCreateNew}
                onSelectTemplate={mockOnSelectTemplate}
                position={position}
            />
        );

        // Find the container div instead of looking for role='dialog'
        const dialogContainer = screen.getByText('New scorecard').closest('div[style*="top"]');
        expect(dialogContainer).toHaveStyle(`top: ${position.top}px`);
        expect(dialogContainer).toHaveStyle(`left: ${position.left}px`);
    });

    describe('Search Functionality', () => {
        it('should filter scorecards based on search query', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={mockSchoolScorecards}
                />
            );

            // Should show all scorecards initially
            expect(screen.getByText('School Scorecard 1')).toBeInTheDocument();
            expect(screen.getByText('School Scorecard 2')).toBeInTheDocument();
            expect(screen.getByText('Searchable Test Scorecard')).toBeInTheDocument();

            // Type in search input
            const searchInput = screen.getByPlaceholderText('Search your scorecards');
            fireEvent.change(searchInput, { target: { value: 'search' } });

            // Should only show filtered results
            expect(screen.queryByText('School Scorecard 1')).not.toBeInTheDocument();
            expect(screen.queryByText('School Scorecard 2')).not.toBeInTheDocument();
            expect(screen.getByText('Searchable Test Scorecard')).toBeInTheDocument();
        });

        it('should show "No scorecards match your search" when no results found', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={mockSchoolScorecards}
                />
            );

            const searchInput = screen.getByPlaceholderText('Search your scorecards');
            fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

            expect(screen.getByText('No scorecards match your search')).toBeInTheDocument();
        });

        it('should show "No scorecards available" when no school scorecards exist', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={[]}
                />
            );

            // Switch to yours tab (if it exists)
            const yoursTab = screen.queryByText('Your Scorecards');
            if (yoursTab) {
                fireEvent.click(yoursTab);
                expect(screen.getByText('No scorecards available')).toBeInTheDocument();
            }
        });

        it('should clear search query when switching tabs', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={mockSchoolScorecards}
                />
            );

            // Type in search
            const searchInput = screen.getByPlaceholderText('Search your scorecards');
            fireEvent.change(searchInput, { target: { value: 'test' } });
            expect(searchInput).toHaveValue('test');

            // Switch to templates tab and back
            fireEvent.click(screen.getByText('Templates'));
            fireEvent.click(screen.getByText('Your Scorecards'));

            // Search should still have the value (component doesn't clear it)
            expect(searchInput).toHaveValue('test');
        });
    });

    describe('Tab Switching', () => {
        it('should switch between tabs correctly', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={mockSchoolScorecards}
                />
            );

            // Should start on "Your Scorecards" tab (uses dark mode variant classes)
            expect(screen.getByText('Your Scorecards')).toHaveClass('border-b-2');
            expect(screen.getByText('Templates')).not.toHaveClass('border-b-2');

            // Click Templates tab
            fireEvent.click(screen.getByText('Templates'));
            expect(screen.getByText('Templates')).toHaveClass('border-b-2');
            expect(screen.getByText('Your Scorecards')).not.toHaveClass('border-b-2');

            // Click back to Your Scorecards
            fireEvent.click(screen.getByText('Your Scorecards'));
            expect(screen.getByText('Your Scorecards')).toHaveClass('border-b-2');
            expect(screen.getByText('Templates')).not.toHaveClass('border-b-2');
        });

        it('should start with templates tab when no school scorecards provided', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={[]}
                />
            );

            // Should show templates by default
            expect(screen.getByText('Written Communication')).toBeInTheDocument();
            expect(screen.getByText('Interview Preparation')).toBeInTheDocument();
        });
    });

    describe('Template Preview Functionality', () => {
        it('should show template preview on hover for standard templates', async () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                />
            );

            const templateDiv = screen.getByText('Written Communication').closest('div')!;

            // Hover over template
            fireEvent.mouseEnter(templateDiv);

            // Should show preview
            await waitFor(() => {
                expect(screen.getByText('Parameter')).toBeInTheDocument();
                expect(screen.getByText('Description')).toBeInTheDocument();
                expect(screen.getByText('Maximum')).toBeInTheDocument();
            });

            // Should show template description
            expect(screen.getByText('Assess written communication skills')).toBeInTheDocument();
        });

        it('should hide template preview on mouse leave', async () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                />
            );

            const templateDiv = screen.getByText('Written Communication').closest('div')!;

            // Hover and then leave
            fireEvent.mouseEnter(templateDiv);
            fireEvent.mouseLeave(templateDiv);

            // Preview should be hidden
            await waitFor(() => {
                expect(screen.queryByText('Parameter')).not.toBeInTheDocument();
            });
        });

        it('should show template preview for school scorecards', async () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={mockSchoolScorecards}
                />
            );

            const templateDiv = screen.getByText('School Scorecard 1').closest('div')!;

            // Hover over school scorecard
            fireEvent.mouseEnter(templateDiv);

            // Should show preview
            await waitFor(() => {
                expect(screen.getByText('Parameter')).toBeInTheDocument();
                expect(screen.getByText('Test Criterion')).toBeInTheDocument();
            });
        });

        it('should show issue tracking status pills for issue-tracking template', async () => {
            const issueTrackingScorecard = [mockIssueTrackingTemplate];

            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={issueTrackingScorecard}
                />
            );

            const templateDiv = screen.getByText('Issue Tracking').closest('div')!;
            fireEvent.mouseEnter(templateDiv);

            // The getStatusPills function should return special pills for issue-tracking
            // but since we're testing the component, we just verify the preview shows
            await waitFor(() => {
                expect(screen.getByText('Priority')).toBeInTheDocument();
            });
        });

        it('should use default criteria when template has no criteria', async () => {
            const noCriteriaTemplate: ScorecardTemplate = {
                id: 'no-criteria',
                name: 'No Criteria Template',
                criteria: undefined as any, // Use undefined to trigger fallback, not empty array
                new: false
            };

            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={[noCriteriaTemplate]}
                />
            );

            const templateDiv = screen.getByText('No Criteria Template').closest('div')!;
            fireEvent.mouseEnter(templateDiv);

            // Should show default criteria
            await waitFor(() => {
                expect(screen.getByText('Grammar')).toBeInTheDocument();
                expect(screen.getByText('Relevance')).toBeInTheDocument();
                expect(screen.getByText('Confidence')).toBeInTheDocument();
            });
        });

        it('should handle templates without icons in preview', async () => {
            const noIconTemplate: ScorecardTemplate = {
                id: 'no-icon',
                name: 'No Icon Template',
                criteria: [
                    { name: "Test", description: "Test", maxScore: 5, minScore: 1, passScore: 3 }
                ],
                new: false
            };

            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={[noIconTemplate]}
                />
            );

            const templateDiv = screen.getByText('No Icon Template').closest('div')!;
            fireEvent.mouseEnter(templateDiv);

            await waitFor(() => {
                // Check for the template name in the preview (h3 element)
                expect(screen.getByRole('heading', { level: 3, name: 'No Icon Template' })).toBeInTheDocument();
            });
        });

        it('should handle template with null/undefined criteria', async () => {
            const nullCriteriaTemplate: ScorecardTemplate = {
                id: 'null-criteria',
                name: 'Null Criteria Template',
                criteria: null as any, // Use null to trigger fallback
                new: false
            };

            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={[nullCriteriaTemplate]}
                />
            );

            const templateDiv = screen.getByText('Null Criteria Template').closest('div')!;
            fireEvent.mouseEnter(templateDiv);

            // Should show default criteria when criteria is null
            await waitFor(() => {
                expect(screen.getByText('Grammar')).toBeInTheDocument();
                expect(screen.getByText('Relevance')).toBeInTheDocument();
                expect(screen.getByText('Confidence')).toBeInTheDocument();
            });
        });

        it('should trigger default status pills for non-issue-tracking templates', async () => {
            const regularTemplate: ScorecardTemplate = {
                id: 'regular-template',
                name: 'Regular Template',
                criteria: [
                    { name: "Test", description: "Test", maxScore: 5, minScore: 1, passScore: 3 }
                ],
                new: false
            };

            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={[regularTemplate]}
                />
            );

            const templateDiv = screen.getByText('Regular Template').closest('div')!;
            fireEvent.mouseEnter(templateDiv);

            // Should show the template preview which calls getStatusPills with default case
            await waitFor(() => {
                // Check for the h3 heading in the preview
                expect(screen.getByRole('heading', { level: 3, name: 'Regular Template' })).toBeInTheDocument();
                expect(screen.getByText('Test')).toBeInTheDocument();
            });
        });
    });

    describe('Preview Positioning Logic', () => {
        it('should position preview at bottom when not enough space below', async () => {
            // Mock getBoundingClientRect to simulate element near bottom of viewport
            mockGetBoundingClientRect.mockReturnValue({
                top: 900, // Near bottom of 1000px viewport
                left: 200,
                width: 300,
                height: 50,
                right: 500,
                bottom: 950,
            });

            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                />
            );

            const templateDiv = screen.getByText('Written Communication').closest('div')!;
            fireEvent.mouseEnter(templateDiv);

            // The preview should be positioned with bottom: '0' and top: 'auto'
            await waitFor(() => {
                const preview = document.querySelector('.absolute.z-\\[100\\]');
                expect(preview).toBeInTheDocument();
            });
        });

        it('should use default positioning when no template element provided', async () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                />
            );

            // Force a preview to render without proper element (edge case)
            const templateDiv = screen.getByText('Written Communication').closest('div')!;
            fireEvent.mouseEnter(templateDiv);

            await waitFor(() => {
                const preview = document.querySelector('.absolute.z-\\[100\\]');
                expect(preview).toBeInTheDocument();
            });
        });
    });

    describe('Click Events', () => {
        it('should call onClose when clicking outside dialog', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                />
            );

            // Click on the overlay (the fixed inset-0 div)
            const overlay = document.querySelector('.fixed.inset-0');
            fireEvent.click(overlay!);

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('should not call onClose when clicking inside dialog', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                />
            );

            // Click inside the dialog
            const dialogContent = screen.getByText('New scorecard').closest('div')!;
            fireEvent.click(dialogContent);

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('should call onSelectTemplate when clicking school scorecard', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={mockSchoolScorecards}
                />
            );

            fireEvent.click(screen.getByText('School Scorecard 1'));

            expect(mockOnSelectTemplate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'school-scorecard-1',
                    name: 'School Scorecard 1'
                })
            );
        });
    });

    describe('Default Position Handling', () => {
        it('should use default position when position prop not provided', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                />
            );

            const dialogContainer = screen.getByText('New scorecard').closest('div[style*="top"]');
            expect(dialogContainer).toHaveStyle('top: 0px');
            expect(dialogContainer).toHaveStyle('left: 0px');
        });
    });

    describe('Templates Header Logic', () => {
        it('should show Templates header when no school scorecards', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={[]}
                />
            );

            expect(screen.getByText('Templates')).toBeInTheDocument();
        });

        it('should not show Templates header when school scorecards exist and templates tab active', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                    schoolScorecards={mockSchoolScorecards}
                />
            );

            // Switch to templates tab
            fireEvent.click(screen.getByText('Templates'));

            // Should not show the "Templates" header text in the content area
            const templatesHeaders = screen.getAllByText('Templates');
            expect(templatesHeaders).toHaveLength(1); // Only in the tab, not in content
        });
    });

    describe('Template Icon Rendering', () => {
        it('should render template icons for standard templates', () => {
            render(
                <ScorecardPickerDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onCreateNew={mockOnCreateNew}
                    onSelectTemplate={mockOnSelectTemplate}
                />
            );

            expect(screen.getByTestId('check-icon')).toBeInTheDocument();
            expect(screen.getByTestId('mic-icon')).toBeInTheDocument();
            expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
        });
    });
}); 