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

const formSchema = z.object({
    title: z.string().min(5, "Title must be at least 5 characters"),
    description: z.string().min(20, "Description must be at least 20 characters"),
    endDate: z
        .date()
        .min(new Date(), "End date must be in the future")
        .refine((date) => {
            const minutes = (date.getTime() - Date.now()) / (1000 * 60);
            return minutes >= 5 && minutes <= 1440; // 5 minutes to 1 day
        }, "Voting duration must be between 5 minutes and 1 day (1440 minutes)"),
});

export function CreateProposalDialog() {
    const [open, setOpen] = useState(false);
    const { createProposal, isPending } = useCreateProposal();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
            endDate: new Date(Date.now() + 10 * 60 * 1000), // Default to 10 minutes from now
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            // Calculate duration in minutes
            const durationMinutes = Math.ceil(
                (values.endDate.getTime() - Date.now()) / (1000 * 60)
            );

            // Call the createProposal function
            await createProposal(values.title, values.description, durationMinutes.toString());

            // Close the dialog and reset the form
            setOpen(false);
            form.reset();
        } catch (err) {
            console.error("Error creating proposal:", err);
        }
    }

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
                                        Detailed description of what your proposal aims to achieve
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="endDate"
                            render={({ field }) => (
                                <FormItem className="space-y-4">
                                    <FormLabel>Voting Duration (Minutes)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={5} // Minimum 5 minutes
                                            max={1440} // Maximum 1 day (1440 minutes)
                                            {...field}
                                            onChange={(e) => {
                                                const minutes = Math.min(
                                                    1440,
                                                    Math.max(
                                                        5,
                                                        Number.parseInt(e.target.value) || 5
                                                    )
                                                );
                                                field.onChange(
                                                    new Date(Date.now() + minutes * 60 * 1000)
                                                );
                                            }}
                                            value={Math.ceil(
                                                (field.value.getTime() - Date.now()) / (60 * 1000)
                                            )}
                                        />
                                    </FormControl>
                                    <div className="flex gap-2">
                                        {[5, 60, 360, 1440].map((minutes) => (
                                            <Button
                                                key={minutes}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    field.onChange(
                                                        new Date(Date.now() + minutes * 60 * 1000)
                                                    )
                                                }
                                            >
                                                {minutes === 5
                                                    ? "5 min"
                                                    : minutes === 60
                                                    ? "1 hr"
                                                    : minutes === 360
                                                    ? "6 hrs"
                                                    : "1 day"}
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
                        <Button type="submit" className="w-full" disabled={isPending}>
                            {isPending ? "Creating Proposal..." : "Create Proposal"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
