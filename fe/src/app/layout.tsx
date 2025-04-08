import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Nav } from "@/components/nav";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import WalletProvider from "@/components/wallet-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
    title: "PolyGov",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
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
                        <Toaster position="top-center" richColors />
                    </WalletProvider>
                </ThemeProvider>
                <SpeedInsights />
            </body>
        </html>
    );
}
