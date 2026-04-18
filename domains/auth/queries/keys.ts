export const authKeys = {
  all: ["auth"] as const,
  currentUser: ["auth", "currentUser"] as const,
  profile: (userId: string) => ["auth", "profile", userId] as const,
};
