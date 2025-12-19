import React, { useRef, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Cohort } from '@/types';

interface MemberSchoolViewHeaderProps {
    cohorts: Cohort[];
    activeCohort: Cohort | null;
    onCohortSelect: (cohort: Cohort) => void;
    batches?: { id: number, name: string }[];
    activeBatchId?: number | null;
    onBatchSelect?: (batchId: number) => void;
}

const MemberSchoolViewHeader: React.FC<MemberSchoolViewHeaderProps> = ({
    cohorts,
    activeCohort,
    onCohortSelect,
    batches = [],
    activeBatchId = null,
    onBatchSelect,
}) => {
    const cohortDropdownRef = useRef<HTMLDivElement>(null);
    const batchDropdownRef = useRef<HTMLDivElement>(null);
    const [cohortDropdownOpen, setCohortDropdownOpen] = useState(false);
    const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (cohortDropdownRef.current && !cohortDropdownRef.current.contains(event.target as Node)) {
                setCohortDropdownOpen(false);
            }
            if (batchDropdownRef.current && !batchDropdownRef.current.contains(event.target as Node)) {
                setBatchDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <>
            {/* Cohort Selector */}
            {cohorts.length > 1 ? (
                <div className="relative" ref={cohortDropdownRef}>
                    <button
                        className="flex items-center text-xl font-light bg-transparent rounded-full px-4 py-2 cursor-pointer truncate max-w-none hover:bg-gray-100 dark:hover:bg-[#0f0f0f]"
                        onClick={() => setCohortDropdownOpen(!cohortDropdownOpen)}
                    >
                        <span className="truncate">{activeCohort?.name}</span>
                        <ChevronDown className="ml-1 sm:ml-2 h-5 w-5 flex-shrink-0" />
                    </button>
                    {cohortDropdownOpen && (
                        <div className="absolute left-1/2 transform -translate-x-1/2 z-50 mt-1 w-full min-w-[200px] rounded-lg shadow-lg max-h-[500px] overflow-y-auto bg-white dark:bg-[#0f0f0f] border border-gray-200 dark:border-transparent">
                            <ul className="py-2">
                                {cohorts.map(cohort => (
                                    <li
                                        key={cohort.id}
                                        className={`px-4 py-3 cursor-pointer truncate hover:bg-gray-100 dark:hover:bg-gray-900 ${activeCohort?.id === cohort.id ? 'text-black dark:text-white font-light' : 'text-gray-600 dark:text-gray-300'}`}
                                        onClick={() => { onCohortSelect(cohort); setCohortDropdownOpen(false); }}
                                    >
                                        {cohort.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                <h2 className="text-xl font-light truncate max-w-none text-black dark:text-white">{activeCohort?.name}</h2>
            )}
            {/* Batch Selector */}
            {batches && batches.length > 1 && (
                <div className="relative" ref={batchDropdownRef}>
                    <button
                        className="flex items-center text-base font-light bg-transparent rounded-full px-4 py-2 cursor-pointer truncate max-w-none border ml-2 hover:bg-gray-100 dark:hover:bg-[#0f0f0f] border-gray-300 dark:border-gray-700"
                        onClick={() => setBatchDropdownOpen(!batchDropdownOpen)}
                    >
                        <span className="truncate">{batches.find(b => b.id === activeBatchId)?.name || 'Select Batch'}</span>
                        <ChevronDown className="ml-1 h-5 w-5 flex-shrink-0" />
                    </button>
                    {batchDropdownOpen && (
                        <div className="absolute left-1/2 transform -translate-x-1/2 z-10 mt-1 w-full min-w-[160px] rounded-lg shadow-lg bg-white dark:bg-[#0f0f0f] border border-gray-200 dark:border-transparent">
                            <ul className="py-2">
                                {batches.map(batch => (
                                    <li
                                        key={batch.id}
                                        className={`px-4 py-3 cursor-pointer truncate hover:bg-gray-100 dark:hover:bg-gray-900 ${activeBatchId === batch.id ? 'text-black dark:text-white font-light' : 'text-gray-600 dark:text-gray-300'}`}
                                        onClick={() => { onBatchSelect && onBatchSelect(batch.id); setBatchDropdownOpen(false); }}
                                    >
                                        {batch.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default MemberSchoolViewHeader; 