import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LearnerScorecard from '../../components/LearnerScorecard';
import { ScorecardItem } from '../../types/quiz';
import React from 'react';

describe('LearnerScorecard Component', () => {
    // Test data
    const mockScorecard: ScorecardItem[] = [
        {
            category: 'Understanding',
            score: 8,
            max_score: 10,
            pass_score: 6,
            feedback: {
                correct: 'Shows strong understanding of core concepts.',
                wrong: 'Could be more precise with technical terms.'
            }
        },
        {
            category: 'Implementation',
            score: 6,
            max_score: 10,
            pass_score: 6,
            feedback: {
                correct: 'Successfully implemented the main features.',
                wrong: 'Some edge cases were not handled properly.'
            }
        },
        {
            category: 'Code Quality',
            score: 7,
            max_score: 10,
            pass_score: 6,
            feedback: {
                correct: 'Clean and readable code structure.',
                wrong: 'Variable naming could be improved.'
            }
        }
    ];

    it('should render correctly with scorecard data', () => {
        const { container } = render(<LearnerScorecard scorecard={mockScorecard} />);

        // Check for summary
        expect(screen.getByText('Performance Summary')).toBeInTheDocument();
        expect(screen.getByText('Overall Score')).toBeInTheDocument();

        // Total score should be 21/30
        expect(screen.getByText('21/30')).toBeInTheDocument();

        // Percentage should be 70%
        expect(screen.getByText('70%')).toBeInTheDocument();

        // Check for categories - using querySelector with specific parent containers to avoid duplicates
        const summary = container.querySelector('.rounded-xl.p-5');
        expect(summary?.textContent).toContain('Understanding');
        expect(summary?.textContent).toContain('Implementation');
        expect(summary?.textContent).toContain('Code Quality');

        // Check score displays
        expect(screen.getByText('8/10')).toBeInTheDocument();
        expect(screen.getByText('6/10')).toBeInTheDocument();
        expect(screen.getByText('7/10')).toBeInTheDocument();
    });

    it('should return null when scorecard is empty', () => {
        const { container } = render(<LearnerScorecard scorecard={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('should collapse detailed feedback when clicked', () => {
        const { container } = render(<LearnerScorecard scorecard={mockScorecard} />);

        // Verify that feedback is visible initially (expanded by default)
        expect(container.querySelector('.dark\\:border-emerald-900\\/30')).toBeInTheDocument();
        expect(container.querySelector('.dark\\:border-amber-900\\/30')).toBeInTheDocument();

        // Click on the first category header to collapse it
        const firstCategoryHeader = container.querySelector('[data-testid="detail-0"] .p-4');
        fireEvent.click(firstCategoryHeader!);

        // Verify that feedback is now hidden for the first category
        const firstCategoryFeedback = container.querySelector('[data-testid="detail-0"] .border-t');
        expect(firstCategoryFeedback).not.toBeInTheDocument();
    });

    it('should collapse feedback when expanded section is clicked again', async () => {
        const { container } = render(<LearnerScorecard scorecard={mockScorecard} />);

        // Get the first category header (clickable area)
        const firstCategoryHeader = container.querySelector('[data-testid="detail-0"] .p-4');

        // Feedback should be visible initially (expanded by default)
        expect(container.querySelector('.dark\\:border-emerald-900\\/30')).toBeInTheDocument();

        // Click to collapse
        fireEvent.click(firstCategoryHeader!);

        // Wait for collapse
        await waitFor(() => {
            const firstCategoryFeedback = container.querySelector('[data-testid="detail-0"] .border-t');
            expect(firstCategoryFeedback).not.toBeInTheDocument();
        });
    });

    it('should handle expanding and collapsing sections independently', async () => {
        const { container } = render(<LearnerScorecard scorecard={mockScorecard} />);

        // Get category headers (clickable areas)
        const understandingHeader = container.querySelector('[data-testid="detail-0"] .p-4');
        const implementationHeader = container.querySelector('[data-testid="detail-1"] .p-4');

        // All sections should be expanded by default
        expect(container.querySelector('[data-testid="detail-0"] .border-t')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="detail-1"] .border-t')).toBeInTheDocument();
        expect(container.textContent).toContain('Shows strong understanding of core concepts.');

        // Click Understanding section to collapse it
        fireEvent.click(understandingHeader!);

        // Wait for Understanding to collapse
        await waitFor(() => {
            const understandingFeedback = container.querySelector('[data-testid="detail-0"] .border-t');
            expect(understandingFeedback).not.toBeInTheDocument();
        });

        // Implementation section should still be expanded
        expect(container.querySelector('[data-testid="detail-1"] .border-t')).toBeInTheDocument();
        expect(container.textContent).toContain('Successfully implemented the main features.');

        // Click Implementation section to collapse it
        fireEvent.click(implementationHeader!);

        // Wait for Implementation to collapse
        await waitFor(() => {
            const implementationFeedback = container.querySelector('[data-testid="detail-1"] .border-t');
            expect(implementationFeedback).not.toBeInTheDocument();
        });

        // Both sections should now be collapsed
        expect(container.querySelector('[data-testid="detail-0"] .border-t')).not.toBeInTheDocument();
        expect(container.querySelector('[data-testid="detail-1"] .border-t')).not.toBeInTheDocument();
    });

    it('should expand collapsed sections when clicked', async () => {
        const { container } = render(<LearnerScorecard scorecard={mockScorecard} />);

        // Get category headers (clickable areas)
        const understandingHeader = container.querySelector('[data-testid="detail-0"] .p-4');

        // All sections should be expanded by default
        expect(container.querySelector('[data-testid="detail-0"] .border-t')).toBeInTheDocument();
        expect(container.textContent).toContain('Shows strong understanding of core concepts.');

        // Click Understanding section to collapse it
        fireEvent.click(understandingHeader!);

        // Wait for Understanding to collapse
        await waitFor(() => {
            const understandingFeedback = container.querySelector('[data-testid="detail-0"] .border-t');
            expect(understandingFeedback).not.toBeInTheDocument();
        });

        // Click Understanding section again to expand it
        fireEvent.click(understandingHeader!);

        // Wait for Understanding to expand again
        await waitFor(() => {
            const understandingFeedback = container.querySelector('[data-testid="detail-0"] .border-t');
            expect(understandingFeedback).toBeInTheDocument();
            expect(container.textContent).toContain('Shows strong understanding of core concepts.');
        });
    });

    it('should apply the correct colors based on score percentages', () => {
        const mockScorecardWithVariedScores: ScorecardItem[] = [
            {
                category: 'Excellent',
                score: 9,
                max_score: 10, // 90% - should be emerald
                pass_score: 6,
                feedback: { correct: 'Great work', wrong: '' }
            },
            {
                category: 'Good',
                score: 7,
                max_score: 10, // 70% - should be blue
                pass_score: 6,
                feedback: { correct: 'Good effort', wrong: '' }
            },
            {
                category: 'Average',
                score: 5,
                max_score: 10, // 50% - should be amber
                pass_score: 6,
                feedback: { correct: '', wrong: 'Needs improvement' }
            },
            {
                category: 'Poor',
                score: 3,
                max_score: 10, // 30% - should be rose
                pass_score: 6,
                feedback: { correct: '', wrong: 'Significant issues' }
            }
        ];

        const { container } = render(<LearnerScorecard scorecard={mockScorecardWithVariedScores} />);

        // Check that correct color classes are applied
        // We can't test exact elements as the DOM structure is complex,
        // but we can check that the correct color classes exist in the document
        expect(container.innerHTML).toContain('bg-emerald-500');
        expect(container.innerHTML).toContain('bg-blue-500');
        expect(container.innerHTML).toContain('bg-amber-500');
        expect(container.innerHTML).toContain('bg-rose-500');
    });

    it('should apply custom className when provided', () => {
        const { container } = render(
            <LearnerScorecard
                scorecard={mockScorecard}
                className="custom-test-class"
            />
        );

        const rootElement = container.firstChild;
        expect(rootElement).toHaveClass('custom-test-class');
        expect(rootElement).toHaveClass('pt-6');
    });
}); 