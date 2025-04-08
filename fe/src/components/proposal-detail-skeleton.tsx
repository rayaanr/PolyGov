import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ProposalDetailSkeleton() {
    return (
        <div className="container max-w-3xl mx-auto p-4 space-y-6">
            <div className="flex items-start justify-between">
                <div className="space-y-2 w-full max-w-xl">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />

                    <div className="flex flex-wrap gap-4 mt-4 pt-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-5 w-32" />
                    </div>
                </div>
                <Skeleton className="h-6 w-16" />
            </div>

            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-8" />
                            <Skeleton className="h-4 w-12" />
                        </div>
                        <Skeleton className="h-1 w-full" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-14" />
                            <Skeleton className="h-4 w-12" />
                        </div>
                        <Skeleton className="h-1 w-full" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-10 w-[200px]" />
                    </div>

                    <div className="space-y-2">
                        <Skeleton className="h-5 w-24" />
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                        <Skeleton className="h-10 w-full" />
                    </div>

                    <div className="space-y-4">
                        <Skeleton className="h-5 w-32" />

                        {[1, 2].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-2 w-2 rounded-full" />
                                        <Skeleton className="h-4 w-20" />
                                    </div>
                                    <Skeleton className="h-4 w-16" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Skeleton className="h-3 w-8" />
                                        <Skeleton className="h-2 w-full" />
                                    </div>
                                    <div className="space-y-1">
                                        <Skeleton className="h-3 w-14" />
                                        <Skeleton className="h-2 w-full" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
