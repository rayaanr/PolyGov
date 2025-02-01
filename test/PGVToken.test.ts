import { expect } from "chai";
import { ethers } from "hardhat";
import { PGVToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PGV Token", function () {
    let pgvToken: PGVToken;
    let owner: HardhatEthersSigner;
    let addr1: HardhatEthersSigner;
    let addr2: HardhatEthersSigner;
    const MAX_SUPPLY = ethers.parseEther("10000"); // 10,000 tokens with 18 decimals

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy the contract
        const PGVTokenFactory = await ethers.getContractFactory("PGVToken");
        pgvToken = await PGVTokenFactory.deploy();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await pgvToken.owner()).to.equal(owner.address);
        });

        it("Should assign the total supply of tokens to the owner", async function () {
            const ownerBalance = await pgvToken.balanceOf(owner.address);
            expect(await pgvToken.totalSupply()).to.equal(ownerBalance);
        });

        it("Should set the max supply correctly", async function () {
            const totalSupply = await pgvToken.totalSupply();
            expect(totalSupply).to.equal(MAX_SUPPLY);
        });
    });

    describe("Token Details", function () {
        it("Should have the correct name", async function () {
            expect(await pgvToken.name()).to.equal("PGV Governance Token");
        });

        it("Should have the correct symbol", async function () {
            expect(await pgvToken.symbol()).to.equal("PGV");
        });

        it("Should have 18 decimals", async function () {
            expect(await pgvToken.decimals()).to.equal(18);
        });
    });

    describe("Transactions", function () {
        it("Should transfer tokens between accounts", async function () {
            // Transfer 50 tokens from owner to addr1
            const transferAmount = ethers.parseEther("50");
            await pgvToken.transfer(addr1.address, transferAmount);

            expect(await pgvToken.balanceOf(addr1.address)).to.equal(transferAmount);
        });

        it("Should fail if sender doesn't have enough tokens", async function () {
            // Try to send more tokens than the total supply
            const initialOwnerBalance = await pgvToken.balanceOf(owner.address);

            await expect(
                pgvToken.connect(addr1).transfer(owner.address, 1n)
            ).to.be.revertedWithCustomError(pgvToken, "ERC20InsufficientBalance");

            // Owner balance shouldn't have changed
            expect(await pgvToken.balanceOf(owner.address)).to.equal(initialOwnerBalance);
        });

        it("Should update balances after transfers", async function () {
            const initialOwnerBalance = await pgvToken.balanceOf(owner.address);
            const transferAmount = ethers.parseEther("100");

            // Transfer first to addr1
            await pgvToken.transfer(addr1.address, transferAmount);

            // Transfer from addr1 to addr2
            await pgvToken.connect(addr1).transfer(addr2.address, ethers.parseEther("50"));

            // Check balances
            expect(await pgvToken.balanceOf(owner.address)).to.equal(
                initialOwnerBalance - transferAmount
            );
            expect(await pgvToken.balanceOf(addr1.address)).to.equal(ethers.parseEther("50"));
            expect(await pgvToken.balanceOf(addr2.address)).to.equal(ethers.parseEther("50"));
        });
    });
});
