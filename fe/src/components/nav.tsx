import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ThemeToggle } from "./theme-toggle";
import Image from "next/image";

export function Nav() {
    return (
        <div className="fixed top-0 left-0 right-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
            <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Image src="/logo.png" alt="Logo" width={120} height={60} className="h-12 w-fit" />
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <ConnectButton chainStatus={"icon"} showBalance={false} />
                </div>
            </nav>
        </div>
    );
}
