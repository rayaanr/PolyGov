import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import WalletProvider from "@/components/wallet-provider";

export const metadata: Metadata = {
    title: "PolyGov",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={GeistSans.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <WalletProvider>
                        <Nav />
                        <main className="pt-16">{children}</main>
                    </WalletProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
