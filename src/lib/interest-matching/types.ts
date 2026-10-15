export type MatchIntro = {
  reason: string;
  question: string;
  sharedInterests: string[];
};

export type WaitingProfile = {
  entryId: number;
  userId: number;
  joinedAt: Date;
  interests: string[];
};

export type RankedCandidate = {
  profile: WaitingProfile;
  overlap: number;
  score: number;
  sharedInterests: string[];
};

export type PairProposal = {
  anchor: WaitingProfile;
  partner: WaitingProfile;
  intro: MatchIntro;
};
