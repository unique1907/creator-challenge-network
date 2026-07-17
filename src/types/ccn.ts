export type PlatformStat = {
  label: string;
  value: string;
  detail: string;
};

export type ChallengeTrack = {
  title: string;
  description: string;
  reward: string;
};

export type WorkflowStep = {
  title: string;
  description: string;
};

export type ValidationItem = {
  label: string;
  status: "ready" | "in-progress" | "planned";
};
