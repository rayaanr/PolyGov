import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const STATE_FILE = path.resolve(__dirname, "../relayer_state.json");

export interface ProposalState {
    finalized: boolean;
    executed: boolean;
    statusSynced: boolean;
}

let state: Record<string, ProposalState> = {};

/**
 * Load local JSON state file if it exists
 */
export function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, "utf-8");
            state = JSON.parse(data);
        }
    } catch (err) {
        console.error("⚠️ Failed to load state file:", err);
    }
}

/**
 * Save state to local JSON
 */
export function saveState() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
        console.error("❌ Failed to save state file:", err);
    }
}

/**
 * Rebuild state from on-chain data if state file is missing
 */
export async function rebuildStateFromChain(mainContract: ethers.Contract) {
    console.log("🔁 Rebuilding relayer_state.json from chain...");
    const proposalIds: string[] = await mainContract.getProposalIds();
    for (const id of proposalIds) {
        const proposal = await mainContract.getProposalDetails(id);
        updateProposalState(id, {
            finalized: proposal.voteTallyFinalized,
            executed: proposal.executed,
            statusSynced: false,
        });
    }
    saveState();
    console.log("✅ Rebuilt state from chain.");
}

export function getProposalState(proposalId: string): ProposalState {
    return (
        state[proposalId] || {
            finalized: false,
            executed: false,
            statusSynced: false,
        }
    );
}

export function updateProposalState(proposalId: string, updates: Partial<ProposalState>) {
    state[proposalId] = {
        ...getProposalState(proposalId),
        ...updates,
    };
    saveState();
}
