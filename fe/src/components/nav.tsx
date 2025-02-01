import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ThemeToggle } from "./theme-toggle";

export function Nav() {
    return (
        <div className="fixed top-0 left-0 right-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
            <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    PolyGov
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <ConnectButton chainStatus={"icon"} showBalance={false} />
                </div>
            </nav>
        </div>
    );
}
