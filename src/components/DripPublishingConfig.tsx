import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { DripConfig } from "@/types/course";
import Toast from './Toast';

interface DripPublishingConfigProps {
    onConfigChange?: (config: DripConfig | undefined) => void;
}

export interface DripPublishingConfigRef {
    validateDripConfig: () => string | null;
}

// Time units for frequency selection
const TIME_UNITS = [
    'minute',
    'hour', 
    'day',
    'week',
    'month',
    'year'
];

const DripPublishingConfig = forwardRef<DripPublishingConfigRef, DripPublishingConfigProps>(({
    onConfigChange,
}, ref) => {
    const [isDripEnabled, setIsDripEnabled] = useState(false);
    const [frequencyValue, setFrequencyValue] = useState(1);
    const [frequencyUnit, setFrequencyUnit] = useState('day');
    const [isReleaseDateEnabled, setIsReleaseDateEnabled] = useState(false);
    const [publishDate, setPublishDate] = useState<Date | null>(null);
    const [toast, setToast] = useState({
        show: false,
        title: '',
        description: '',
        emoji: ''
    });

    // Notify parent of config changes without validation
    useEffect(() => {
        if (onConfigChange) {
            const config = isDripEnabled ? {
                is_drip_enabled: true,
                frequency_value: frequencyValue,
                frequency_unit: frequencyUnit,
                publish_at: isReleaseDateEnabled && publishDate ? publishDate : null
            } : undefined;

            onConfigChange(config);
        }
    }, [isDripEnabled, frequencyValue, frequencyUnit, isReleaseDateEnabled, publishDate]);

    const handleValidationError = (error: string) => {
        setToast({
            show: true,
            title: 'Invalid publish settings',
            description: error,
            emoji: '❌'
        });

        setTimeout(() => {
            setToast(prev => ({ ...prev, show: false }));
        }, 4000);
    };

    const handleCloseToast = () => {
        setToast(prev => ({ ...prev, show: false }));
    };

    // Expose validation function to parent
    useImperativeHandle(ref, () => ({
        validateDripConfig: () => {
            if (isDripEnabled) {
                if (!frequencyValue || frequencyValue < 1) {
                    const error = 'Please enter a valid value for the release schedule';
                    handleValidationError(error);
                    return error;
                }
                if (!frequencyUnit) {
                    const error = 'Please enter a valid unit for the release schedule';
                    handleValidationError(error);
                    return error;
                }
                if (isReleaseDateEnabled && !publishDate) {
                    const error = 'Please select a release date and time';
                    handleValidationError(error);
                    return error;
                }
            }
            return null;
        }
    }));

    return (
        <>
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-lg dark:!border-gray-800 dark:!bg-[#23282d]">
                {/* Pill Toggle for Drip Publishing */}
                <div className={`flex items-center ${isDripEnabled ? 'mb-4' : ''}`}>
                    <input
                        type="checkbox"
                        id="drip-enabled"
                        checked={isDripEnabled}
                        onChange={(e) => setIsDripEnabled(e.target.checked)}
                        className="mr-3 h-4 w-4 cursor-pointer bg-white border-gray-300 rounded focus:ring-2 focus:ring-[#016037] focus:ring-offset-0 checked:bg-[#016037] checked:border-[#016037] transition-colors dark:!bg-[#181818] dark:!border-gray-600"
                    />
                    <label htmlFor="drip-enabled" className="text-gray-900 dark:text-white text-sm font-light cursor-pointer select-none">
                        Release modules gradually using a drip schedule
                    </label>
                </div>

                {isDripEnabled && (
                    <div className="space-y-4">
                        {/* Frequency Row: Every [number] [unit] */}
                        <div className="flex items-center space-x-2">
                            <span className="text-gray-900 dark:text-white text-sm font-light select-none">Every</span>
                            <input
                                type="number"
                                min="1"
                                value={frequencyValue || ''}
                                onChange={e => setFrequencyValue(Number(e.target.value))}
                                placeholder="1"
                                className="w-20 p-2 bg-white border border-gray-200 text-gray-900 text-sm font-light px-3 rounded-md focus:ring-2 focus:ring-[#016037] transition-all outline-none appearance-none text-center dark:!bg-[#181818] dark:border-0 dark:!text-white"
                            />
                            <select
                                value={frequencyUnit || 'day'}
                                onChange={e => setFrequencyUnit(e.target.value)}
                                className="w-32 p-2 bg-white border border-gray-200 text-gray-900 text-sm font-light px-4 rounded-md focus:ring-2 focus:ring-[#016037] transition-all outline-none appearance-none dark:!bg-[#181818] dark:border-0 dark:!text-white"
                            >
                                <option value="" disabled>Select unit</option>
                                {TIME_UNITS.map(unit => (
                                    <option key={unit} value={unit}>{unit}{frequencyValue <= 1 ? '' : 's'}</option>
                                ))}
                            </select>
                        </div>

                        <div className={`flex items-center ${isReleaseDateEnabled ? 'mb-4' : ''}`}>
                            <input
                                type="checkbox"
                                id="release-date-enabled"
                                checked={isReleaseDateEnabled}
                                onChange={(e) => setIsReleaseDateEnabled(e.target.checked)}
                                className="mr-3 h-4 w-4 cursor-pointer bg-white border-gray-300 rounded focus:ring-2 focus:ring-[#016037] focus:ring-offset-0 checked:bg-[#016037] checked:border-[#016037] transition-colors dark:!bg-[#181818] dark:!border-gray-600"
                            />
                            <label htmlFor="release-date-enabled" className="text-gray-900 dark:text-white text-sm font-light cursor-pointer select-none">
                                Set a specific start date and time
                            </label>
                        </div>

                        {/* Combined Date and Time Picker */}
                        {isReleaseDateEnabled && (
                            <div>
                                <label className="block text-sm text-gray-700 dark:text-gray-300 font-light mb-1">Release date & time</label>
                                <DatePicker
                                    selected={publishDate}
                                    onChange={(date) => setPublishDate(date)}
                                    showTimeSelect
                                    timeFormat="HH:mm"
                                    timeIntervals={15}
                                    dateFormat="MMMM d, yyyy h:mm aa"
                                    timeCaption="Time"
                                    minDate={new Date()}
                                    placeholderText="Select release date and time"
                                    className="bg-white border border-gray-200 rounded-md p-2 px-4 w-full text-sm text-gray-900 placeholder:text-gray-500 cursor-pointer dark:!bg-[#181818] dark:border-0 dark:!text-white"
                                    wrapperClassName="w-full"
                                    popperClassName="drip-publishing-datepicker-popper"
                                    calendarClassName="bg-white text-gray-900 border border-gray-200 rounded-lg shadow-lg cursor-pointer dark:bg-[#242424] dark:text-white dark:border-gray-700"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Theme react-datepicker popover (calendar + time list) in dark mode only */}
            <style jsx global>{`
                .dark .drip-publishing-datepicker-popper .react-datepicker {
                    background: #242424;
                    color: #ffffff;
                    border: 1px solid #374151; /* gray-700 */
                }
                .dark .drip-publishing-datepicker-popper .react-datepicker__month-container,
                .dark .drip-publishing-datepicker-popper .react-datepicker__time-container,
                .dark .drip-publishing-datepicker-popper .react-datepicker__time,
                .dark .drip-publishing-datepicker-popper .react-datepicker__time-box,
                .dark .drip-publishing-datepicker-popper .react-datepicker__time-list {
                    background: #242424;
                    color: #ffffff;
                }
                .dark .drip-publishing-datepicker-popper .react-datepicker__header,
                .dark .drip-publishing-datepicker-popper .react-datepicker__header--time {
                    background: #242424;
                    border-bottom: 1px solid #374151; /* gray-700 */
                }
                .dark .drip-publishing-datepicker-popper .react-datepicker__current-month,
                .dark .drip-publishing-datepicker-popper .react-datepicker-time__header,
                .dark .drip-publishing-datepicker-popper .react-datepicker__day-name {
                    color: #ffffff;
                }
                .dark .drip-publishing-datepicker-popper .react-datepicker__day {
                    color: #e5e7eb; /* gray-200 */
                }
                .dark .drip-publishing-datepicker-popper .react-datepicker__day--outside-month,
                .dark .drip-publishing-datepicker-popper .react-datepicker__day--disabled,
                .dark .drip-publishing-datepicker-popper .react-datepicker__time-list-item--disabled {
                    color: #6b7280; /* gray-500 */
                }
                .dark .drip-publishing-datepicker-popper .react-datepicker__day:hover,
                .dark .drip-publishing-datepicker-popper .react-datepicker__time-list-item:hover {
                    background: #374151; /* gray-700 */
                }
                .dark .drip-publishing-datepicker-popper .react-datepicker__time-list-item {
                    color: #e5e7eb; /* gray-200 */
                }
                .dark .drip-publishing-datepicker-popper .react-datepicker__navigation-icon::before {
                    border-color: #e5e7eb;
                }
                .dark .drip-publishing-datepicker-popper .react-datepicker__triangle {
                    color: #374151;
                }
            `}</style>

            {/* Toast notification */}
            <Toast
                show={toast.show}
                title={toast.title}
                description={toast.description}
                emoji={toast.emoji}
                onClose={handleCloseToast}
            />
        </>
    );
});

DripPublishingConfig.displayName = 'DripPublishingConfig';

export default DripPublishingConfig; 