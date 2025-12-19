import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import CohortCoursesLinkerDropdown from '../../components/CohortCoursesLinkerDropdown';
import { Course } from '@/types';

// Mock Link component from next/link
jest.mock('next/link', () => {
    return function MockLink({ children, href }: { children: React.ReactNode, href: string }) {
        return <a href={href}>{children}</a>;
    };
});

describe('CohortCoursesLinkerDropdown', () => {
    // Sample course data
    const mockCourses: Course[] = [
        { id: 1, name: 'JavaScript Basics' },
        { id: 2, name: 'React Fundamentals' },
        { id: 3, name: 'Node.js Development' },
    ] as Course[];

    // Common props for the component
    const defaultProps = {
        isOpen: true,
        onClose: jest.fn(),
        availableCourses: mockCourses,
        totalSchoolCourses: 5,
        isLoadingCourses: false,
        courseError: null,
        schoolId: 'school-123',
        cohortId: 'cohort-456',
        onCoursesLinked: jest.fn(),
        onFetchAvailableCourses: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not render when isOpen is false', () => {
        render(<CohortCoursesLinkerDropdown
            {...defaultProps}
            isOpen={false}
        />);

        // The dropdown should not be in the document
        expect(screen.queryByText('Search courses')).not.toBeInTheDocument();
        expect(screen.queryByText('JavaScript Basics')).not.toBeInTheDocument();
    });

    it('should render course list when open', () => {
        render(<CohortCoursesLinkerDropdown {...defaultProps} />);

        // Search box should be present
        expect(screen.getByPlaceholderText('Search courses')).toBeInTheDocument();

        // All courses should be listed
        expect(screen.getByText('JavaScript Basics')).toBeInTheDocument();
        expect(screen.getByText('React Fundamentals')).toBeInTheDocument();
        expect(screen.getByText('Node.js Development')).toBeInTheDocument();
    });

    it('should filter courses when searching', () => {
        render(<CohortCoursesLinkerDropdown {...defaultProps} />);

        // Type in search box
        const searchInput = screen.getByPlaceholderText('Search courses');
        fireEvent.change(searchInput, { target: { value: 'React' } });

        // Only React course should be visible
        expect(screen.getByText('React Fundamentals')).toBeInTheDocument();
        expect(screen.queryByText('JavaScript Basics')).not.toBeInTheDocument();
        expect(screen.queryByText('Node.js Development')).not.toBeInTheDocument();
    });

    it('should add courses to temporary selection when clicked', () => {
        render(<CohortCoursesLinkerDropdown {...defaultProps} />);

        // Click on a course to select it
        fireEvent.click(screen.getByText('JavaScript Basics'));

        // Course should appear in the selected area (with X button)
        const selectedArea = screen.getByText('JavaScript Basics').closest('div');
        expect(selectedArea).toHaveClass('dark:!bg-[#222]');

        // The course should be removed from the available list
        const courseList = screen.getAllByText('JavaScript Basics');
        expect(courseList.length).toBe(1); // Only one instance now (the selected one)
    });

    it('should remove courses from selection when X is clicked', () => {
        render(<CohortCoursesLinkerDropdown {...defaultProps} />);

        // First select a course
        fireEvent.click(screen.getByText('JavaScript Basics'));

        // Find the selected course's close button and click it
        const closeButtons = screen.getAllByRole('button').filter(
            button => button.querySelector('svg')
        );
        const closeButton = closeButtons.find(button =>
            button.previousSibling?.textContent === 'JavaScript Basics'
        );
        fireEvent.click(closeButton!);

        // Course should not be in selected area anymore
        const selectedCourses = screen.queryAllByText('JavaScript Basics').filter(
            el => el.closest('div')?.classList.contains('dark:!bg-[#222]')
        );
        expect(selectedCourses.length).toBe(0);

        // Course should be back in the list
        expect(screen.getByText('JavaScript Basics')).toBeInTheDocument();
    });

    it('should call onCoursesLinked with selected courses when "Link courses" button is clicked', () => {
        render(<CohortCoursesLinkerDropdown {...defaultProps} />);

        // Select two courses
        fireEvent.click(screen.getByText('JavaScript Basics'));
        fireEvent.click(screen.getByText('React Fundamentals'));

        // Click the link button
        fireEvent.click(screen.getByText('Link courses with cohort'));

        // Check if onCoursesLinked was called with the selected courses and dripConfig
        expect(defaultProps.onCoursesLinked).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ id: 1, name: 'JavaScript Basics' }),
                expect.objectContaining({ id: 2, name: 'React Fundamentals' })
            ]),
            undefined  // dripConfig is undefined when not configured
        );

        // Dropdown should be closed
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should show loading state when isLoadingCourses is true', () => {
        render(<CohortCoursesLinkerDropdown
            {...defaultProps}
            isLoadingCourses={true}
        />);

        // Find the loading spinner by its class
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();

        // Verify the "Linking..." text appears
        expect(screen.getByText('Linking...')).toBeInTheDocument();
    });

    it('should show error message and retry button when courseError exists', () => {
        render(<CohortCoursesLinkerDropdown
            {...defaultProps}
            courseError="Failed to load courses"
        />);

        // Error message should be visible
        expect(screen.getByText('Failed to load courses')).toBeInTheDocument();

        // Retry button should be visible
        const retryButton = screen.getByText('Try again');
        expect(retryButton).toBeInTheDocument();

        // Click retry button
        fireEvent.click(retryButton);

        // onFetchAvailableCourses should be called
        expect(defaultProps.onFetchAvailableCourses).toHaveBeenCalled();
    });

    it('should show "No courses available" when totalSchoolCourses is 0', () => {
        render(<CohortCoursesLinkerDropdown
            {...defaultProps}
            totalSchoolCourses={0}
            availableCourses={[]}
        />);

        expect(screen.getByText('No courses available')).toBeInTheDocument();
        expect(screen.getByText('Create courses in your school that you can publish to your cohort')).toBeInTheDocument();

        // Should have a link to the school
        const link = screen.getByText('Open school');
        expect(link).toHaveAttribute('href', '/school/admin/school-123#courses');
    });

    it('should show "No courses left" when all courses are already added', () => {
        render(<CohortCoursesLinkerDropdown
            {...defaultProps}
            totalSchoolCourses={5}
            availableCourses={[]}
        />);

        expect(screen.getByText('No courses left')).toBeInTheDocument();
        expect(screen.getByText('All courses from your school have been added to this cohort')).toBeInTheDocument();

        // Should have a link to create more courses
        const link = screen.getByText('Create more courses');
        expect(link).toHaveAttribute('href', '/school/admin/school-123#courses');
    });
}); 