import { Suspense } from "react";
import Dashboard from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
    return (
        <div className="min-h-screen bg-background">
            <Suspense fallback={<Skeleton className="h-[800px]" />}>
                <Dashboard />
            </Suspense>
        </div>
    );
}
