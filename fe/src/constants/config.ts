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
            token: "0x4F90cb1474bF846682B267e62cEA52505477B378",
            governance: "0x6843a77F821a80D71Ac994c5288A2a061ec77d53",
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
                token: "0x22f17c601b36bb193aca3585F14a6345A979219d",
                governance: "0x402BD069C8a175f083025b10C56791340296CC6A",
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
