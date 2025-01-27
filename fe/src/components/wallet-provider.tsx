"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { http, WagmiProvider } from "wagmi";
import { bscTestnet, arbitrumSepolia } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useTheme } from "next-themes";

const config = getDefaultConfig({
    appName: "PolyGov",
    projectId: "7429870ae71a8225e0328336ef1007e6",
    chains: [bscTestnet, arbitrumSepolia],
    transports: {
        [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
    },
    ssr: true,
});

const queryClient = new QueryClient();

export default function WalletProvider({ children }: { children: ReactNode }) {
    const { theme } = useTheme();
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    modalSize="compact"
                    showRecentTransactions={true}
                    theme={theme === "dark" ? darkTheme() : undefined}
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
