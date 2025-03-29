import { ethers } from "ethers";
import { CONFIG, MAIN_GOVERNANCE_ABI, SECONDARY_GOVERNANCE_ABI } from "../config";
import { createWebSocketProvider } from "./ws";
import WebSocket from "ws";
import { ContractConnections } from "../types";
import { setupMainChainEventListeners } from "..";


export async function reconnectMainChain(connections: {
    main: ContractConnections;
    secondary: Record<string, ContractConnections>;
}) {
    try {
        await connections.main.provider.destroy();
        const mainProvider = createWebSocketProvider(CONFIG.MAIN.WS_URL);
        const mainSigner = new ethers.Wallet(process.env.RELAYER_PVT_KEY!, mainProvider);
        const mainContract = new ethers.Contract(
            CONFIG.MAIN.CONTRACT,
            MAIN_GOVERNANCE_ABI,
            mainSigner
        );

        connections.main = {
            provider: mainProvider,
            contract: mainContract,
            signer: mainSigner,
            wsInstance: mainProvider.websocket as WebSocket,
        };

        setupMainChainEventListeners(mainContract, connections.secondary);
        console.log("✅ Successfully reconnected to main chain");
    } catch (error) {
        throw new Error(`Failed to reconnect to main chain: ${error}`);
    }
}

export async function reconnectSecondaryChain(
    connections: {
        main: ContractConnections;
        secondary: Record<string, ContractConnections>;
    },
    chainId: string
) {
    try {
        const chainConfig = CONFIG.SECONDARY_CHAINS.find((c) => c.CHAIN_ID === chainId);
        if (!chainConfig) throw new Error(`No config for chain ${chainId}`);
        await connections.secondary[chainId].provider.destroy();
        const provider = createWebSocketProvider(chainConfig.WS_URL);
        const signer = new ethers.Wallet(process.env.RELAYER_PVT_KEY!, provider);
        const contract = new ethers.Contract(
            chainConfig.CONTRACT,
            SECONDARY_GOVERNANCE_ABI,
            signer
        );

        connections.secondary[chainId] = {
            provider,
            contract,
            signer,
            wsInstance: provider.websocket as WebSocket,
        };

        setupMainChainEventListeners(connections.main.contract, {
            [chainId]: connections.secondary[chainId],
        });

        console.log(`✅ Successfully reconnected to ${chainId} chain`);
    } catch (error) {
        throw new Error(`Failed to reconnect to ${chainId} chain: ${error}`);
    }
}

