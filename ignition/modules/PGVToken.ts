import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PGVTokenModule = buildModule("PGVTokenModule", (m) => {
    // Deploy PGVToken contract
    const pgvToken = m.contract("PGVToken");

    return { pgvToken };
});

export default PGVTokenModule;