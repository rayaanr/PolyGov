import { mainABI } from "@/constants/abi/main";
import { secondaryABI } from "@/constants/abi/secondary";
import { bscTestnet, arbitrumSepolia} from "wagmi/chains";
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
            governance: "0x2265d043c79caeca800be7ecc150c6c23d5e3374",
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
                governance: "0x216941d5ce326edec59ffdf6959a1b855ee94276",
            },
            abi: {
                governance: secondaryABI as Abi,
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
