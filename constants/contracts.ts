export interface Contracts {
    [key: string]: {
        tokenContract: string;
        governanceContract: string;
    };
}

export const contracts: Contracts = {
    "arbitrumTestnet": {
        "tokenContract": "0x476a56918Ef44c260609C5590e0699e1bBcaf621",
        "governanceContract": "0xa8917822616F75FCdc1C7804e1472c2130a54f82"
    },
    "bscTestnet": {
        "tokenContract": "0x67519e6D910e28E857fd211FC50f6229e35DB887",
        "governanceContract": "0x3bC7a8c817A8c21F43c09E83D3D12dD1a0aB11E6"
    }
};