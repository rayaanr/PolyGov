import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Governance, PGVToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Governance", function () {
    let governance: Governance;
    let pgvToken: PGVToken;
    let owner: HardhatEthersSigner;
    let relayer: HardhatEthersSigner;
    let voter1: HardhatEthersSigner;
    let voter2: HardhatEthersSigner;

    const PROPOSAL_DURATION = 1; // 1 day
    const MIN_VOTING_POWER = ethers.parseEther("100"); // 100 tokens
    const VOTER_INITIAL_BALANCE = ethers.parseEther("1000"); // 1000 tokens

    beforeEach(async function () {
        [owner, relayer, voter1, voter2] = await ethers.getSigners();

        // Deploy PGV Token
        const PGVTokenFactory = await ethers.getContractFactory("PGVToken");
        pgvToken = await PGVTokenFactory.deploy();

        // Deploy Governance
        const GovernanceFactory = await ethers.getContractFactory("Governance");
        governance = await GovernanceFactory.deploy(await pgvToken.getAddress(), relayer.address);

        // Transfer tokens to voters
        await pgvToken.transfer(voter1.address, VOTER_INITIAL_BALANCE);
        await pgvToken.transfer(voter2.address, VOTER_INITIAL_BALANCE);
    });

    describe("Deployment", function () {
        it("Should set the correct token and relayer addresses", async function () {
            expect(await governance.pgvToken()).to.equal(await pgvToken.getAddress());
            expect(await governance.relayer()).to.equal(relayer.address);
        });
    });

    describe("Proposal Creation", function () {
        it("Should create a proposal when caller has sufficient voting power", async function () {
            await pgvToken.approve(await governance.getAddress(), MIN_VOTING_POWER);

            const tx = await governance.createProposal(
                "Test Proposal",
                "Test Description",
                PROPOSAL_DURATION
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                (log) =>
                    log.topics[0] === governance.interface.getEvent("ProposalCreated").topicHash
            );
            expect(event).to.exist;

            const proposalId = event?.topics[1];
            const proposal = await governance.proposals(proposalId!);

            expect(proposal.title).to.equal("Test Proposal");
            expect(proposal.description).to.equal("Test Description");
            expect(proposal.status).to.equal(0); // Pending
        });

        it("Should revert if caller has insufficient voting power", async function () {
            const lowBalanceWallet = voter1;
            await pgvToken
                .connect(lowBalanceWallet)
                .transfer(owner.address, VOTER_INITIAL_BALANCE - ethers.parseEther("50"));

            await expect(
                governance
                    .connect(lowBalanceWallet)
                    .createProposal("Test Proposal", "Test Description", PROPOSAL_DURATION)
            ).to.be.revertedWithCustomError(governance, "NoVotingPower");
        });

        it("Should revert when the proposal duration is too short", async function () {
            await expect(
                governance.createProposal("Short Duration", "Description", 0)
            ).to.be.revertedWith("Duration too short");
        });
    });

    describe("Proposal Mirroring", function () {
        it("Should allow relayer to mirror a proposal", async function () {
            const proposalId = ethers.id("test-proposal");
            const startTime = await time.latest();
            const endTime = startTime + PROPOSAL_DURATION * 24 * 60 * 60;

            await expect(
                governance
                    .connect(relayer)
                    .mirrorProposal(
                        proposalId,
                        "Mirrored Proposal",
                        "Mirrored Description",
                        startTime,
                        endTime
                    )
            )
                .to.emit(governance, "ProposalMirrored")
                .withArgs(
                    proposalId,
                    "Mirrored Proposal",
                    "Mirrored Description",
                    startTime,
                    endTime
                );
        });

        it("Should revert if non-relayer tries to mirror a proposal", async function () {
            const proposalId = ethers.id("test-proposal");
            const startTime = await time.latest();
            const endTime = startTime + PROPOSAL_DURATION * 24 * 60 * 60;

            await expect(
                governance.mirrorProposal(
                    proposalId,
                    "Mirrored Proposal",
                    "Mirrored Description",
                    startTime,
                    endTime
                )
            ).to.be.revertedWithCustomError(governance, "OnlyRelayer");
        });
    });

    describe("Voting with weighted votes", function () {
        let proposalId: string;

        beforeEach(async function () {
            const tx = await governance
                .connect(voter1)
                .createProposal("Test Proposal", "Test Description", PROPOSAL_DURATION);
            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                (log) =>
                    log.topics[0] === governance.interface.getEvent("ProposalCreated").topicHash
            );
            proposalId = event!.topics[1];
        });

        it("Should allow voting with correct weight", async function () {
            await expect(governance.connect(voter2).vote(proposalId, true))
                .to.emit(governance, "Voted")
                .withArgs(proposalId, voter2.address, true, VOTER_INITIAL_BALANCE);

            const proposal = await governance.proposals(proposalId);
            expect(proposal.yesVotes).to.equal(VOTER_INITIAL_BALANCE);
        });

        it("Should correctly handle voters with different token weights", async function () {
            await pgvToken.transfer(voter2.address, ethers.parseEther("500")); // Transfer additional tokens to voter2

            await governance.connect(voter1).vote(proposalId, true); // 1000 tokens
            await governance.connect(voter2).vote(proposalId, false); // 1500 tokens

            const proposal = await governance.proposals(proposalId);
            expect(proposal.yesVotes).to.equal(ethers.parseEther("1000"));
            expect(proposal.noVotes).to.equal(ethers.parseEther("1500"));
        });

        it("Should prevent double voting", async function () {
            await governance.connect(voter2).vote(proposalId, true);
            await expect(
                governance.connect(voter2).vote(proposalId, false)
            ).to.be.revertedWithCustomError(governance, "AlreadyVoted");
        });

        it("Should prevent voting after end time", async function () {
            await time.increase(2 * 24 * 60 * 60); // Increase by 2 days
            await expect(
                governance.connect(voter2).vote(proposalId, true)
            ).to.be.revertedWithCustomError(governance, "VotingPeriodEnded");
        });
    });

    describe("Vote Finalization and Execution", function () {
        let proposalId: string;

        beforeEach(async function () {
            const tx = await governance
                .connect(voter1)
                .createProposal("Test Proposal", "Test Description", PROPOSAL_DURATION);
            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                (log) =>
                    log.topics[0] === governance.interface.getEvent("ProposalCreated").topicHash
            );
            proposalId = event!.topics[1];

            await governance.connect(voter1).vote(proposalId, true);
            await governance.connect(voter2).vote(proposalId, false);
        });

        it("Should allow relayer to finalize vote tally", async function () {
            await time.increase(2 * 24 * 60 * 60); // Increase by 2 days

            const yesVotes = VOTER_INITIAL_BALANCE;
            const noVotes = VOTER_INITIAL_BALANCE;

            await expect(
                governance.connect(relayer).finalizeVoteTally(proposalId, yesVotes, noVotes)
            )
                .to.emit(governance, "VoteTallyFinalized")
                .withArgs(proposalId, yesVotes, noVotes);
        });

        it("Should execute accepted proposals", async function () {
            await time.increase(2 * 24 * 60 * 60);
            await governance
                .connect(relayer)
                .finalizeVoteTally(proposalId, VOTER_INITIAL_BALANCE, VOTER_INITIAL_BALANCE / 2n);

            await expect(governance.executeProposal(proposalId))
                .to.emit(governance, "ProposalExecuted")
                .withArgs(proposalId, 1); // Accepted
        });

        it("Should reject proposals when no votes exceed yes votes", async function () {
            await time.increase(2 * 24 * 60 * 60);
            await governance
                .connect(relayer)
                .finalizeVoteTally(proposalId, VOTER_INITIAL_BALANCE / 2n, VOTER_INITIAL_BALANCE);

            await governance.executeProposal(proposalId);
            const proposal = await governance.proposals(proposalId);
            expect(proposal.status).to.equal(2); // Rejected
        });
    });
});
