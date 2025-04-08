import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export function ProposalSkeleton() {
    // Create an array of 6 items for the skeleton
    const skeletonItems = Array.from({ length: 6 }, (_, i) => i);

    return (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {skeletonItems.map((item) => (
                <Card key={item} className="h-full border-border flex flex-col">
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-[180px]" />
                                <Skeleton className="h-8 w-[220px]" />
                            </div>
                            <Skeleton className="h-5 w-14 ml-2" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 py-2 flex-grow">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Skeleton className="h-3 w-10" />
                                <Skeleton className="h-3 w-8" />
                            </div>
                            <Skeleton className="h-1 w-full" />

                            <div className="flex justify-between">
                                <Skeleton className="h-3 w-12" />
                                <Skeleton className="h-3 w-8" />
                            </div>
                            <Skeleton className="h-1 w-full" />
                        </div>

                        <div className="flex gap-2">
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                    </CardContent>
                    <CardFooter className="pt-2 pb-3 border-t border-border flex justify-between">
                        <Skeleton className="h-3 w-[100px]" />
                        <Skeleton className="h-3 w-[100px]" />
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
