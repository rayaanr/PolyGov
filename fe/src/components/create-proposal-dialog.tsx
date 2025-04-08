"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusIcon } from "lucide-react";
import { useCreateProposal } from "@/hooks/useCreateProposal";
import { encodeUpdateValueCalldata } from "@/lib/utils";

const MIN_DURATION = 3; // Minimum duration in minutes
const MAX_DURATION = 1440; // Maximum duration in minutes

// Simplified schema that uses minutes directly instead of Date objects
const formSchema = z.object({
    title: z.string().min(5, "Title must be at least 5 characters"),
    description: z.string().min(20, "Description must be at least 20 characters"),
    durationMinutes: z
        .number()
        .int("Duration must be a whole number")
        .min(MIN_DURATION, `Minimum duration is ${MIN_DURATION} minutes`)
        .max(MAX_DURATION, `Maximum duration is ${MAX_DURATION} minutes`),
});

// Contract constants moved outside component
const EXEUTING_CONTRACT = "0x54DccD4b6dca0a13767A17899E706911Cdf8D106";
const DURATION_PRESETS = [
    { value: 5, label: "5 min" },
    { value: 60, label: "1 hr" },
    { value: 360, label: "6 hrs" },
    { value: 1440, label: "1 day" },
];

export function CreateProposalDialog() {
    const [open, setOpen] = useState(false);
    const { createProposal, isPending } = useCreateProposal();
    const [isUploading, setIsUploading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
            durationMinutes: 5, // Default to 5 minutes
        },
    });

    // Simplified upload function
    const uploadToPinata = async (jsonData: { title: string; description: string }) => {
        try {
            setIsUploading(true);
            const response = await fetch("/api/files", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(jsonData),
            });

            if (!response.ok) {
                throw new Error(`Upload failed with status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Error uploading to Pinata:", error);
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            // Prepare the proposal data
            const proposalData = {
                title: values.title,
                description: values.description,
            };

            // Upload to IPFS via Pinata
            const ipfsResponse = await uploadToPinata(proposalData);
            if (!ipfsResponse) {
                throw new Error("Failed to pin content to IPFS");
            }

            const ipfsHash = ipfsResponse.IpfsHash || ipfsResponse.split("/ipfs/").pop();

            if (!ipfsHash) {
                throw new Error("Invalid IPFS hash");
            }

            const calldata = encodeUpdateValueCalldata(values.title);

            // Create the proposal
            await createProposal(
                values.title,
                ipfsHash,
                values.durationMinutes.toString(),
                EXEUTING_CONTRACT,
                calldata
            );

            // Reset and close
            setOpen(false);
            form.reset();
        } catch (error) {
            console.error("Error creating proposal:", error);
        }
    };

    const isSubmitting = isPending || isUploading;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <PlusIcon className="h-4 w-4" />
                    Create Proposal
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>Create New Proposal</DialogTitle>
                    <DialogDescription>
                        Create a new governance proposal. All proposals will be available for voting
                        across multiple chains.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter proposal title" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        A clear, concise title for your proposal
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Enter proposal description"
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Detailed description of what your proposal aims to achieve.
                                        This will be stored as JSON on IPFS.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="durationMinutes"
                            render={({ field }) => (
                                <FormItem className="space-y-4">
                                    <FormLabel>Voting Duration (Minutes)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={MIN_DURATION}
                                            max={MAX_DURATION}
                                            {...field}
                                            onChange={(e) => {
                                                // Ensure value is within bounds
                                                const value = Math.max(
                                                    MIN_DURATION,
                                                    Math.min(MAX_DURATION, parseInt(e.target.value) || 5)
                                                );
                                                field.onChange(value);
                                            }}
                                        />
                                    </FormControl>
                                    <div className="flex gap-2 flex-wrap">
                                        {DURATION_PRESETS.map((preset) => (
                                            <Button
                                                key={preset.value}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => field.onChange(preset.value)}
                                                className={
                                                    field.value === preset.value
                                                        ? "bg-primary/20"
                                                        : ""
                                                }
                                            >
                                                {preset.label}
                                            </Button>
                                        ))}
                                    </div>
                                    <FormDescription>
                                        Select the number of minutes the proposal will be open for
                                        voting (5 minutes to 1 day)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isPending
                                ? "Creating Proposal..."
                                : isUploading
                                ? "Uploading to IPFS..."
                                : "Create Proposal"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
