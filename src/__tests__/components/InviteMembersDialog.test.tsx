import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InviteMembersDialog from '../../components/InviteMembersDialog';

describe('InviteMembersDialog Component', () => {
    const mockOnClose = jest.fn();
    const mockOnInvite = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not render anything when open is false', () => {
        const { container } = render(
            <InviteMembersDialog
                open={false}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('should render the dialog with an empty email input when open is true', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        expect(screen.getByPlaceholderText('Enter email address')).toBeInTheDocument();
        expect(screen.getByText('Add another email')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should add a new email input when "Add another email" is clicked', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Initially there should be one email input
        expect(screen.getAllByPlaceholderText('Enter email address').length).toBe(1);

        // Click to add another email
        fireEvent.click(screen.getByText('Add another email'));

        // Now there should be two email inputs
        expect(screen.getAllByPlaceholderText('Enter email address').length).toBe(2);
    });

    it('should remove an email input when delete button is clicked', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Add an additional email input
        fireEvent.click(screen.getByText('Add another email'));
        expect(screen.getAllByPlaceholderText('Enter email address').length).toBe(2);

        // Find and click the delete button for the second email
        const deleteButtons = screen.getAllByRole('button').filter(btn => btn.querySelector('svg'));
        fireEvent.click(deleteButtons[0]); // First delete button

        // Should go back to one email input
        expect(screen.getAllByPlaceholderText('Enter email address').length).toBe(1);
    });

    it('should not remove the last email input', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Initially there should be one email input and no delete button
        expect(screen.getAllByPlaceholderText('Enter email address').length).toBe(1);

        // There should be no delete button for the first input when it's the only one
        const deleteIcons = screen.queryAllByRole('button').filter(btn =>
            btn.querySelector('svg[data-testid="trash-icon"]')
        );
        expect(deleteIcons.length).toBe(0);
    });

    it('should validate email format and show error messages', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Enter an invalid email
        const emailInput = screen.getByPlaceholderText('Enter email address');
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

        // Try to submit
        fireEvent.click(screen.getByRole('button', { name: /invite/i }));

        // Should show validation error
        expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });

    it('should validate that email is required', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Leave email empty
        const emailInput = screen.getByPlaceholderText('Enter email address');
        fireEvent.change(emailInput, { target: { value: '' } });

        // Try to submit
        fireEvent.click(screen.getByRole('button', { name: /invite/i }));

        // Should show validation error
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });

    it('should call onInvite with valid emails when submitted', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Enter a valid email
        const emailInput = screen.getByPlaceholderText('Enter email address');
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

        // Add another email
        fireEvent.click(screen.getByText('Add another email'));

        // Enter second valid email
        const emailInputs = screen.getAllByPlaceholderText('Enter email address');
        fireEvent.change(emailInputs[1], { target: { value: 'another@example.com' } });

        // Submit the form
        fireEvent.click(screen.getByRole('button', { name: /invite/i }));

        // Should call onInvite with array of emails
        expect(mockOnInvite).toHaveBeenCalledWith(['test@example.com', 'another@example.com']);

        // Should close the dialog
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not call onInvite when emails are invalid', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Enter one valid and one invalid email
        const emailInput = screen.getByPlaceholderText('Enter email address');
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

        // Add another email
        fireEvent.click(screen.getByText('Add another email'));

        // Enter invalid email
        const emailInputs = screen.getAllByPlaceholderText('Enter email address');
        fireEvent.change(emailInputs[1], { target: { value: 'invalid-email' } });

        // Blur the input to ensure error can show
        fireEvent.blur(emailInputs[1]);

        // Submit the form
        fireEvent.click(screen.getByRole('button', { name: /invite/i }));

        // Should not call onInvite
        expect(mockOnInvite).not.toHaveBeenCalled();

        // Should not close the dialog
        expect(mockOnClose).not.toHaveBeenCalled();

        // Check for the error message paragraph
        const errorElements = screen.getAllByText(/please enter a valid email/i);
        expect(errorElements.length).toBeGreaterThan(0);
    });

    it('should close the dialog when cancel is clicked', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Click cancel button
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

        // Should call onClose
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset the form when dialog is reopened', () => {
        const { rerender } = render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Enter an email
        const emailInput = screen.getByPlaceholderText('Enter email address');
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

        // Add another email input
        fireEvent.click(screen.getByText('Add another email'));
        expect(screen.getAllByPlaceholderText('Enter email address').length).toBe(2);

        // Close the dialog
        rerender(
            <InviteMembersDialog
                open={false}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Reopen the dialog
        rerender(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Should reset to one empty email input
        expect(screen.getAllByPlaceholderText('Enter email address').length).toBe(1);
        expect(screen.getByPlaceholderText('Enter email address')).toHaveValue('');
    });

    it('should focus the new input field when adding an email', async () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        // Add a new email input
        fireEvent.click(screen.getByText('Add another email'));

        // Get the last input (should be the newly added one)
        const emailInputs = screen.getAllByPlaceholderText('Enter email address');
        const lastInput = emailInputs[emailInputs.length - 1];

        // Check if the input has focus-related classes or styling that indicates focus
        // In this component, the focused input has a 'border-white' class
        await waitFor(() => {
            expect(lastInput.className).toContain('border-white');
        });
    });

    it('should show visual feedback when input is focused', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        const emailInput = screen.getByPlaceholderText('Enter email address');

        // Focus the input
        fireEvent.focus(emailInput);

        // Check that the email icon shows focus styling
        const mailIcon = emailInput.closest('div')?.querySelector('svg');
        expect(mailIcon).not.toBeNull();
        expect(mailIcon).toHaveClass('text-black');
        expect(mailIcon).toHaveClass('dark:text-white');

        // Blur the input
        fireEvent.blur(emailInput);

        // Icon should return to normal state
        expect(mailIcon).toHaveClass('text-gray-500');
    });

    it('should clear validation error when invalid email becomes valid', () => {
        render(
            <InviteMembersDialog
                open={true}
                onClose={mockOnClose}
                onInvite={mockOnInvite}
            />
        );

        const emailInput = screen.getByPlaceholderText('Enter email address');

        // First enter an invalid email
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

        // Verify error exists after blur
        fireEvent.blur(emailInput);

        // Then correct it to a valid email (this should trigger line 71)
        fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });

        // The error should be cleared (but won't show because input is focused)
        // We can verify by trying to submit - it should succeed
        fireEvent.click(screen.getByRole('button', { name: /invite/i }));

        // Should call onInvite since email is now valid
        expect(mockOnInvite).toHaveBeenCalledWith(['valid@example.com']);
    });
}); 