import { ChallengeCard } from "@/features/challenges/components/challenge-card";
import type { Challenge } from "@/types/ccn";

type ChallengeGridProps = {
  challenges: Challenge[];
};

export function ChallengeGrid({ challenges }: ChallengeGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {challenges.map((challenge) => (
        <ChallengeCard key={challenge.slug} challenge={challenge} />
      ))}
    </div>
  );
}
