import { Skeleton } from "@/components/ui/skeleton";

export function ProposalSkeleton() {
    // Create an array of 6 items for the skeleton
    const skeletonItems = Array.from({ length: 6 }, (_, i) => i);

    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {skeletonItems.map((item) => (
                <div key={item} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-[200px]" />
                            <Skeleton className="h-4 w-[250px]" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-12" />
                        </div>
                        <Skeleton className="h-2 w-full" />

                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-12" />
                        </div>
                        <Skeleton className="h-2 w-full" />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                    </div>
                </div>
            ))}
        </div>
    );
}
