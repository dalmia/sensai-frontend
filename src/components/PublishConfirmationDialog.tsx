import { useState } from 'react';
import ConfirmationDialog from './ConfirmationDialog';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface PublishConfirmationDialogProps {
    show: boolean;
    onConfirm: (scheduledPublishAt: string | null) => void;
    onCancel: () => void;
    isLoading?: boolean;
    errorMessage?: string | null;
    title: string;
    message: string;
}

const PublishConfirmationDialog = ({
    show,
    onConfirm,
    onCancel,
    isLoading = false,
    errorMessage = null,
    title,
    message,
}: PublishConfirmationDialogProps) => {
    // State for scheduling
    const [scheduleForLater, setScheduleForLater] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<Date | null>(null);

    // Validate scheduled date
    const verifyScheduledDateAndSchedulePublish = (date: Date | null) => {
        if (!date) {
            return;
        }

        if (date < new Date()) {
            return; // Don't allow dates in the past
        }

        setScheduledDate(date);
    }

    // Reset scheduling state when dialog is closed
    if (!show) {
        if (scheduleForLater) setScheduleForLater(false);
        if (scheduledDate) setScheduledDate(null);
    }

    // Handle confirmation with scheduling data
    const handleConfirm = () => {
        let scheduledDateISOString = null;
        if (scheduleForLater && scheduledDate) {
            scheduledDateISOString = scheduledDate.toISOString();
        }
        onConfirm(scheduledDateISOString);
    };

    // Render the scheduler UI
    const renderScheduleOptions = () => {
        return (
            <div className="mt-4">
                <div className={`flex items-center ${scheduleForLater ? 'mb-3' : ''}`}>
                    <input
                        type="checkbox"
                        id="schedule-for-later"
                        checked={scheduleForLater}
                        onChange={(e) => {
                            setScheduleForLater(e.target.checked);
                            // Set default scheduled date to tomorrow at same time if nothing is set
                            if (e.target.checked && !scheduledDate) {
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                setScheduledDate(tomorrow);
                            }
                        }}
                        className="mr-2 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="schedule-for-later" className="text-white cursor-pointer flex items-center">
                        Schedule time to publish
                    </label>
                </div>

                {scheduleForLater && (
                    <DatePicker
                        selected={scheduledDate}
                        onChange={(date) => verifyScheduledDateAndSchedulePublish(date)}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MMMM d, yyyy h:mm aa"
                        timeCaption="Time"
                        minDate={new Date()} // Can't schedule in the past
                        className="bg-[#333333] rounded-md p-2 px-4 w-full text-white cursor-pointer"
                        wrapperClassName="w-full"
                        calendarClassName="bg-[#242424] text-white border border-gray-700 rounded-lg shadow-lg cursor-pointer"
                    />
                )}
            </div>
        );
    };

    return (
        <ConfirmationDialog
            open={show}
            title={title}
            message={message}
            onConfirm={handleConfirm}
            onCancel={onCancel}
            isLoading={isLoading}
            errorMessage={errorMessage}
            type="publish"
            confirmButtonText={scheduleForLater ? "Schedule" : "Publish"}
        >
            {renderScheduleOptions()}
        </ConfirmationDialog>
    );
};

export default PublishConfirmationDialog; 