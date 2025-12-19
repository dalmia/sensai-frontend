import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CoursePublishSuccessBannerProps {
    isOpen: boolean;
    onClose: () => void;
    cohortId: number | null;
    cohortName: string;
    schoolId: string;
    schoolSlug: string;
    courseCount?: number;
    courseNames?: string[];
    // Source indicates where the banner was triggered from
    source?: 'course' | 'cohort';
}

const CoursePublishSuccessBanner: React.FC<CoursePublishSuccessBannerProps> = ({
    isOpen,
    onClose,
    cohortId,
    cohortName,
    schoolId,
    schoolSlug,
    courseCount = 0,
    courseNames = [],
    source = 'course' // Default to course page as the source
}) => {
    const [isCopied, setIsCopied] = useState(false);

    if (!isOpen) return null;

    // Determine message based on source
    const isCohortSource = source === 'cohort';
    const title = isCohortSource
        ? "Courses are now live"
        : "Your course is now live";
    const description = isCohortSource
        ? (
            <>
                Learners added to this cohort can see {courseCount === 1 ? "this course" : "these courses"} now. Either add them manually from the <strong>Learners</strong> tab or send them an invite link.
            </>
        )
        : (
            <>
                Learners added to this cohort can see this course now. Either add them manually from the{' '}
                <a
                    href={`/school/admin/${schoolId}/cohorts/${cohortId}`}
                    className="text-blue-600 hover:text-blue-800"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    cohort admin dashboard
                </a>{' '}
                or send them an invite link.
            </>
        );

    // Generate the invite link
    const inviteLink = `${window.location.origin}/school/${schoolSlug}/join?cohortId=${cohortId}`;

    const handleCopyInviteLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setIsCopied(true);

            // Reset the copied state after 2 seconds
            setTimeout(() => {
                setIsCopied(false);
            }, 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    };

    return (
        <div data-testid="course-publish-success-banner" className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black bg-opacity-90"></div>

            {/* Main Modal Container */}
            <div className="relative z-10 flex w-[600px] max-w-[90vw] h-[400px] max-h-[90vh] overflow-hidden">

                {/* Left panel - Icon */}
                <div className="w-1/3 bg-black flex flex-col items-center justify-center relative overflow-hidden">
                    {/* Subtle animated background */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-full h-full">
                            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full opacity-30">
                                <path fill="#FFFFFF" d="M40,-65.9C53.2,-60.1,66.3,-52.7,73.7,-41.4C81.2,-30.1,83,-14.9,81.9,-0.6C80.8,13.6,76.9,27.1,69.5,39.3C62.1,51.5,51.2,62.2,38.5,67.5C25.8,72.8,11.3,72.6,-2.5,76.2C-16.3,79.8,-29.9,87.3,-41.9,85.3C-53.9,83.3,-64.3,71.9,-71.2,58.8C-78.2,45.7,-81.8,30.8,-82.9,16C-84,1.2,-82.5,-13.5,-76.8,-25.9C-71.1,-38.2,-61.2,-48.1,-49.2,-54.5C-37.2,-60.9,-23.1,-63.8,-8.9,-69.1C5.3,-74.4,26.8,-71.8,40,-65.9Z" transform="translate(100 100)" style={{ animation: "morphBackground 30s infinite alternate-reverse" }} />
                            </svg>
                        </div>
                    </div>

                    {/* Checkmark with ripple effect */}
                    <div className="relative z-10">
                        <div className="w-20 h-20 rounded-full border-2 border-white flex items-center justify-center mb-6 relative">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>

                            {/* Ripple effect */}
                            <div className="absolute w-full h-full rounded-full border border-white opacity-0 animate-ripple"></div>
                            <div className="absolute w-full h-full rounded-full border border-white opacity-0 animate-ripple" style={{ animationDelay: '1s' }}></div>
                        </div>
                    </div>
                </div>

                {/* Right panel - Text */}
                <div className="w-2/3 bg-white text-[#000] flex flex-col justify-between p-12">
                    <div className="mb-auto">
                        <h2 className="text-3xl font-light text-[#000] mb-6 animate-slideUp">{title}</h2>

                        <div className="pl-3 border-l-2 border-gray-200 animate-slideUp" style={{ animationDelay: '0.2s' }}>
                            <p className="text-[#4b5563] text-sm">
                                {description}
                            </p>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-3 animate-fadeIn" style={{ animationDelay: '0.5s' }}>
                        {/* Copy Invite Link Button */}
                        <button
                            onClick={handleCopyInviteLink}
                            className={`w-full py-3 border font-medium rounded-md transition-colors duration-300 cursor-pointer group flex items-center justify-center ${isCopied
                                ? 'border-green-300 text-green-700 bg-green-50'
                                : 'border-gray-300 text-[#374151] hover:bg-gray-50'
                                }`}
                        >
                            {isCopied ? (
                                <>
                                    <Check size={16} className="mr-2" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy size={16} className="mr-2" />
                                    Copy invite link
                                </>
                            )}
                        </button>

                        {/* Back Button */}
                        <button
                            onClick={onClose}
                            className="w-full py-3 border border-black text-[#000] font-medium rounded-md hover:bg-black hover:text-white transition-colors duration-300 cursor-pointer group"
                        >
                            {isCohortSource ? "Back to Cohort" : "Back to Course"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Animations */}
            <style jsx>{`
                @keyframes ripple {
                    0% {
                        transform: scale(1);
                        opacity: 0.8;
                    }
                    100% {
                        transform: scale(1.5);
                        opacity: 0;
                    }
                }
                
                @keyframes fadeIn {
                    0% {
                        opacity: 0;
                    }
                    100% {
                        opacity: 1;
                    }
                }
                
                @keyframes slideUp {
                    0% {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                @keyframes morphBackground {
                    0% {
                        d: path("M40,-65.9C53.2,-60.1,66.3,-52.7,73.7,-41.4C81.2,-30.1,83,-14.9,81.9,-0.6C80.8,13.6,76.9,27.1,69.5,39.3C62.1,51.5,51.2,62.2,38.5,67.5C25.8,72.8,11.3,72.6,-2.5,76.2C-16.3,79.8,-29.9,87.3,-41.9,85.3C-53.9,83.3,-64.3,71.9,-71.2,58.8C-78.2,45.7,-81.8,30.8,-82.9,16C-84,1.2,-82.5,-13.5,-76.8,-25.9C-71.1,-38.2,-61.2,-48.1,-49.2,-54.5C-37.2,-60.9,-23.1,-63.8,-8.9,-69.1C5.3,-74.4,26.8,-71.8,40,-65.9Z");
                    }
                    50% {
                        d: path("M44.1,-76.5C56.3,-69.5,64.9,-54.3,70.6,-39.1C76.3,-23.9,79.2,-8.8,77.7,5.9C76.2,20.6,70.3,34.9,61.3,46.3C52.3,57.8,40.2,66.5,26.3,71.6C12.5,76.8,-3.1,78.5,-17.1,75.1C-31.1,71.7,-43.6,63.2,-54.1,52.2C-64.7,41.2,-73.2,27.5,-75.3,12.8C-77.4,-1.9,-73,-17.8,-65.7,-31.7C-58.4,-45.5,-48.2,-57.4,-36.1,-64.2C-24,-71,-12,-72.9,2.2,-76.5C16.3,-80,32.6,-85.2,44.1,-76.5Z");
                    }
                    100% {
                        d: path("M38.5,-64.9C47.6,-59,51.2,-42.5,59.3,-28C67.4,-13.5,80.1,-1,78.9,10.1C77.6,21.1,62.5,30.7,50.3,40.9C38.1,51.2,28.9,62.1,16.5,69.1C4.1,76,-11.5,79,-24,74.5C-36.5,69.9,-45.9,57.9,-52.9,45.6C-59.9,33.3,-64.5,20.7,-67.6,7.1C-70.7,-6.5,-72.2,-21.1,-67.2,-33.5C-62.1,-45.9,-50.5,-56.2,-37.5,-59.8C-24.6,-63.3,-10.3,-60.1,2.7,-64.7C15.8,-69.3,29.5,-81.8,38.5,-64.9Z");
                    }
                }
                
                .animate-ripple {
                    animation: ripple 2s ease-out infinite;
                }
                
                .animate-fadeIn {
                    animation: fadeIn 0.8s ease-out forwards;
                }
                
                .animate-slideUp {
                    animation: slideUp 0.8s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default CoursePublishSuccessBanner; 