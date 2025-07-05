import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfirmationDialog from '../../components/ConfirmationDialog';

describe('ConfirmationDialog Component', () => {
    // Mock functions for callbacks
    const mockOnConfirm = jest.fn();
    const mockOnCancel = jest.fn();
    const mockOnClose = jest.fn();
    const mockOnClickOutside = jest.fn();

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
    });

    it('should not render when not visible', () => {
        const { container } = render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={false}
            />
        );

        expect(container.firstChild).toBeNull();
    });

    it('should render with default delete props when open is true', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
            />
        );

        expect(screen.getByText('Confirm deletion')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to delete? This action cannot be undone.')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render with default publish props when type is publish', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                type="publish"
            />
        );

        expect(screen.getByText('Ready to publish?')).toBeInTheDocument();
        expect(screen.getByText('Make sure your content is complete and reviewed for errors before publishing')).toBeInTheDocument();
        expect(screen.getByText('Publish')).toBeInTheDocument();
    });

    it('should render with default save props when type is save', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                type="save"
            />
        );

        expect(screen.getByText('Save changes?')).toBeInTheDocument();
        expect(screen.getByText('Do you want to save your changes?')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should use custom title, message and button text when provided', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                title="Custom Title"
                message="Custom Message"
                confirmButtonText="Custom Confirm"
                cancelButtonText="Custom Cancel"
            />
        );

        expect(screen.getByText('Custom Title')).toBeInTheDocument();
        expect(screen.getByText('Custom Message')).toBeInTheDocument();
        expect(screen.getByText('Custom Confirm')).toBeInTheDocument();
        expect(screen.getByText('Custom Cancel')).toBeInTheDocument();
    });

    it('should show loading state when isLoading is true', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                isLoading={true}
            />
        );

        // Check for spinner element (div with animate-spin class)
        const spinner = screen.getByText('Delete').parentElement?.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();

        // Confirm button should be disabled
        const confirmButton = screen.getByText('Delete').closest('button');
        expect(confirmButton).toHaveClass('opacity-70');
        expect(confirmButton).toBeDisabled();
    });

    it('should display error message when provided', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                errorMessage="Something went wrong"
            />
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText('Something went wrong')).toHaveClass('text-red-400');
    });

    it('should call onConfirm when confirm button is clicked', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
            />
        );

        fireEvent.click(screen.getByText('Delete'));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when cancel button is clicked', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
            />
        );

        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when backdrop is clicked', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
            />
        );

        // Click on the backdrop (the fixed div)
        fireEvent.click(screen.getByText('Confirm deletion').parentElement?.parentElement?.parentElement!);
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should work with show prop instead of open prop', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                show={true}
            />
        );

        expect(screen.getByText('Confirm deletion')).toBeInTheDocument();
    });

    it('should call onClickOutside when provided and backdrop is clicked', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                onClickOutside={mockOnClickOutside}
                open={true}
            />
        );

        // Click on the backdrop (the fixed div)
        fireEvent.click(screen.getByText('Confirm deletion').parentElement?.parentElement?.parentElement!);
        expect(mockOnClickOutside).toHaveBeenCalledTimes(1);
        expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should render children when provided', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
            >
                <div data-testid="custom-content">Custom Dialog Content</div>
            </ConfirmationDialog>
        );

        expect(screen.getByTestId('custom-content')).toBeInTheDocument();
        expect(screen.getByText('Custom Dialog Content')).toBeInTheDocument();
    });

    it('should show close button when showCloseButton is true', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                showCloseButton={true}
            />
        );

        // Should have a close button (X icon) in the top-right corner
        const closeButton = document.querySelector('button.absolute.top-4.right-4');
        expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked and onClose is provided', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                onClose={mockOnClose}
                open={true}
                showCloseButton={true}
            />
        );

        // Find the close button by its specific classes and click it
        const closeButton = screen.getByRole('button', {
            name: '', // X button has no text
        });
        // Ensure it's the close button by checking its position class
        expect(closeButton).toHaveClass('absolute', 'top-4', 'right-4');

        fireEvent.click(closeButton);

        // Should call onClose, not onCancel
        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should call onCancel when close button is clicked and onClose is not provided', () => {
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                showCloseButton={true}
            />
        );

        // Find the close button by looking for a button with the specific positioning classes
        // This test specifically covers the else branch in handleClose (line 118)
        const buttons = screen.getAllByRole('button');
        const closeButton = buttons.find(button =>
            button.classList.contains('absolute') &&
            button.classList.contains('top-4') &&
            button.classList.contains('right-4')
        );

        expect(closeButton).toBeDefined();
        fireEvent.click(closeButton!);

        // Should call onCancel when onClose is not provided (this tests the else branch)
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
        expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should apply correct button styling based on type', () => {
        // Test delete button styling
        const { unmount: unmountDelete } = render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                type="delete"
            />
        );

        let confirmButton = screen.getByText('Delete').closest('button');
        expect(confirmButton).toHaveClass('bg-red-800');
        unmountDelete();

        // Test publish button styling
        const { unmount: unmountPublish } = render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                type="publish"
            />
        );

        confirmButton = screen.getByText('Publish').closest('button');
        expect(confirmButton).toHaveClass('bg-green-800');
        unmountPublish();

        // Test save button styling
        const { unmount: unmountSave } = render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                type="save"
            />
        );

        confirmButton = screen.getByText('Save').closest('button');
        expect(confirmButton).toHaveClass('bg-yellow-500');
        expect(confirmButton).toHaveClass('text-black');
        unmountSave();

        // Test custom button styling
        render(
            <ConfirmationDialog
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                open={true}
                type="custom"
            />
        );

        confirmButton = screen.getByText('Delete').closest('button');
        expect(confirmButton).toHaveClass('bg-blue-600');
    });
}); 