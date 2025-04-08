import { mainABI } from "@/constants/abi/main";
import { arbABI } from "@/constants/abi/secondary";
import { bscTestnet, arbitrumSepolia, type Chain } from "wagmi/chains";
import { Abi } from "viem";

interface ChainConfig {
    name: string;
    chainId: number;
    explorerUrl: string;
    contracts: {
        token: `0x${string}`;
        governance: `0x${string}`;
    };
    abi: {
        governance: Abi;
    };
    icon: string;
}

const CONFIG: {
    MAIN: ChainConfig;
    SECONDARY_CHAINS: ChainConfig[];
} = {
    MAIN: {
        name: arbitrumSepolia.name,
        chainId: arbitrumSepolia.id,
        explorerUrl: arbitrumSepolia.blockExplorers?.default.url,
        contracts: {
            token: "0xc359f38eD76d8941d486dA85a4aA553Aa74b18BD",
            governance: "0x8Dfdc3D4837aa7cB73B664536Fb0557Af7C82c5d",
        },
        abi: {
            governance: mainABI as Abi,
        },
        icon: "/arb.png",
    },
    SECONDARY_CHAINS: [
        {
            name: bscTestnet.name,
            chainId: bscTestnet.id,
            explorerUrl: bscTestnet.blockExplorers?.default.url,
            contracts: {
                token: "0xc359f38eD76d8941d486dA85a4aA553Aa74b18BD",
                governance: "0x8Dfdc3D4837aa7cB73B664536Fb0557Af7C82c5d",
            },
            abi: {
                governance: arbABI as Abi,
            },
            icon: "/bsc.png",
        },
    ],
} as const;

export type Config = typeof CONFIG;
export type MainConfig = typeof CONFIG.MAIN;

// Export the main chain config
export const MAIN_CONFIG = CONFIG.MAIN;

export default CONFIG;
