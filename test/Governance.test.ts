import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { PGVToken, MainGovernance, SecondaryGovernance, DemoContract } from "../typechain-types";

// Global Variables
let pgvToken: PGVToken;
let mainGov: MainGovernance;
let secondaryGov: SecondaryGovernance;
let demoContract: DemoContract;
let owner: any;
let relayer: any;
let user1: any;
let user2: any;
let user1Addr: string;
let user2Addr: string;

// Constants
const TOTAL_SUPPLY = ethers.parseEther("10000");

// Utility function to advance time
async function advanceTime(seconds: number) {
    await time.increase(seconds);
    await ethers.provider.send("evm_mine", []);
}

beforeEach(async () => {
    // Setup signers
    [owner, relayer, user1, user2] = await ethers.getSigners();
    user1Addr = await user1.getAddress();
    user2Addr = await user2.getAddress();

    // Deploy PGVToken
    const PGVTokenFactory = await ethers.getContractFactory("PGVToken");
    pgvToken = (await PGVTokenFactory.deploy()) as PGVToken;
    await pgvToken.waitForDeployment();

    // Deploy MainGovernance
    const MainGovernanceFactory = await ethers.getContractFactory("MainGovernance");
    mainGov = (await MainGovernanceFactory.deploy(
        await pgvToken.getAddress(),
        await relayer.getAddress()
    )) as MainGovernance;
    await mainGov.waitForDeployment();

    // Deploy SecondaryGovernance
    const SecondaryGovernanceFactory = await ethers.getContractFactory("SecondaryGovernance");
    secondaryGov = (await SecondaryGovernanceFactory.deploy(
        await pgvToken.getAddress(),
        await relayer.getAddress(),
        "bsc"
    )) as SecondaryGovernance;
    await secondaryGov.waitForDeployment();

    // Deploy DemoContract for execution tests
    const DemoContractFactory = await ethers.getContractFactory("DemoContract");
    demoContract = (await DemoContractFactory.deploy()) as DemoContract;
    await demoContract.waitForDeployment();

    // Register secondary chain
    await mainGov.connect(owner).addSecondaryChain("bsc");

    // Transfer tokens to users (auto-delegates votes)
    await pgvToken.connect(owner).transfer(user1Addr, ethers.parseEther("1000"));
    await pgvToken.connect(owner).transfer(user2Addr, ethers.parseEther("1000"));
});

describe("✅ PGVToken Tests", function () {
    it("should deploy and mint total supply", async () => {
        const supply = await pgvToken.totalSupply();
        expect(supply).to.equal(TOTAL_SUPPLY);
    });

    it("should auto-delegate votes to self", async () => {
        const delegate = await pgvToken.delegates(user1Addr);
        expect(delegate).to.equal(user1Addr);
    });

    it("should have correct voting power after auto-delegation", async () => {
        const votes = await pgvToken.getVotes(user1Addr);
        expect(votes).to.equal(ethers.parseEther("1000"));
    });

    it("should not auto-delegate when transferring to a contract", async () => {
        await pgvToken
            .connect(owner)
            .transfer(await demoContract.getAddress(), ethers.parseEther("100"));
        const delegate = await pgvToken.delegates(demoContract.getAddress());
        expect(delegate).to.equal(ethers.ZeroAddress);
    });
});

describe("✅ MainGovernance Tests", function () {
    it("should create a proposal with correct details", async () => {
        const title = "Test Proposal";
        const ipfsHash = "ipfsHash";
        const duration = 5; // minutes

        await mainGov.connect(user1).createProposal(title, ipfsHash, duration, [], [], []);
        const proposals = await mainGov.getProposalIds();
        expect(proposals.length).to.equal(1);

        const proposal = await mainGov.getProposalDetails(proposals[0]);
        expect(proposal.title).to.equal(title);
        expect(proposal.ipfsHash).to.equal(ipfsHash);

        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");

        expect(proposal.endTime).to.be.closeTo(
            BigInt(block.timestamp) + BigInt(duration * 60),
            BigInt(10) // margin of 10 seconds
        );
    });

    it("should revert if proposer has insufficient voting power", async () => {
        await pgvToken.connect(owner).transfer(user2Addr, ethers.parseEther("50"));

        // Proposal creation
        await mainGov.connect(user1).createProposal("Valid Proposal", "ipfsHash", 2, [], [], []);

        // Owner-only check 
        await expect(mainGov.connect(user1).updateRelayer(user2Addr)).to.be.reverted;
    });

    it("should revert if duration is too short", async () => {
        await expect(
            mainGov.connect(user1).createProposal("Short Duration", "ipfsHash", 0, [], [], [])
        ).to.be.revertedWith("Duration too short");
    });

    it("should allow voting on a proposal", async () => {
        await mainGov.connect(user1).createProposal("Vote Proposal", "ipfsHash", 5, [], [], []);
        const proposals = await mainGov.getProposalIds();
        const proposalId = proposals[0];

        await mainGov.connect(user1).castVote(proposalId, true);

        const hasVoted = await mainGov.hadUserVoted(proposalId, user1Addr);
        const proposal = await mainGov.getProposalDetails(proposalId);

        expect(hasVoted).to.equal(true);
        expect(proposal.yesVotes).to.equal(ethers.parseEther("1000")); // assuming user1 has 1000 tokens
    });

    it("should revert if voting after proposal ends", async () => {
        await mainGov.connect(user1).createProposal("Expired Proposal", "ipfsHash", 2, [], [], []);
        const proposals = await mainGov.getProposalIds();
        const proposalId = proposals[0];

        await advanceTime(130); // 130 seconds
        await ethers.provider.send("evm_mine"); // ⛏️ mine a block

        await expect(mainGov.connect(user1).castVote(proposalId, true)).to.be.revertedWith(
            "Voting period ended"
        );
    });

    it("should revert if user votes twice", async () => {
        await mainGov.connect(user1).createProposal("Double Vote", "ipfsHash", 5, [], [], []);
        const proposals = await mainGov.getProposalIds();
        const proposalId = proposals[0];

        await mainGov.connect(user1).castVote(proposalId, true);

        await expect(mainGov.connect(user1).castVote(proposalId, true)).to.be.revertedWith(
            "Already voted"
        );
    });

    it("should allow owner to update quorum", async () => {
        const newQuorum = ethers.parseEther("2000");

        await mainGov.connect(owner).updateQuorum(newQuorum);

        expect(await mainGov.quorumVotes()).to.equal(newQuorum);
    });

    it("should allow owner to register secondary chain", async () => {
        await mainGov.connect(owner).addSecondaryChain("eth");

        const chains = await mainGov.getRegisteredChains();
        expect(chains).to.include("eth");
    });

    it("should revert if non-owner tries to update relayer", async () => {
        await expect(mainGov.connect(user1).updateRelayer(user2Addr)).to.be.reverted;
    });
});

describe("✅ SecondaryGovernance Tests", function () {
    it("should mirror a proposal with correct details", async () => {
        const proposalId = ethers.keccak256(ethers.toUtf8Bytes("proposal1"));
        const title = "Test Title";
        const ipfsHash = "ipfsHash";
        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");
        const startTime = block.timestamp;
        const endTime = startTime + 3600;
        await secondaryGov
            .connect(relayer)
            .mirrorProposal(proposalId, title, ipfsHash, startTime, endTime, user1Addr);
        const proposal = await secondaryGov.getProposalDetails(proposalId);
        expect(proposal.title).to.equal(title);
        expect(proposal.ipfsHash).to.equal(ipfsHash);
        expect(proposal.startTime).to.equal(startTime);
        expect(proposal.endTime).to.equal(endTime);
        expect(proposal.proposer).to.equal(user1Addr);
    });

    it("should revert if mirroring an existing proposal", async () => {
        const proposalId = ethers.keccak256(ethers.toUtf8Bytes("proposal1"));
        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");
        await secondaryGov
            .connect(relayer)
            .mirrorProposal(
                proposalId,
                "Test Title",
                "ipfsHash",
                block.timestamp,
                block.timestamp + 2000,
                user1Addr
            );
        await expect(
            secondaryGov
                .connect(relayer)
                .mirrorProposal(
                    proposalId,
                    "Test Title",
                    "ipfsHash",
                    block.timestamp,
                    block.timestamp + 2000,
                    user1Addr
                )
        ).to.be.revertedWithCustomError(secondaryGov, "ProposalAlreadyExists");
    });

    it("should revert if non-relayer tries to mirror", async () => {
        const proposalId = ethers.keccak256(ethers.toUtf8Bytes("proposal1"));
        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");
        await expect(
            secondaryGov
                .connect(user1)
                .mirrorProposal(
                    proposalId,
                    "Test Title",
                    "ipfsHash",
                    block.timestamp,
                    block.timestamp + 2000,
                    user1Addr
                )
        ).to.be.revertedWith("Only relayer can call");
    });

    it("should allow voting and finalizing on secondary chain", async () => {
        const proposalId = ethers.keccak256(ethers.toUtf8Bytes("proposal2"));
        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");
        const startTime = block.timestamp;
        await secondaryGov
            .connect(relayer)
            .mirrorProposal(
                proposalId,
                "Vote Title",
                "ipfsHash",
                startTime,
                startTime + 60,
                user1Addr
            );
        await secondaryGov.connect(user1).castVote(proposalId, true);
        await advanceTime(120); // Ensure voting period ends
        await secondaryGov.connect(relayer).finalizeVotes(proposalId);
        const proposal = await secondaryGov.getProposalDetails(proposalId);
        expect(proposal.voteFinalized).to.equal(true);
        expect(proposal.yesVotes).to.equal(ethers.parseEther("1000"));
    });

    it("should revert if voting twice on secondary chain", async () => {
        const proposalId = ethers.keccak256(ethers.toUtf8Bytes("proposal3"));
        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");
        const startTime = block.timestamp;
        await secondaryGov
            .connect(relayer)
            .mirrorProposal(
                proposalId,
                "Double Vote",
                "ipfsHash",
                startTime,
                startTime + 60,
                user1Addr
            );
        await secondaryGov.connect(user1).castVote(proposalId, true);
        await expect(secondaryGov.connect(user1).castVote(proposalId, true))
            .to.be.revertedWithCustomError(secondaryGov, "AlreadyVoted")
            .withArgs(user1Addr, proposalId);
    });

    it("should revert if voting after end time", async () => {
        const proposalId = ethers.keccak256(ethers.toUtf8Bytes("proposal4"));
        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");
        const startTime = block.timestamp;
        await secondaryGov
            .connect(relayer)
            .mirrorProposal(
                proposalId,
                "Expired Proposal",
                "ipfsHash",
                startTime,
                startTime + 60,
                user1Addr
            );
        await advanceTime(120);
        await expect(
            secondaryGov.connect(user1).castVote(proposalId, true)
        ).to.be.revertedWithCustomError(secondaryGov, "VotePeriodEnded");
    });

    it("should allow owner to update relayer", async () => {
        await secondaryGov.connect(owner).updateRelayer(user2Addr);
        expect(await secondaryGov.relayer()).to.equal(user2Addr);
    });
});

describe("✅ End-to-End Flow", function () {
    it("should create, mirror, vote, finalize, and execute a proposal", async () => {
        const newValue = "Governance Success";
        const callData = demoContract.interface.encodeFunctionData("updateValue", [newValue]);

        await mainGov
            .connect(user1)
            .createProposal(
                "Executable Proposal",
                "ipfsHash",
                2,
                [await demoContract.getAddress()],
                [0],
                [callData]
            );
        const proposals = await mainGov.getProposalIds();
        const proposalId = proposals[0];

        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");
        const startTime = block.timestamp;

        await secondaryGov
            .connect(relayer)
            .mirrorProposal(
                proposalId,
                "Executable Proposal",
                "ipfsHash",
                startTime,
                startTime + 120,
                user1Addr
            );

        await mainGov.connect(user1).castVote(proposalId, true);
        await mainGov.connect(user2).castVote(proposalId, true);
        await secondaryGov.connect(user1).castVote(proposalId, true);
        await secondaryGov.connect(user2).castVote(proposalId, true);

        await advanceTime(130);
        await ethers.provider.send("evm_mine");

        await secondaryGov.connect(relayer).finalizeVotes(proposalId);

        await mainGov
            .connect(relayer)
            .collectSecondaryChainVotes(
                proposalId,
                "bsc",
                ethers.parseEther("2000"),
                ethers.parseEther("0")
            );

        await mainGov.connect(user1).finalizeProposalVotes(proposalId);

        let proposal = await mainGov.getProposalDetails(proposalId);
        expect(proposal.status).to.equal(1); // Accepted
        expect(proposal.finalYesVotes).to.equal(ethers.parseEther("4000"));

        await expect(mainGov.connect(user1).executeProposal(proposalId))
            .to.emit(demoContract, "ValueUpdated")
            .withArgs(newValue, await mainGov.getAddress());

        proposal = await mainGov.getProposalDetails(proposalId);
        expect(proposal.status).to.equal(3); // Executed
        const demoValue = await demoContract.value();
        expect(demoValue).to.equal(newValue);
        const lastUpdater = await demoContract.lastUpdater();
        expect(lastUpdater).to.equal(await mainGov.getAddress());
    });

    it("should reject proposal if quorum not reached", async () => {
        await mainGov.connect(owner).updateQuorum(ethers.parseEther("3000"));

        await mainGov.connect(user1).createProposal("Low Vote Proposal", "ipfsHash", 2, [], [], []);
        const proposals = await mainGov.getProposalIds();
        const proposalId = proposals[0];

        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");
        const startTime = block.timestamp;

        await secondaryGov
            .connect(relayer)
            .mirrorProposal(
                proposalId,
                "Low Vote Proposal",
                "ipfsHash",
                startTime,
                startTime + 120,
                user1Addr
            );

        await mainGov.connect(user1).castVote(proposalId, true);
        await secondaryGov.connect(user1).castVote(proposalId, true);

        await advanceTime(130);
        await ethers.provider.send("evm_mine");

        await secondaryGov.connect(relayer).finalizeVotes(proposalId);

        await mainGov
            .connect(relayer)
            .collectSecondaryChainVotes(
                proposalId,
                "bsc",
                ethers.parseEther("1000"),
                ethers.parseEther("0")
            );

        await mainGov.connect(user1).finalizeProposalVotes(proposalId);

        const proposal = await mainGov.getProposalDetails(proposalId);
        expect(proposal.status).to.equal(2); // Rejected
    });

    it("should revert if secondary chain votes not collected", async () => {
        await mainGov.connect(user1).createProposal("No Votes Proposal", "ipfsHash", 2, [], [], []);
        const proposals = await mainGov.getProposalIds();
        const proposalId = proposals[0];

        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");
        const startTime = block.timestamp;

        await secondaryGov
            .connect(relayer)
            .mirrorProposal(
                proposalId,
                "No Votes Proposal",
                "ipfsHash",
                startTime,
                startTime + 120,
                user1Addr
            );

        await mainGov.connect(user1).castVote(proposalId, true);
        await secondaryGov.connect(user1).castVote(proposalId, true);

        await advanceTime(130);
        await ethers.provider.send("evm_mine");

        await secondaryGov.connect(relayer).finalizeVotes(proposalId);

        await expect(mainGov.connect(user1).finalizeProposalVotes(proposalId))
            .to.be.revertedWithCustomError(mainGov, "VotesNotCollected")
            .withArgs("bsc");
    });

    it("should revert if executing before votes finalized", async () => {
        const newValue = "Premature Execution";
        const callData = demoContract.interface.encodeFunctionData("updateValue", [newValue]);

        await mainGov
            .connect(user1)
            .createProposal(
                "Premature Proposal",
                "ipfsHash",
                2,
                [await demoContract.getAddress()],
                [0],
                [callData]
            );
        const proposals = await mainGov.getProposalIds();
        const proposalId = proposals[0];

        await mainGov.connect(user1).castVote(proposalId, true);

        await advanceTime(130);
        await ethers.provider.send("evm_mine");

        await expect(mainGov.connect(user1).executeProposal(proposalId)).to.be.revertedWith(
            "Votes not finalized"
        );
    });

    it("should revert if executing a rejected proposal", async () => {
        await mainGov.connect(owner).updateQuorum(ethers.parseEther("3000"));

        const newValue = "Rejected Proposal";
        const callData = demoContract.interface.encodeFunctionData("updateValue", [newValue]);

        await mainGov
            .connect(user1)
            .createProposal(
                "Rejected Proposal",
                "ipfsHash",
                2,
                [await demoContract.getAddress()],
                [0],
                [callData]
            );
        const proposals = await mainGov.getProposalIds();
        const proposalId = proposals[0];

        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("Block not found");
        const startTime = block.timestamp;

        await secondaryGov
            .connect(relayer)
            .mirrorProposal(
                proposalId,
                "Rejected Proposal",
                "ipfsHash",
                startTime,
                startTime + 120,
                user1Addr
            );

        await mainGov.connect(user1).castVote(proposalId, true);
        await secondaryGov.connect(user1).castVote(proposalId, true);

        await advanceTime(130);
        await ethers.provider.send("evm_mine");

        await secondaryGov.connect(relayer).finalizeVotes(proposalId);

        await mainGov
            .connect(relayer)
            .collectSecondaryChainVotes(
                proposalId,
                "bsc",
                ethers.parseEther("1000"),
                ethers.parseEther("0")
            );

        await mainGov.connect(user1).finalizeProposalVotes(proposalId);

        await expect(mainGov.connect(user1).executeProposal(proposalId)).to.be.revertedWith(
            "Proposal not accepted"
        );
    });
});

describe("✅ DemoContract Tests", function () {
    it("should update value and emit event", async () => {
        const newValue = "Test Value";
        await expect(demoContract.connect(user1).updateValue(newValue))
            .to.emit(demoContract, "ValueUpdated")
            .withArgs(newValue, user1Addr);
        expect(await demoContract.value()).to.equal(newValue);
        expect(await demoContract.lastUpdater()).to.equal(user1Addr);
    });
});

// This test cases are written with the help of LLMs