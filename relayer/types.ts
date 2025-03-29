import { ethers } from "ethers";
import WebSocket from "ws";

export interface ContractConnections {
    provider: ethers.WebSocketProvider;
    contract: ethers.Contract;
    signer: ethers.Wallet;
    wsInstance?: WebSocket;
}

export interface FinalizedProposal {
    id: string;
    timestamp: number;
}

export interface ProposalCache {
    finalized: FinalizedProposal[];
    lastUpdate: number;
}