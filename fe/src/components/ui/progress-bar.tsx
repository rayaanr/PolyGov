"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface GovernanceProgressBarProps {
    yesVotes: number;
    noVotes: number;
    maxVotingPower: number;
    className?: string;
    formatNumber?: (num: number) => string;
    title?: string;
}

export default function ProgressBar({
    yesVotes,
    noVotes,
    maxVotingPower,
    className,
    formatNumber = (num) => num.toLocaleString(),
    title,
}: GovernanceProgressBarProps) {
    const [mounted, setMounted] = useState(false);

    // Animation on mount
    useEffect(() => {
        setMounted(true);
    }, []);

    // Calculate percentages from absolute values
    const yesPercentage = (yesVotes / maxVotingPower) * 100;
    const noPercentage = (noVotes / maxVotingPower) * 100;

    // Calculate total votes and participation percentage
    const totalVotes = yesVotes + noVotes;
    const participationPercentage = (totalVotes / maxVotingPower) * 100;

    return (
        <div className={cn("space-y-2", className)}>
            {/* Title */}
            {title && (
                <h3 className="text-sm font-medium text-gray-700">
                    {title}
                </h3>
            )}

            {/* Progress bar */}
            {/* Display vote counts */}
            <div className="flex justify-between text-xs font-medium">
                <div className="text-emerald-700">Yes: {formatNumber(yesVotes)}</div>
                <div className="text-rose-700">No: {formatNumber(noVotes)}</div>
            </div>

            <div className="relative h-4 w-full overflow-hidden rounded-md bg-gray-100">
                {/* Yes votes */}
                <div
                    className={cn(
                        "absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-1000 ease-out flex items-center justify-center",
                        !mounted && "w-0"
                    )}
                    style={{ width: `${yesPercentage}%` }}
                >
                    {yesPercentage >= 5 && (
                        <span className="px-2 text-[10px] font-medium text-white">
                            {yesPercentage.toFixed(1)}%
                        </span>
                    )}
                </div>

                {/* No votes */}
                <div
                    className={cn(
                        "absolute right-0 top-0 h-full bg-rose-500 transition-all duration-1000 ease-out flex items-center justify-center",
                        !mounted && "w-0"
                    )}
                    style={{ width: `${noPercentage}%` }}
                >
                    {noPercentage >= 5 && (
                        <span className="px-2 text-[10px] font-medium text-white">
                            {noPercentage.toFixed(1)}%
                        </span>
                    )}
                </div>
            </div>

            {/* Total votes and participation info */}
            <div className="flex justify-start text-xs text-gray-500">
                Total: {formatNumber(totalVotes)} / {formatNumber(maxVotingPower)} (
                {participationPercentage.toFixed(1)}%)
            </div>
        </div>
    );
}
