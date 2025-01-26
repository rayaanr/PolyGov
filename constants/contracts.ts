export interface Contracts {
    [key: string]: {
        tokenContract: string;
        governanceContract: string;
    };
}

export const contracts: Contracts = {
    "arbitrumTestnet": {
        "tokenContract": "0x518e7F67bA8a1A5405c7C43Bb7b2fD392D4e8206",
        "governanceContract": "0xddB76fe23cF11c7eFB65e336E970030865D35C0F"
    },
    "bscTestnet": {
        "tokenContract": "0xaF0Bc0a8fc45930FEc7a6918C37F46B6BA65F77A",
        "governanceContract": "0xD3d60CFD8D9Bcb5f05103975EdDB394C50df1e10"
    }
};