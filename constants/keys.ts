export const NETWORKS = {
    BSC_TESTNET: "bscTestnet",
    ARBITRUM_TESTNET: "arbitrumTestnet",
} as const;

export type Network = keyof typeof NETWORKS;
