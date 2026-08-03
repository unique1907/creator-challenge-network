export type PublicAuthState =
  | { kind: "anonymous" }
  | { kind: "brand"; onboardingComplete: boolean }
  | { kind: "creator"; onboardingComplete: boolean };
