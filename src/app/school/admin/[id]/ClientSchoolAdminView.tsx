"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Edit, Save, Users, BookOpen, Layers, Building, ChevronDown, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import CourseCard from "@/components/CourseCard";
import CohortCard from "@/components/CohortCard";
import InviteMembersDialog from "@/components/InviteMembersDialog";
import CreateCohortDialog from "@/components/CreateCohortDialog";
import CreateCourseDialog from '@/components/CreateCourseDialog';
import Toast from "@/components/Toast";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { Cohort, TeamMember, Course } from "@/types";

interface School {
    id: number;
    name: string;
    url: string;
    courses: Course[];
    cohorts: Cohort[];
    members: TeamMember[];
}

type TabType = 'courses' | 'cohorts' | 'members';

export default function ClientSchoolAdminView({ id }: { id: string }) {
    const router = useRouter();
    const { data: session } = useSession();
    const [school, setSchool] = useState<School | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('courses');
    const [isEditingName, setIsEditingName] = useState(false);
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isCreateCohortDialogOpen, setIsCreateCohortDialogOpen] = useState(false);
    const [isCreateCourseDialogOpen, setIsCreateCourseDialogOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
    const schoolNameRef = useRef<HTMLHeadingElement>(null);
    // Add state for selected members
    const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
    // Add state for toast notifications
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState({
        title: '',
        description: '',
        emoji: ''
    });

    // Add useEffect to automatically hide toast after 5 seconds
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => {
                setShowToast(false);
            }, 5000);

            // Cleanup the timer when component unmounts or showToast changes
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // Initialize tab from URL hash
    useEffect(() => {
        // Check if there's a hash in the URL
        const hash = window.location.hash.replace('#', '');
        if (hash === 'cohorts' || hash === 'members') {
            setActiveTab(hash as TabType);
        }
    }, []);

    // Fetch school data
    useEffect(() => {
        const fetchSchool = async () => {
            setLoading(true);
            try {
                // Fetch basic school info
                const schoolResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}`);
                if (!schoolResponse.ok) {
                    throw new Error(`API error: ${schoolResponse.status}`);
                }
                const schoolData = await schoolResponse.json();

                // Fetch members separately
                const membersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`);
                if (!membersResponse.ok) {
                    throw new Error(`API error: ${membersResponse.status}`);
                }
                const membersData = await membersResponse.json();

                // Fetch cohorts separately
                const cohortsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/?org_id=${id}`);
                if (!cohortsResponse.ok) {
                    throw new Error(`API error: ${cohortsResponse.status}`);
                }
                const cohortsData = await cohortsResponse.json();

                // Fetch courses separately
                const coursesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/?org_id=${id}`);
                if (!coursesResponse.ok) {
                    throw new Error(`API error: ${coursesResponse.status}`);
                }
                const coursesData = await coursesResponse.json();

                // Transform the API response to match the School interface
                const transformedSchool: School = {
                    id: parseInt(schoolData.id),
                    name: schoolData.name,
                    url: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolData.slug}`,
                    courses: coursesData.map((course: any) => ({
                        id: course.id,
                        name: course.name,
                        moduleCount: 0, // Default value since API doesn't provide this
                        description: '' // Default value since API doesn't provide this
                    })),
                    cohorts: cohortsData.map((cohort: any) => ({
                        id: cohort.id,
                        name: cohort.name,
                    })),
                    members: membersData || []  // Use the members from the separate endpoint
                };

                setSchool(transformedSchool);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching school:", error);
                setLoading(false);
            }
        };

        fetchSchool();
    }, [id, router]);

    // Handle clicking outside the name edit field
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (isEditingName && schoolNameRef.current && !schoolNameRef.current.contains(event.target as Node)) {
                setIsEditingName(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isEditingName, schoolNameRef]);

    // Toggle name editing
    const toggleNameEdit = () => {
        setIsEditingName(!isEditingName);
        // Focus the name field when editing is enabled
        if (!isEditingName) {
            setTimeout(() => {
                if (schoolNameRef.current) {
                    schoolNameRef.current.focus();
                    // Place cursor at the end of the text
                    const range = document.createRange();
                    const selection = window.getSelection();
                    range.selectNodeContents(schoolNameRef.current);
                    range.collapse(false);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
            }, 0);
        }
    };

    // Handle name blur
    const handleNameBlur = () => {
        setIsEditingName(false);
    };

    // Handle keyboard events for name editing
    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setIsEditingName(false);
        }
    };

    const handleInviteMembers = async (emails: string[]) => {
        try {
            // Make API call to invite members
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ emails }),
            });

            if (!response.ok) {
                throw new Error('Failed to invite members');
            }

            // Refresh school data to get updated members list
            const membersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`);
            if (!membersResponse.ok) {
                throw new Error('Failed to fetch updated members');
            }
            const membersData = await membersResponse.json();

            // Update school state with new members
            setSchool(prev => prev ? {
                ...prev,
                members: membersData
            } : null);

            // Close the invite dialog
            setIsInviteDialogOpen(false);

            // Show toast notification
            setToastMessage({
                title: 'Growing the tribe',
                description: `${emails.length} ${emails.length === 1 ? 'member' : 'members'} has been invited to your team`,
                emoji: '🎉'
            });
            setShowToast(true);

        } catch (error) {
            console.error('Error inviting members:', error);
            // Here you would typically show an error message to the user
        }
    };

    // Check if a member is the current user
    const isCurrentUser = (member: TeamMember) => {
        return session?.user?.id === member.id.toString();
    };

    const handleDeleteMember = (member: TeamMember) => {
        // Don't allow deleting yourself
        if (isCurrentUser(member)) return;

        setMemberToDelete(member);
        setSelectedMembers([]);
        setIsDeleteConfirmOpen(true);
    };

    // Handle multiple members deletion
    const handleDeleteSelectedMembers = () => {
        setMemberToDelete(null);
        setIsDeleteConfirmOpen(true);
    };

    // Updated to handle both single and multiple member deletion
    const confirmDeleteMember = async () => {
        const membersToDelete = memberToDelete ? [memberToDelete] : selectedMembers;
        if (membersToDelete.length === 0) return;

        try {
            // Make API call to delete member(s)
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_ids: membersToDelete.map(member => member.id)
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to delete member(s)');
            }

            // Refresh school data to get updated members list
            const membersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`);
            if (!membersResponse.ok) {
                throw new Error('Failed to fetch updated members');
            }
            const membersData = await membersResponse.json();

            // Update school state with new members
            setSchool(prev => prev ? {
                ...prev,
                members: membersData
            } : null);

            // Show toast notification for successful deletion
            setToastMessage({
                title: 'The tribe has shrunk!',
                description: membersToDelete.length === 1
                    ? `${membersToDelete[0].email} has been removed from your team`
                    : `${membersToDelete.length} members have been removed from your team`,
                emoji: '😢'
            });
            setShowToast(true);

        } catch (error) {
            console.error('Error deleting member(s):', error);
            // Here you would typically show an error message to the user
        } finally {
            setIsDeleteConfirmOpen(false);
            setMemberToDelete(null);
            setSelectedMembers([]);
        }
    };

    // Handle member selection toggle
    const handleMemberSelection = (member: TeamMember) => {
        // Don't allow selecting yourself
        if (isCurrentUser(member)) return;

        setSelectedMembers(prevSelected => {
            // Check if this member is already selected
            const isSelected = prevSelected.some(m => m.id === member.id);

            // If selected, remove it; if not, add it
            return isSelected
                ? prevSelected.filter(m => m.id !== member.id)
                : [...prevSelected, member];
        });
    };

    // Handle "select all" functionality
    const handleSelectAllMembers = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // Filter out owner members and current user since they can't be deleted
            const selectableMembers = school?.members.filter(member =>
                member.role !== 'owner' && !isCurrentUser(member)
            ) || [];
            setSelectedMembers(selectableMembers);
        } else {
            setSelectedMembers([]);
        }
    };

    // Check if all selectable members are selected
    const areAllMembersSelected = () => {
        if (!school) return false;
        const selectableMembers = school.members.filter(member =>
            member.role !== 'owner' && !isCurrentUser(member)
        );
        return selectableMembers.length > 0 && selectedMembers.length === selectableMembers.length;
    };

    // Check if there are any members that can be selected/deleted
    const hasSelectableMembers = () => {
        if (!school) return false;
        return school.members.some(member =>
            member.role !== 'owner' && !isCurrentUser(member)
        );
    };

    const handleCreateCohort = async (cohort: any) => {
        try {
            // Important: Navigate before closing the dialog to prevent flash of school page
            // This navigation will unmount the current component, which implicitly closes the dialog
            if (cohort && cohort.id) {
                router.push(`/school/admin/${id}/cohorts/${cohort.id}`);
            } else {
                console.error("Cohort ID is missing in the response:", cohort);
                // Fallback to schools page if ID is missing and close dialog
                setIsCreateCohortDialogOpen(false);
                router.push(`/school/admin/${id}#cohorts`);
            }
        } catch (error) {
            console.error('Error handling cohort creation:', error);
            setIsCreateCohortDialogOpen(false);
        }
    };

    // Handle course creation success
    const handleCourseCreationSuccess = (courseData: { id: string; name: string }) => {
        // Redirect to the new course page - dialog will be unmounted during navigation
        router.push(`/school/admin/${id}/courses/${courseData.id}`);
    };

    // Handle tab change
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);

        // Only add hash for non-default tabs
        if (tab !== 'courses') {
            window.location.hash = tab;
        } else {
            // Remove hash if it's the courses tab
            if (window.location.hash && typeof window !== 'undefined' && window.history) {
                history.pushState("", document.title, window.location.pathname);
            }
        }
    };

    const handleCohortDelete = async (cohortId: number) => {
        try {
            // Refresh school data to get updated cohorts list
            const cohortsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/?org_id=${id}`);
            if (!cohortsResponse.ok) {
                throw new Error('Failed to fetch updated cohorts');
            }
            const cohortsData = await cohortsResponse.json();

            // Update school state with new cohorts
            setSchool(prev => prev ? {
                ...prev,
                cohorts: cohortsData
            } : null);

            // Show toast notification for successful deletion
            setToastMessage({
                title: 'Cohort removed',
                description: `Cohort has been removed from your school`,
                emoji: '✓'
            });
            setShowToast(true);
        } catch (error) {
            console.error('Error refreshing cohorts list:', error);
            // Here you would typically show an error message to the user
        }
    };

    const handleCourseDelete = async (courseId: string | number) => {
        try {
            // Refresh school data to get updated courses list
            const coursesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/?org_id=${id}`);
            if (!coursesResponse.ok) {
                throw new Error('Failed to fetch updated courses');
            }
            const coursesData = await coursesResponse.json();

            // Update school state with new courses
            setSchool(prev => prev ? {
                ...prev,
                courses: coursesData.map((course: any) => ({
                    id: course.id,
                    name: course.name,
                }))
            } : null);

            // Show toast notification for successful deletion
            setToastMessage({
                title: 'Course removed',
                description: `Course has been removed from your school`,
                emoji: '✓'
            });
            setShowToast(true);
        } catch (error) {
            console.error('Error refreshing courses list:', error);
            // Here you would typically show an error message to the user
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white">
                <Header showCreateCourseButton={false} />
                <div className="flex justify-center items-center py-12">
                    <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!school) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p>School not found</p>
            </div>
        );
    }

    return (
        <>
            <Header showCreateCourseButton={false} />

            <div className="min-h-screen bg-black text-white">
                <div className="container mx-auto px-4 py-8">
                    <main>
                        {/* School header with title */}
                        <div className="mb-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="w-12 h-12 bg-purple-700 rounded-lg flex items-center justify-center mr-4">
                                        <Building size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="flex items-center">
                                            <h1
                                                ref={schoolNameRef}
                                                contentEditable={isEditingName}
                                                suppressContentEditableWarning
                                                className={`text-3xl font-light outline-none ${isEditingName ? 'border-b border-white' : ''}`}
                                                onBlur={handleNameBlur}
                                                onKeyDown={handleNameKeyDown}
                                            >
                                                {school.name}
                                            </h1>
                                            {/* <button
                                                onClick={toggleNameEdit}
                                                className="ml-2 p-2 text-gray-400 hover:text-white"
                                                aria-label={isEditingName ? "Save school name" : "Edit school name"}
                                            >
                                                {isEditingName ? <Save size={16} /> : <Edit size={16} />}
                                            </button> */}
                                        </div>
                                        <div className="flex items-center mt-1">
                                            <p className="text-gray-400">{school.url}</p>
                                            <a
                                                href={school.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                                aria-label="Open school URL"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs for navigation */}
                        <div className="mb-8">
                            <div className="flex border-b border-gray-800">
                                <button
                                    className={`px-4 py-2 font-light cursor-pointer ${activeTab === 'courses' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}
                                    onClick={() => handleTabChange('courses')}
                                >
                                    <div className="flex items-center">
                                        <BookOpen size={16} className="mr-2" />
                                        Courses
                                    </div>
                                </button>
                                <button
                                    className={`px-4 py-2 font-light cursor-pointer ${activeTab === 'cohorts' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}
                                    onClick={() => handleTabChange('cohorts')}
                                >
                                    <div className="flex items-center">
                                        <Layers size={16} className="mr-2" />
                                        Cohorts
                                    </div>
                                </button>
                                <button
                                    className={`px-4 py-2 font-light cursor-pointer ${activeTab === 'members' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}
                                    onClick={() => handleTabChange('members')}
                                >
                                    <div className="flex items-center">
                                        <Users size={16} className="mr-2" />
                                        Team
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Tab content */}
                        <div>
                            {/* Courses Tab */}
                            {activeTab === 'courses' && (
                                <div>
                                    {school.courses.length > 0 ? (
                                        <>
                                            <div className="flex justify-start items-center mb-6">
                                                <button
                                                    onClick={() => setIsCreateCourseDialogOpen(true)}
                                                    className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity inline-block cursor-pointer"
                                                >
                                                    Create course
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {school.courses.map(course => (
                                                    <CourseCard
                                                        key={course.id}
                                                        course={{
                                                            id: course.id,
                                                            title: course.name,
                                                            org_id: Number(id)
                                                        }}
                                                        onDelete={handleCourseDelete}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <h2 className="text-4xl font-light mb-4">What if your next big idea became a course?</h2>
                                            <p className="text-gray-400 mb-8">It might be easier than you think</p>
                                            <button
                                                onClick={() => setIsCreateCourseDialogOpen(true)}
                                                className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity inline-block cursor-pointer"
                                            >
                                                Create course
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Cohorts Tab */}
                            {activeTab === 'cohorts' && (
                                <div>
                                    {school.cohorts.length > 0 ? (
                                        <>
                                            <div className="flex justify-start items-center mb-6">
                                                <button
                                                    className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                                                    onClick={() => {
                                                        setIsCreateCohortDialogOpen(true);
                                                    }}
                                                >
                                                    Create cohort
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {school.cohorts.map(cohort => (
                                                    <CohortCard
                                                        key={cohort.id}
                                                        cohort={cohort}
                                                        schoolId={school.id}
                                                        onDelete={handleCohortDelete}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <h2 className="text-4xl font-light mb-4">Bring your courses to life with cohorts</h2>
                                            <p className="text-gray-400 mb-8">Create groups of learners and assign them courses to learn together</p>
                                            <button
                                                className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                                                onClick={() => {
                                                    setIsCreateCohortDialogOpen(true);
                                                }}
                                            >
                                                Create cohort
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Team Tab */}
                            {activeTab === 'members' && (
                                <div>
                                    <div className="flex justify-start items-center mb-6 gap-4">
                                        <button
                                            className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                                            onClick={() => setIsInviteDialogOpen(true)}
                                        >
                                            Invite members
                                        </button>
                                        {selectedMembers.length > 0 && (
                                            <button
                                                className="px-6 py-3 bg-red-800 text-white text-sm font-medium rounded-full hover:bg-red-900 transition-colors focus:outline-none cursor-pointer flex items-center"
                                                onClick={handleDeleteSelectedMembers}
                                            >
                                                <Trash2 size={16} className="mr-2" />
                                                Remove ({selectedMembers.length})
                                            </button>
                                        )}
                                    </div>

                                    <div className="overflow-hidden rounded-lg border border-gray-800">
                                        <table className="min-w-full divide-y divide-gray-800">
                                            <thead className="bg-gray-900">
                                                <tr>
                                                    <th scope="col" className="w-10 px-3 py-3 text-left">
                                                        <div className="flex items-center justify-center">
                                                            {hasSelectableMembers() && (
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-5 w-5 rounded-md border-2 border-purple-600 text-white appearance-none checked:bg-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-30 focus:outline-none bg-[#111111] cursor-pointer transition-all duration-200 ease-in-out hover:border-purple-500 relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:w-2.5 before:h-2.5 before:opacity-0 before:bg-white checked:before:opacity-100 checked:before:scale-100 before:scale-0 before:rounded-sm before:transition-all before:duration-200 checked:border-transparent"
                                                                    checked={areAllMembersSelected()}
                                                                    onChange={handleSelectAllMembers}
                                                                    title="Select all members"
                                                                />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-[#111] divide-y divide-gray-800">
                                                {school.members.map(member => (
                                                    <tr key={member.id}>
                                                        <td className="w-10 px-4 py-4 whitespace-nowrap">
                                                            <div className="flex justify-center">
                                                                {member.role !== 'owner' && !isCurrentUser(member) && (
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-5 w-5 rounded-md border-2 border-purple-600 text-white appearance-none checked:bg-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-30 focus:outline-none bg-[#111111] cursor-pointer transition-all duration-200 ease-in-out hover:border-purple-500 relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:w-2.5 before:h-2.5 before:opacity-0 before:bg-white checked:before:opacity-100 checked:before:scale-100 before:scale-0 before:rounded-sm before:transition-all before:duration-200 checked:border-transparent"
                                                                        checked={selectedMembers.some(m => m.id === member.id)}
                                                                        onChange={() => handleMemberSelection(member)}
                                                                    />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{member.email}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm flex justify-between items-center">
                                                            <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${member.role === 'owner' ? 'bg-purple-900 text-purple-200' : 'bg-gray-800 text-gray-300'}`}>
                                                                {member.role === 'owner' ? 'Owner' : 'Admin'}
                                                            </span>
                                                            {member.role !== 'owner' && !isCurrentUser(member) && (
                                                                <button
                                                                    onClick={() => handleDeleteMember(member)}
                                                                    className="flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors focus:outline-none cursor-pointer"
                                                                    aria-label="Remove Member"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>

            {/* Invite Members Dialog */}
            <InviteMembersDialog
                open={isInviteDialogOpen}
                onClose={() => setIsInviteDialogOpen(false)}
                onInvite={handleInviteMembers}
            />

            {/* Delete Member Confirmation Dialog */}
            <ConfirmationDialog
                show={isDeleteConfirmOpen}
                title={memberToDelete || selectedMembers.length == 1 ? "Remove member" : "Remove selected members"}
                message={memberToDelete
                    ? `Are you sure you want to remove ${memberToDelete.email} from this organization?`
                    : `Are you sure you want to remove ${selectedMembers.length} ${selectedMembers.length === 1 ? 'member' : 'members'} from this organization?`
                }
                confirmButtonText="Remove"
                onConfirm={confirmDeleteMember}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                type="delete"
            />

            {/* Create cohort Dialog */}
            <CreateCohortDialog
                open={isCreateCohortDialogOpen}
                onClose={() => setIsCreateCohortDialogOpen(false)}
                onCreateCohort={handleCreateCohort}
                schoolId={id}
            />

            {/* Create course Dialog */}
            <CreateCourseDialog
                open={isCreateCourseDialogOpen}
                onClose={() => setIsCreateCourseDialogOpen(false)}
                onSuccess={handleCourseCreationSuccess}
                schoolId={id}
            />

            {/* Toast notification */}
            <Toast
                show={showToast}
                title={toastMessage.title}
                description={toastMessage.description}
                emoji={toastMessage.emoji}
                onClose={() => setShowToast(false)}
            />
        </>
    );
} 