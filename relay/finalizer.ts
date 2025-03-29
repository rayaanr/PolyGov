import { ethers, JsonRpcProvider } from "ethers";
import { CONFIG, MAIN_GOVERNANCE_ABI, SECONDARY_GOVERNANCE_ABI, wallet } from "./config";
import { getProposalState, updateProposalState, loadState, rebuildStateFromChain } from "./state";

const DELAY_MS = 30_000;

export const startFinalizer = async () => {
    const mainProvider = new JsonRpcProvider(CONFIG.MAIN.RPC_URL);
    const signer = wallet.connect(mainProvider);
    const mainContract = new ethers.Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, signer);

    // Load or rebuild state
    try {
        loadState();
    } catch {
        await rebuildStateFromChain(mainContract);
    }

    console.log("⏳ Main finalizer started...");

    setInterval(async () => {
        try {
            const proposalIds: string[] = await mainContract.getProposalIds();
            const now = Math.floor(Date.now() / 1000);

            for (const id of proposalIds) {
                const proposal = await mainContract.getProposalDetails(id);
                const local = getProposalState(id);

                // Sync local state with on-chain status
                if (proposal.voteTallyFinalized && !local.finalized) {
                    updateProposalState(id, { finalized: true });
                }
                if (proposal.executed && !local.executed) {
                    updateProposalState(id, { executed: true });
                }

                if (local.finalized && local.executed && local.statusSynced) {
                    continue; // already fully handled
                }

                if (!proposal.voteTallyFinalized && now >= Number(proposal.endTime)) {
                    let allCollected = true;
                    for (const chain of CONFIG.SECONDARY_CHAINS) {
                        const summary = await mainContract.secondaryChainVotes(id, chain.CHAIN_ID);
                        if (!summary.collected) {
                            allCollected = false;
                            console.log(`⏳ Waiting for ${chain.CHAIN_ID} votes for ${id}`);
                            break;
                        }
                    }

                    if (!allCollected) continue;

                    try {
                        console.log(`🟠 Finalizing proposal on MAIN: ${id}`);
                        const tx = await mainContract.finalizeProposalVotes(id);
                        await tx.wait();
                        console.log(`✅ Finalized: ${id}`);
                        updateProposalState(id, { finalized: true });
                    } catch (err) {
                        console.warn(`❌ Finalize failed [${id}]:`, err);
                        continue;
                    }
                }

                // Re-fetch for execution
                const updated = await mainContract.getProposalDetails(id);

                if (updated.finalYesVotes > updated.finalNoVotes && !updated.executed) {
                    try {
                        console.log(`🚀 Executing proposal: ${id}`);
                        const execTx = await mainContract.executeProposal(id);
                        await execTx.wait();
                        console.log(`✅ Executed: ${id}`);
                        updateProposalState(id, { executed: true });
                    } catch (err) {
                        console.warn(`❌ Execution failed [${id}]:`, err);
                    }
                }

                // Sync status to secondary chains
                if (!getProposalState(id).statusSynced) {
                    const status = updated.finalYesVotes > updated.finalNoVotes ? 1 : 2;

                    for (const chain of CONFIG.SECONDARY_CHAINS) {
                        try {
                            const provider = new JsonRpcProvider(chain.RPC_URL);
                            const secSigner = wallet.connect(provider);
                            const secondary = new ethers.Contract(
                                chain.CONTRACT,
                                SECONDARY_GOVERNANCE_ABI,
                                secSigner
                            );

                            const current = await secondary.getProposalDetails(id);
                            if (current.status !== status) {
                                console.log(
                                    `🔄 Syncing status to ${chain.CHAIN_ID}: ${
                                        status === 1 ? "Accepted" : "Rejected"
                                    }`
                                );
                                const tx = await secondary.updateProposalStatus(id, status);
                                await tx.wait();
                                console.log(`✅ Synced status to ${chain.CHAIN_ID}`);
                            }
                        } catch (err) {
                            console.warn(`⚠️ Failed to update status on ${chain.CHAIN_ID}:`, err);
                        }
                    }

                    updateProposalState(id, { statusSynced: true });
                }
            }
        } catch (err) {
            console.error("❌ Finalizer loop error:", err);
        }
    }, DELAY_MS);
};
