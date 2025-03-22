import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
    return (
        <div className="container max-w-md mx-auto flex flex-col items-center justify-center min-h-[90vh] text-center px-4">
            <div className="rounded-full bg-secondary p-6 mb-6">
                <AlertTriangle className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-medium mb-2">Not Found</h1>
            <p className="text-muted-foreground mb-6">
                The proposal you're looking for doesn't exist or has been removed.
            </p>
            <Button asChild>
                <Link href="/">Return to Dashboard</Link>
            </Button>
        </div>
    );
}
