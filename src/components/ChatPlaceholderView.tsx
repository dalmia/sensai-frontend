import React from 'react';

interface ChatPlaceholderViewProps {
    taskType: 'quiz' | 'learning_material' | 'assignment';
    isChatHistoryLoaded: boolean;
    isTestMode: boolean;
    inputType?: string;
    viewOnly?: boolean;
    responseType?: 'chat' | 'exam';
}

const ChatPlaceholderView: React.FC<ChatPlaceholderViewProps> = ({
    taskType,
    isChatHistoryLoaded,
    isTestMode,
    inputType = 'text',
    viewOnly = false,
    responseType = 'chat'
}) => {
    return (
        <div className="flex flex-col items-center justify-center h-full w-full">
            {!isChatHistoryLoaded && !isTestMode ? (
                // Loading spinner while chat history is loading
                <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
                </div>
            ) : (
                // Show placeholder text only when history is loaded but empty
                <>
                    <h2 className="text-4xl font-light text-white mb-6 text-center">
                        {viewOnly
                            ? taskType === 'assignment'
                                ? 'No submission yet'
                                : 'No activity yet'
                            : taskType === 'learning_material'
                                ? 'Have a question?'
                                : taskType === 'assignment'
                                    ? 'Ready to submit your project?'
                                    : responseType === 'exam'
                                        ? 'Ready to test your knowledge?'
                                        : 'Ready for a challenge?'
                        }
                    </h2>
                    <div className="text-gray-400 text-center max-w-md mx-6 sm:mx-auto mb-8">
                        {viewOnly
                            ? taskType === 'assignment'
                                ? <p>There is no submission history for this assignment</p>
                                : <p>There is no chat history for this quiz</p>
                            : taskType === 'learning_material'
                                ? <p>Ask your doubt here and AI will help you understand the material better</p>
                                : taskType === 'assignment'
                                    ? (
                                        <p className="text-gray-300 font-light text-center mt-1">
                                            Upload your project as a .zip file. Make sure to include all the relevant files. Be careful as you can upload your submission just once.
                                        </p>
                                    )
                                    : responseType === 'exam'
                                        ? (
                                            <div className="bg-[#1a1a1a] rounded-xl px-6 py-5 flex flex-col items-center justify-center max-w-lg mx-auto">
                                                <span className="flex items-center gap-2 mb-2">
                                                    <span className="text-red-400 text-lg" style={{ fontWeight: 300 }}>●</span>
                                                    <span className="text-red-400 font-light text-base">One-time Submission</span>
                                                </span>
                                                <span className="text-gray-300 font-light text-center mt-1">
                                                    {inputType === 'code'
                                                        ? `Think through your answer carefully, then write your code in the code editor. You can attempt the question only once. Be careful and confident.`
                                                        : `Think through your answer carefully, then ${inputType === 'audio' ? 'record' : 'type'} it here. You can attempt the question only once. Be careful and confident.`}
                                                </span>
                                            </div>
                                        )
                                        : (
                                            <p>
                                                {inputType === 'code'
                                                    ? `Think through your answer, then write your code in the code editor. You can also type your response below if you want to ask or say something that is not code. You will receive instant feedback and support throughout your journey`
                                                    : `Think through your answer, then ${inputType === 'audio' ? 'record' : 'type'} it here. You will receive instant feedback and support throughout your journey`}
                                            </p>
                                        )
                        }
                    </div>
                </>
            )}
        </div>
    );
};

export default ChatPlaceholderView; 