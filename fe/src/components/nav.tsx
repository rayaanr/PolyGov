import { Button } from "@/components/ui/button";
import { WalletIcon } from "lucide-react";

export function Nav() {
    return (
        <nav className="border-b">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    PolyGov
                </div>
                <Button variant="outline" className="gap-2">
                    <WalletIcon className="h-4 w-4" />
                    Connect Wallet
                </Button>
            </div>
        </nav>
    );
}
