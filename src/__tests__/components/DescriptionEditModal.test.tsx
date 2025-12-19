import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DescriptionEditModal from '../../components/DescriptionEditModal';
import React from 'react';

describe('DescriptionEditModal Component', () => {
    const defaultProps = {
        open: true,
        onClose: jest.fn(),
        onSave: jest.fn(),
        currentDescription: 'Initial description text'
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render when open is true', () => {
            render(<DescriptionEditModal {...defaultProps} />);

            expect(screen.getByText('Edit description')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Enter description')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
            expect(screen.getByText('Save')).toBeInTheDocument();
        });

        it('should not render when open is false', () => {
            render(<DescriptionEditModal {...defaultProps} open={false} />);

            expect(screen.queryByText('Edit description')).not.toBeInTheDocument();
            expect(screen.queryByPlaceholderText('Enter description')).not.toBeInTheDocument();
        });

        it('should display current description in textarea', () => {
            render(<DescriptionEditModal {...defaultProps} />);

            const textarea = screen.getByPlaceholderText('Enter description');
            expect(textarea).toHaveValue('Initial description text');
        });
    });

    describe('User Interactions', () => {
        it('should call onSave when Save button is clicked', () => {
            render(<DescriptionEditModal {...defaultProps} />);

            const saveButton = screen.getByText('Save');
            fireEvent.click(saveButton);

            expect(defaultProps.onSave).toHaveBeenCalledWith('Initial description text');
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('should call onClose when Cancel button is clicked', () => {
            render(<DescriptionEditModal {...defaultProps} />);

            const cancelButton = screen.getByText('Cancel');
            fireEvent.click(cancelButton);

            expect(defaultProps.onClose).toHaveBeenCalled();
            expect(defaultProps.onSave).not.toHaveBeenCalled();
        });

        it('should update description state when typing in textarea', () => {
            render(<DescriptionEditModal {...defaultProps} />);

            const textarea = screen.getByPlaceholderText('Enter description');
            fireEvent.change(textarea, { target: { value: 'Updated description' } });

            expect(textarea).toHaveValue('Updated description');
        });

        it('should save updated description when Save button is clicked after editing', () => {
            render(<DescriptionEditModal {...defaultProps} />);

            const textarea = screen.getByPlaceholderText('Enter description');
            const saveButton = screen.getByText('Save');

            fireEvent.change(textarea, { target: { value: 'Updated description' } });
            fireEvent.click(saveButton);

            expect(defaultProps.onSave).toHaveBeenCalledWith('Updated description');
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });

    describe('Focus and Selection', () => {
        it('should focus and select textarea content when modal opens', async () => {
            const { rerender } = render(<DescriptionEditModal {...defaultProps} open={false} />);

            // Modal is closed initially
            expect(screen.queryByPlaceholderText('Enter description')).not.toBeInTheDocument();

            // Open modal
            rerender(<DescriptionEditModal {...defaultProps} open={true} />);

            const textarea = screen.getByPlaceholderText('Enter description');

            // Wait for focus and selection to be applied
            await waitFor(() => {
                expect(textarea).toHaveFocus();
            });

            // Note: Testing text selection in JSDOM is limited, but we can verify focus
            expect(textarea).toHaveFocus();
        });

        it('should reset description to currentDescription when modal reopens', () => {
            const { rerender } = render(<DescriptionEditModal {...defaultProps} />);

            const textarea = screen.getByPlaceholderText('Enter description');

            // Edit the description
            fireEvent.change(textarea, { target: { value: 'Modified description' } });
            expect(textarea).toHaveValue('Modified description');

            // Close and reopen modal
            rerender(<DescriptionEditModal {...defaultProps} open={false} />);
            rerender(<DescriptionEditModal {...defaultProps} open={true} />);

            // Description should be reset to original value
            const newTextarea = screen.getByPlaceholderText('Enter description');
            expect(newTextarea).toHaveValue('Initial description text');
        });
    });

    describe('Modal Behavior', () => {
        it('should stop propagation when clicking on modal content', () => {
            render(<DescriptionEditModal {...defaultProps} />);

            const modalContent = screen.getByText('Edit description').closest('div');
            if (modalContent) {
                fireEvent.click(modalContent);
                // Note: stopPropagation is called on the onClick handler, but we can't easily test this in JSDOM
                // The important thing is that the modal doesn't close when clicking inside it
                expect(defaultProps.onClose).not.toHaveBeenCalled();
            }
        });

        it('should have proper styling classes', () => {
            render(<DescriptionEditModal {...defaultProps} />);

            const modal = screen.getByText('Edit description').closest('.fixed');
            // Uses dark mode variant classes: bg-black/30 dark:bg-black/40
            expect(modal).toHaveClass('fixed', 'inset-0', 'backdrop-blur-sm', 'z-50');

            const modalContent = screen.getByText('Edit description').closest('.rounded-lg');
            expect(modalContent).toHaveClass('rounded-lg', 'shadow-2xl');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty description', () => {
            render(<DescriptionEditModal {...defaultProps} currentDescription="" />);

            const textarea = screen.getByPlaceholderText('Enter description');
            expect(textarea).toHaveValue('');

            const saveButton = screen.getByText('Save');
            fireEvent.click(saveButton);

            expect(defaultProps.onSave).toHaveBeenCalledWith('');
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('should handle very long descriptions', () => {
            const longDescription = 'A'.repeat(1000);
            render(<DescriptionEditModal {...defaultProps} currentDescription={longDescription} />);

            const textarea = screen.getByPlaceholderText('Enter description');
            expect(textarea).toHaveValue(longDescription);

            const saveButton = screen.getByText('Save');
            fireEvent.click(saveButton);

            expect(defaultProps.onSave).toHaveBeenCalledWith(longDescription);
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('should handle special characters in description', () => {
            const specialDescription = 'Description with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
            render(<DescriptionEditModal {...defaultProps} currentDescription={specialDescription} />);

            const textarea = screen.getByPlaceholderText('Enter description');
            expect(textarea).toHaveValue(specialDescription);

            const saveButton = screen.getByText('Save');
            fireEvent.click(saveButton);

            expect(defaultProps.onSave).toHaveBeenCalledWith(specialDescription);
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });
});
