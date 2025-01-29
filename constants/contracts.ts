export interface Contracts {
    [key: string]: {
        tokenContract: string;
        governanceContract: string;
    };
}

export const contracts: Contracts = {
    "arbitrumTestnet": {
        "tokenContract": "0x476a56918Ef44c260609C5590e0699e1bBcaf621",
        "governanceContract": "0x67519e6D910e28E857fd211FC50f6229e35DB887"
    },
    "bscTestnet": {
        "tokenContract": "0x67519e6D910e28E857fd211FC50f6229e35DB887",
        "governanceContract": "0xeA55EAA6573Cd67a5D455F4846179ee7879966Ae"
    }
};