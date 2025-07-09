"use client";

import { useParams } from "next/navigation";
import ClientSchoolMemberView from "./ClientSchoolMemberView";

export default function SchoolPage() {
    const params = useParams();
    const id = params?.id as string;

    return <ClientSchoolMemberView slug={id} />;
} 