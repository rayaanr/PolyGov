import fs from "fs";
import path from "path";

export interface FinalizedProposal {
    id: string;
    timestamp: number;
}

export interface ProposalCache {
    finalized: FinalizedProposal[];
    lastUpdate: number;
}

const CACHE_FILE_PATH = path.join(__dirname, "proposal_cache.json");

/**
 * Loads the proposal cache from file
 */
export function loadProposalCache(): ProposalCache {
    try {
        if (fs.existsSync(CACHE_FILE_PATH)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE_PATH, "utf8"));
        }
    } catch (error) {
        console.error("Error loading proposal cache:", error);
    }
    return { finalized: [], lastUpdate: 0 };
}

/**
 * Saves the proposal cache to file
 */
export function saveProposalCache(cache: ProposalCache) {
    try {
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
    } catch (error) {
        console.error("Error saving proposal cache:", error);
    }
}

/**
 * Marks a proposal as finalized in the cache
 */
export function markProposalAsFinalized(proposalId: string, cache: ProposalCache) {
    cache.finalized.push({
        id: proposalId,
        timestamp: Math.floor(Date.now() / 1000),
    });
    cache.lastUpdate = Math.floor(Date.now() / 1000);
    saveProposalCache(cache);
}

/**
 * Initializes the cache if it doesn't exist
 */
export function initializeCache() {
    if (!fs.existsSync(CACHE_FILE_PATH)) {
        saveProposalCache({ finalized: [], lastUpdate: Math.floor(Date.now() / 1000) });
    }
}