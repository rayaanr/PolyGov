export interface Contracts {
    [key: string]: {
        tokenContract: string;
        governanceContract: string;
    };
}

export const contracts: Contracts = {
    "arbitrumTestnet": {
        "tokenContract": "0x476a56918Ef44c260609C5590e0699e1bBcaf621",
        "governanceContract": "0xb4f328DD04a5999A8d3b5e50f694EBdCb8a31145"
    },
    "bscTestnet": {
        "tokenContract": "0x67519e6D910e28E857fd211FC50f6229e35DB887",
        "governanceContract": "0xaA3F68398c001f70f5b2df8D1B352C86C097A688"
    }
};