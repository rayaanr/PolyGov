export interface Contracts {
    [key: string]: {
        tokenContract: `0x${string}`;
        governanceContract: `0x${string}`;
    };
}

export const CONTRACTS: Contracts = {
    arbitrumTestnet: {
        tokenContract: "0x16EF30625FA996166B306b87513815A2E25AE0B6",
        governanceContract: "0x417EE8c83Ba560255324A3A44e7F649102c30B0E",
    },
    bscTestnet: {
        tokenContract: "0x03132bE762736c777F53Db0E863B41Ef9c285e70",
        governanceContract: "0x476a56918Ef44c260609C5590e0699e1bBcaf621",
    },
};
