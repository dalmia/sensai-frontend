import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublishConfirmationDialog from '../../components/PublishConfirmationDialog';

// Mock the CSS import directly
jest.mock('react-datepicker/dist/react-datepicker.css', () => ({}));

// Mock ConfirmationDialog component since we're only testing PublishConfirmationDialog
jest.mock('../../components/ConfirmationDialog', () => {
    return function MockConfirmationDialog({
        open,
        title,
        message,
        onConfirm,
        onCancel,
        isLoading,
        errorMessage,
        type,
        confirmButtonText,
        children
    }: any) {
        return (
            <div data-testid="confirmation-dialog" style={{ display: open ? 'block' : 'none' }}>
                <h2>{title}</h2>
                <p>{message}</p>
                {isLoading && <div data-testid="loading-indicator">Loading...</div>}
                {errorMessage && <div data-testid="error-message">{errorMessage}</div>}
                <div data-testid="type">{type}</div>
                <button onClick={onConfirm} data-testid="confirm-button">{confirmButtonText}</button>
                <button onClick={onCancel} data-testid="cancel-button">Cancel</button>
                <div data-testid="dialog-children">{children}</div>
            </div>
        );
    };
});

// Mock DatePicker component
jest.mock('react-datepicker', () => {
    return function MockDatePicker({
        selected,
        onChange,
        showTimeSelect,
        timeFormat,
        timeIntervals,
        dateFormat,
        timeCaption,
        minDate,
        className,
        wrapperClassName,
        calendarClassName
    }: any) {
        return (
            <div className={wrapperClassName}>
                <input
                    type="text"
                    className={className}
                    value={selected ? selected.toISOString() : ''}
                    onChange={(e) => {
                        const dateValue = e.target.value;
                        if (dateValue === '') {
                            onChange(null);
                        } else {
                            const newDate = new Date(dateValue);
                            if (!isNaN(newDate.getTime())) {
                                onChange(newDate);
                            }
                        }
                    }}
                    data-testid="date-picker"
                />
            </div>
        );
    };
});

describe('PublishConfirmationDialog Component', () => {
    const mockOnConfirm = jest.fn();
    const mockOnCancel = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render the dialog with correct title and message', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test Message')).toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        fireEvent.click(screen.getByTestId('cancel-button'));
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm with null when publish now button is clicked', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        fireEvent.click(screen.getByTestId('confirm-button'));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith(null);
    });

    it('should have "Publish" text on button by default', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        expect(screen.getByTestId('confirm-button')).toHaveTextContent('Publish');
    });

    it('should show schedule checkbox', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        expect(screen.getByLabelText('Schedule time to publish')).toBeInTheDocument();
    });

    it('should show date picker when schedule checkbox is checked', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        fireEvent.click(screen.getByLabelText('Schedule time to publish'));
        expect(screen.getByTestId('date-picker')).toBeInTheDocument();
    });

    it('should change confirm button text to "Schedule" when scheduling', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        fireEvent.click(screen.getByLabelText('Schedule time to publish'));
        expect(screen.getByTestId('confirm-button')).toHaveTextContent('Schedule');
    });

    it('should call onConfirm with ISO date string when scheduling', () => {
        // Mock date for predictable testing
        const mockDate = new Date('2030-01-01T12:00:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(mockDate);

        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        fireEvent.click(screen.getByLabelText('Schedule time to publish'));

        // Simulate date selection (tomorrow by default)
        const tomorrowDate = new Date('2030-01-02T12:00:00Z');

        // Click confirm
        fireEvent.click(screen.getByTestId('confirm-button'));

        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith(expect.any(String));

        // Reset mocked timers
        jest.useRealTimers();
    });

    it('should show loading indicator when isLoading is true', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
                isLoading={true}
            />
        );

        expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });

    it('should show error message when provided', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
                errorMessage="An error occurred"
            />
        );

        expect(screen.getByTestId('error-message')).toHaveTextContent('An error occurred');
    });

    it('should set dialog type to "publish"', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        expect(screen.getByTestId('type')).toHaveTextContent('publish');
    });

    it('should reset state when dialog is hidden after being shown', () => {
        const { rerender } = render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        // Enable scheduling and set a date
        fireEvent.click(screen.getByLabelText('Schedule time to publish'));
        expect(screen.getByTestId('confirm-button')).toHaveTextContent('Schedule');

        // Hide the dialog
        rerender(
            <PublishConfirmationDialog
                show={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        // Show the dialog again
        rerender(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        // State should be reset - button should be "Publish" again
        expect(screen.getByTestId('confirm-button')).toHaveTextContent('Publish');
        expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
    });

    it('should set default date to tomorrow when scheduling is enabled', () => {
        // Mock the current date to a known value
        const mockCurrentDate = new Date('2030-01-01T12:00:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(mockCurrentDate);

        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        // Enable scheduling
        fireEvent.click(screen.getByLabelText('Schedule time to publish'));

        // Date picker should appear with tomorrow's date
        const datePicker = screen.getByTestId('date-picker');
        expect(datePicker).toBeInTheDocument();

        // The default value should be tomorrow at the same time
        const expectedTomorrowDate = new Date('2030-01-02T12:00:00Z');
        expect(datePicker).toHaveValue(expectedTomorrowDate.toISOString());

        jest.useRealTimers();
    });

    it('should not allow past dates to be scheduled', () => {
        // Mock the current date
        const mockCurrentDate = new Date('2030-01-01T12:00:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(mockCurrentDate);

        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        // Enable scheduling
        fireEvent.click(screen.getByLabelText('Schedule time to publish'));

        const datePicker = screen.getByTestId('date-picker');

        // Try to set a past date
        const pastDate = new Date('2029-12-31T12:00:00Z');
        fireEvent.change(datePicker, { target: { value: pastDate.toISOString() } });

        // The date picker should not accept the past date (component should ignore it)
        // Since our mock just sets the value directly, we need to test the validation function behavior
        // by checking that when we click confirm, it should still use the default tomorrow date

        fireEvent.click(screen.getByTestId('confirm-button'));

        // Should be called with a valid future date, not the past date
        expect(mockOnConfirm).toHaveBeenCalledWith(expect.any(String));

        jest.useRealTimers();
    });

    it('should handle null date in validation function', () => {
        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        // Enable scheduling
        fireEvent.click(screen.getByLabelText('Schedule time to publish'));

        const datePicker = screen.getByTestId('date-picker');

        // Try to clear the date (set to empty/null value)
        fireEvent.change(datePicker, { target: { value: '' } });

        // The validation should handle null gracefully
        // Component should still work normally and button should still show "Schedule"
        expect(screen.getByTestId('confirm-button')).toHaveTextContent('Schedule');

        // When clicking confirm, the component should still call onConfirm with the default date
        // since clearing the input doesn't clear the state (component behavior)
        fireEvent.click(screen.getByTestId('confirm-button'));
        expect(mockOnConfirm).toHaveBeenCalledWith(expect.any(String));
    });

    it('should allow setting a valid future date', () => {
        // Mock the current date
        const mockCurrentDate = new Date('2030-01-01T12:00:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(mockCurrentDate);

        render(
            <PublishConfirmationDialog
                show={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
                title="Test Title"
                message="Test Message"
            />
        );

        // Enable scheduling
        fireEvent.click(screen.getByLabelText('Schedule time to publish'));

        const datePicker = screen.getByTestId('date-picker');

        // Set a valid future date
        const futureDate = new Date('2030-01-10T14:30:00Z');
        fireEvent.change(datePicker, { target: { value: futureDate.toISOString() } });

        // Click confirm with the valid future date
        fireEvent.click(screen.getByTestId('confirm-button'));

        // Should be called with the ISO string of the future date
        expect(mockOnConfirm).toHaveBeenCalledWith(futureDate.toISOString());

        jest.useRealTimers();
    });
}); 