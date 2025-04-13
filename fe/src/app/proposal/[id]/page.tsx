import ProposalDetails from "@/components/proposal-details";

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const proposalId = id;
    if (!proposalId) {
        return <div>Error: Proposal ID is required</div>;
    }

    return (
        <div className="container max-w-3xl mx-auto p-4 space-y-6">
            <ProposalDetails id={proposalId} />
        </div>
    );
}
