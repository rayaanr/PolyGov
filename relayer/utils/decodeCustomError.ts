// utils/decodeError.ts
import { Interface } from "ethers";

export function decodeCustomError(errorData: string, abi: any): string | null {
    try {
        const iface = new Interface(abi);
        const decoded = iface.parseError(errorData);
        if (!decoded) return null;
        return `Custom Error: ${decoded.name}(${decoded.args.map((arg) => JSON.stringify(arg)).join(", ")})`;
    } catch (e) {
        return null; // Unknown error or not decodable
    }
}
