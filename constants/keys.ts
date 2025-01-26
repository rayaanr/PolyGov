export const KEYS = {
    BSC_TESTNET: "bscTestnet",
    ARB_TESTNET: "arbitrumTestnet",
} as const;

export type Network = keyof typeof KEYS;
