"use client";

import { useState } from "react";
import { useCreateProposal } from "@/hooks/useCreateProposal";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

export default function CreateProposalForm() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [durationDays, setDurationDays] = useState("");

    const { createProposal, isPending } = useCreateProposal();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await createProposal(title, description, durationDays);
            setTitle("");
            setDescription("");
            setDurationDays("");
        } catch (err) {
            console.error("Failed to create proposal:", err);
        }
    };

    return (
        <div>
            <h1>Create Proposal</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <Input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        placeholder="Enter proposal title"
                    />
                </div>
                <div>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        placeholder="Enter proposal description"
                    />
                </div>
                <div>
                    <Input
                        type="number"
                        value={durationDays}
                        onChange={(e) => setDurationDays(e.target.value)}
                        required
                        placeholder="Enter proposal duration in days"
                    />
                </div>
                <Button type="submit" disabled={isPending}>
                    {isPending ? "Creating Proposal..." : "Create Proposal"}
                </Button>
            </form>
        </div>
    );
}