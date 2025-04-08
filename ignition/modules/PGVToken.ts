import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

const PGVTokenModule = buildModule("PGVTokenModule", (m) => {
    const initialSupply = m.getParameter("initialSupply", ethers.parseEther("10000")); // 1M PGV Tokens

    const pgvToken = m.contract("PGVToken", ["PolyGov Token", "PGV", initialSupply]);

    return { pgvToken };
});

export default PGVTokenModule;
