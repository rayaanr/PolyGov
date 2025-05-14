import { Wallet, Contract } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import WebSocket from "ws";

import { createWebSocketProvider, setupWebSocketHealthCheck } from "./utils/ws";
import { saveProposalCache } from "./utils/cache";
import { CACHE_FILE_PATH, CONFIG, MAIN_GOVERNANCE_ABI, SECONDARY_GOVERNANCE_ABI } from "./config";
import { reconnectMainChain, reconnectSecondaryChain } from "./utils/reconnect";

import { ContractConnections } from "./types";
import { MainGovernance } from "./contracts/mainGov";
import { SecondaryGovernance } from "./contracts/secondaryGov";

import { setupMainChainListeners } from "./listeners/mainChainListeners";
import { setupSecondaryChainListeners } from "./listeners/secondaryChainListeners";

import { syncProposalsBetweenChains } from "./tasks/syncProposals";
import { processEndedProposals } from "./tasks/processEndedProposals";

dotenv.config();

// --- 1. Initialize Contracts (Main + Secondary) ---
async function initializeConnections(): Promise<{
    main: MainGovernance;
    secondary: Record<string, SecondaryGovernance>;
    rawConnections: {
        main: ContractConnections;
        secondary: Record<string, ContractConnections>;
    };
}> {
    if (!process.env.RELAYER_PVT_KEY) {
        throw new Error("RELAYER_PVT_KEY is missing in environment variables.");
    }

    const mainProvider = createWebSocketProvider(CONFIG.MAIN.WS_URL);
    const mainSigner = new Wallet(process.env.RELAYER_PVT_KEY, mainProvider);
    const mainContract = new Contract(CONFIG.MAIN.CONTRACT, MAIN_GOVERNANCE_ABI, mainSigner);
    const mainGov = new MainGovernance(mainContract);

    const secondaryConnections: Record<string, ContractConnections> = {};
    const secondaryGovernances: Record<string, SecondaryGovernance> = {};

    for (const chain of CONFIG.SECONDARY_CHAINS) {
        try {
            const provider = createWebSocketProvider(chain.WS_URL);
            const signer = new Wallet(process.env.RELAYER_PVT_KEY, provider);
            const contract = new Contract(chain.CONTRACT, SECONDARY_GOVERNANCE_ABI, signer);

            secondaryConnections[chain.CHAIN_ID] = {
                provider,
                signer,
                contract,
                wsInstance: provider.websocket as WebSocket,
            };
            secondaryGovernances[chain.CHAIN_ID] = new SecondaryGovernance(contract);

            console.log(`🔌 Connected to ${chain.CHAIN_ID}`);
        } catch (error) {
            console.error(`❌ Failed to connect to ${chain.CHAIN_ID}:`, error);
        }
    }

    return {
        main: mainGov,
        secondary: secondaryGovernances,
        rawConnections: {
            main: {
                provider: mainProvider,
                signer: mainSigner,
                contract: mainContract,
                wsInstance: mainProvider.websocket as WebSocket,
            },
            secondary: secondaryConnections,
        },
    };
}

// --- 2. Schedule Periodic Tasks ---
function scheduleRecurringTasks(
    mainGov: MainGovernance,
    secondaryConnections: Record<string, ContractConnections>
) {
    setInterval(async () => {
        await processEndedProposals(mainGov, secondaryConnections);
    }, 0.5 * 60 * 1000); // Every 30 seconds

    setInterval(async () => {
        await syncProposalsBetweenChains(mainGov, secondaryConnections);
    }, 60 * 60 * 1000); // Every 1 hour
}

// --- 3. Main Entrypoint ---
async function main() {
    console.log("🔗 Starting Multi-Chain Governance Relayer...");

    try {
        if (!fs.existsSync(CACHE_FILE_PATH)) {
            saveProposalCache({ finalized: [], lastUpdate: Math.floor(Date.now() / 1000) });
        }

        const { main, rawConnections } = await initializeConnections();

        setupWebSocketHealthCheck(rawConnections, {
            reconnectMain: async () => reconnectMainChain(rawConnections),
            reconnectSecondary: async (chainId: string) => reconnectSecondaryChain(rawConnections, chainId),
        });

        setupMainChainListeners(main, rawConnections.secondary);
        setupSecondaryChainListeners(main, rawConnections.secondary);

        await syncProposalsBetweenChains(main, rawConnections.secondary);
        await processEndedProposals(main, rawConnections.secondary);

        scheduleRecurringTasks(main, rawConnections.secondary);

        console.log("✅ Relayer initialized and running successfully.");
    } catch (error) {
        console.error("❌ Error initializing relayer:", error);
        process.exit(1);
    }
}

// --- 4. Graceful Shutdown ---
process.on("SIGINT", async () => {
    console.log("👋 Gracefully shutting down...");
    process.exit(0);
});

main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
});
