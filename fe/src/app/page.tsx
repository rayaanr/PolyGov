import { Suspense } from "react";
import Dashboard from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import ProposalsList from "@/components/test";

export default function Page() {
    return (
        <div className="min-h-screen bg-background">
            <Suspense fallback={<Skeleton className="h-[800px]" />}>
                <Dashboard />
                <ProposalsList />
            </Suspense>
        </div>
    );
}
