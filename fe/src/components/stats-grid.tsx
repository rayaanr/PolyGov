import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GovernanceStats } from "@/lib/types";
import { chainColors, chainIcons } from "@/lib/mock-data";

interface StatsGridProps {
    stats: GovernanceStats[];
}

export function StatsGrid({ stats }: StatsGridProps) {
    return (
        <div className="grid gap-4 md:grid-cols-4">
            {stats.map((stat) => (
                <Card key={stat.chain}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {stat.chain.charAt(0).toUpperCase() + stat.chain.slice(1)}
                        </CardTitle>
                        <span className="text-2xl" style={{ color: chainColors[stat.chain] }}>
                            {chainIcons[stat.chain]}
                        </span>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div>
                                <span className="text-2xl font-bold">{stat.activeProposals}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                    Active Proposals
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {stat.totalProposals} Total Proposals • {stat.averageParticipation}%
                                Participation
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
