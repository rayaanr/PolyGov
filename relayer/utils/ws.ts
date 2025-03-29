import WebSocket from "ws";
import { ethers } from "ethers";

export interface WebSocketConnection {
    provider: ethers.WebSocketProvider;
    wsInstance: WebSocket;
}

/**
 * Creates a WebSocket provider with error handling and reconnection setup
 */
export function createWebSocketProvider(wsUrl: string): ethers.WebSocketProvider {
    const ws = new WebSocket(wsUrl, {
        perMessageDeflate: false,
        timeout: 30000,
    });

    const provider = new ethers.WebSocketProvider(ws as any, undefined, {
        pollingInterval: 1000,
    });

    ws.on("error", (error) => {
        console.error(`WebSocket error for ${wsUrl}:`, error);
    });

    ws.on("close", () => {
        console.log(`WebSocket closed for ${wsUrl}, will attempt to reconnect...`);
    });

    return provider;
}

/**
 * Setup health check monitoring for WebSocket connections
 */
export function setupWebSocketHealthCheck(
    connections: {
        main: { wsInstance?: WebSocket; provider: ethers.WebSocketProvider };
        secondary: Record<string, { wsInstance?: WebSocket; provider: ethers.WebSocketProvider }>;
    },
    reconnectCallbacks: {
        reconnectMain: () => Promise<void>;
        reconnectSecondary: (chainId: string) => Promise<void>;
    },
    options = {
        checkInterval: 60000,
        maxReconnectAttempts: 5,
        reconnectDelay: 5000,
    }
) {
    const reconnectAttempts: Record<string, number> = {};

    async function attemptReconnect(chainId: string, isMain: boolean) {
        const maxAttempts = options.maxReconnectAttempts;
        const currentAttempts = reconnectAttempts[chainId] || 0;

        if (currentAttempts >= maxAttempts) {
            console.error(`❌ Max reconnection attempts reached for ${chainId}`);
            return;
        }

        reconnectAttempts[chainId] = currentAttempts + 1;

        try {
            if (isMain) {
                await reconnectCallbacks.reconnectMain();
            } else {
                await reconnectCallbacks.reconnectSecondary(chainId);
            }
            reconnectAttempts[chainId] = 0;
        } catch (error) {
            console.error(`❌ Reconnection attempt ${currentAttempts + 1} failed for ${chainId}`);
            setTimeout(() => attemptReconnect(chainId, isMain), options.reconnectDelay);
        }
    }

    setInterval(() => {
        const mainWs = connections.main.wsInstance;
        if (
            !mainWs ||
            mainWs.readyState === WebSocket.CLOSED ||
            mainWs.readyState === WebSocket.CLOSING
        ) {
            console.log("🔄 Main chain WebSocket disconnected, attempting reconnection...");
            attemptReconnect("main", true);
        }
        for (const [chainId, connection] of Object.entries(connections.secondary)) {
            const ws = connection.wsInstance;
            if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
                console.log(
                    `🔄 ${chainId} chain WebSocket disconnected, attempting reconnection...`
                );
                attemptReconnect(chainId, false);
            }
        }
    }, options.checkInterval);

    process.on("uncaught exception", (error) => {
        console.error("Uncaught exception:", error);
        attemptReconnect("main", true);
        for (const chainId of Object.keys(connections.secondary)) {
            attemptReconnect(chainId, false);
        }
    });
}
