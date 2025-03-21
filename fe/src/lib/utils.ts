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

export function getStatusText(status: number): string {
    switch (status) {
        case 0:
            return "Active";
        case 1:
            return "Accepted";
        case 2:
            return "Rejected";
        default:
            return `Unknown Status (${status})`;
    }
}