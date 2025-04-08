import { useQuery } from "@tanstack/react-query";

interface IpfsData {
    title?: string;
    description?: string;
}

export function useIpfsData(ipfsHash: string | undefined) {
    return useQuery({
        queryKey: ["ipfsData", ipfsHash],
        enabled: !!ipfsHash,
        queryFn: async () => {
            const res = await fetch(
                `https://tomato-careful-spoonbill-510.mypinata.cloud/ipfs/${ipfsHash}`
            );
            if (!res.ok) throw new Error("Failed to fetch IPFS data");
            return res.json() as Promise<IpfsData>;
        },
        staleTime: 10 * 60 * 1000, // 10 minutes cache time
    });
}
