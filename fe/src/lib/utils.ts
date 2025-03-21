import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatVotes(votes: bigint): string {
    return ((votes * BigInt(1000000)) / BigInt(10 ** 18) / BigInt(1000000)).toString();
}

export function formatDate(date: number): string {
    return new Date(date * 1000).toLocaleString();
}

const STATUS_MAP: Record<number, string> = {
    0: "Active",
    1: "Accepted",
    2: "Rejected",
} as const;

type StatusValue = keyof typeof STATUS_MAP;

export function getStatusText(status: number): string {
    return STATUS_MAP[status as StatusValue] ?? `Unknown Status (${status})`;
}

// Utility function (should be moved to utils file)
const BADGE_VARIANTS = {
    Active: "default",
    Rejected: "destructive",
    Accepted: "outline",
} as const;

// Type for badge variants
type BadgeVariant = (typeof BADGE_VARIANTS)[keyof typeof BADGE_VARIANTS] | "secondary";

export const getBadgeVariant = (status: number): BadgeVariant => {
    const statusText = getStatusText(status);
    return BADGE_VARIANTS[statusText as keyof typeof BADGE_VARIANTS] ?? "secondary";
};
