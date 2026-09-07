import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateCourseDialog from '../../components/CreateCourseDialog';

// Mock fetch globally
global.fetch = jest.fn();

// Mock environment variables

describe('CreateCourseDialog Component', () => {
    const mockOnClose = jest.fn();
    const mockOnSuccess = jest.fn();
    const mockSchoolId = '123';

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the fetch mock
        (global.fetch as jest.Mock).mockReset();
    });

    it('should not render anything when open is false', () => {
        const { container } = render(
            <CreateCourseDialog
                open={false}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('should render the dialog with input field when open is true', () => {
        render(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        const inputField = screen.getByPlaceholderText('What will you name your course?');
        expect(inputField).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create course/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should update course name when typing in input field', () => {
        render(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        const inputField = screen.getByPlaceholderText('What will you name your course?');
        fireEvent.change(inputField, { target: { value: 'My New Course' } });
        expect(inputField).toHaveValue('My New Course');
    });

    it('should call onClose when cancel button is clicked', () => {
        render(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should show validation error when attempting to submit with empty course name', () => {
        render(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        // Try to submit with empty course name
        fireEvent.click(screen.getByRole('button', { name: /create course/i }));

        expect(screen.getByText('Course name is required')).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should call the API with correct data when submitting a valid course name', async () => {
        // Mock successful API response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'new-course-id' }),
        });

        render(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        // Enter course name
        const inputField = screen.getByPlaceholderText('What will you name your course?');
        fireEvent.change(inputField, { target: { value: 'My New Course' } });

        // Submit the form
        fireEvent.click(screen.getByRole('button', { name: /create course/i }));

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/backend/courses/',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: 'My New Course',
                        org_id: 123
                    }),
                }
            );
        });
    });

    it('should call onSuccess with correct data after successful API response', async () => {
        // Mock successful API response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'new-course-id' }),
        });

        render(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        // Enter course name
        const inputField = screen.getByPlaceholderText('What will you name your course?');
        fireEvent.change(inputField, { target: { value: 'My New Course' } });

        // Submit the form
        fireEvent.click(screen.getByRole('button', { name: /create course/i }));

        // Verify onSuccess called with correct data
        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledWith({
                id: 'new-course-id',
                name: 'My New Course'
            });
        });
    });

    it('should show error message when API call fails', async () => {
        // Mock failed API response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false
        });

        render(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        // Enter course name
        const inputField = screen.getByPlaceholderText('What will you name your course?');
        fireEvent.change(inputField, { target: { value: 'My New Course' } });

        // Submit the form
        fireEvent.click(screen.getByRole('button', { name: /create course/i }));

        // Verify error message is displayed
        await waitFor(() => {
            expect(screen.getByText('Failed to create course. Please try again.')).toBeInTheDocument();
        });

        // Verify onSuccess was not called
        expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should show loading state during API call', async () => {
        // Mock a delayed API response to check loading state
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
            new Promise(resolve =>
                setTimeout(() =>
                    resolve({
                        ok: true,
                        json: async () => ({ id: 'new-course-id' })
                    }),
                    100
                )
            )
        );

        render(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        // Enter course name
        const inputField = screen.getByPlaceholderText('What will you name your course?');
        fireEvent.change(inputField, { target: { value: 'My New Course' } });

        // Submit the form
        fireEvent.click(screen.getByRole('button', { name: /create course/i }));

        // Verify loading state
        expect(screen.queryByText('Create Course')).not.toBeInTheDocument();
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();

        // Wait for the API call to complete
        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalled();
        });
    });

    it('should reset the form when dialog is reopened', () => {
        const { rerender } = render(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        // Enter course name
        const inputField = screen.getByPlaceholderText('What will you name your course?');
        fireEvent.change(inputField, { target: { value: 'My New Course' } });

        // Verify input field has value
        expect(inputField).toHaveValue('My New Course');

        // Close and reopen the dialog
        rerender(
            <CreateCourseDialog
                open={false}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        rerender(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        // Verify form is reset
        const newInputField = screen.getByPlaceholderText('What will you name your course?');
        expect(newInputField).toHaveValue('');
    });

    it('should handle fetch exceptions and log errors', async () => {
        // Mock fetch to throw an exception
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        // Spy on console.error to verify it's called
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <CreateCourseDialog
                open={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                schoolId={mockSchoolId}
            />
        );

        // Enter course name
        const inputField = screen.getByPlaceholderText('What will you name your course?');
        fireEvent.change(inputField, { target: { value: 'My New Course' } });

        // Submit the form
        fireEvent.click(screen.getByRole('button', { name: /create course/i }));

        // Verify console.error was called (this covers line 98)
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('Error creating course:', expect.any(Error));
        });

        // Verify error message is displayed
        await waitFor(() => {
            expect(screen.getByText('Failed to create course. Please try again.')).toBeInTheDocument();
        });

        // Clean up spy
        consoleSpy.mockRestore();
    });
}); 