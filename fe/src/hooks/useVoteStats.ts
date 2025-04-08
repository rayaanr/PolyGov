import { TOTAL_VOTING_POWER, VOTE_DIVISOR } from "@/constants/const";
import { ProposalDetails, SecondaryProposal } from "@/lib/types";

interface VoteStats {
    yes: number;
    no: number;
    yesPercentage: string;
    noPercentage: string;
}

const useVoteStats = (
    mainProposal: ProposalDetails,
    secondaryProposals: SecondaryProposal[]
): VoteStats => {
    const totalVotes = [mainProposal, ...secondaryProposals.map((sp) => sp.proposal)].reduce(
        (acc, proposal) => {
            acc.yes += Number(proposal.yesVotes) / 10 ** 18;
            acc.no += Number(proposal.noVotes) / 10 ** 18;
            return acc;
        },
        { yes: 0, no: 0 }
    );

    const toPercentage = (votes: number) => ((votes / TOTAL_VOTING_POWER) * 100).toFixed(1);
    return {
        yes: totalVotes.yes,
        no: totalVotes.no,
        yesPercentage: toPercentage(totalVotes.yes),
        noPercentage: toPercentage(totalVotes.no),
    };
};

export default useVoteStats;
