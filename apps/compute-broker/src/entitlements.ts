export function deriveConversationComputeEntitlements(params: {
  conversation?:
    | {
        passUnlockedAt: Date | null;
        deepHelpUnlockedAt: Date | null;
      }
    | null
    | undefined;
  requestedPaidEntitlement?: boolean;
}) {
  const passUnlocked = Boolean(params.conversation?.passUnlockedAt);
  const deepHelpUnlocked = Boolean(params.conversation?.deepHelpUnlockedAt);

  return {
    hasPaidEntitlement: Boolean(params.requestedPaidEntitlement || passUnlocked || deepHelpUnlocked),
    activePlanTier: deepHelpUnlocked ? "deep_help" : passUnlocked ? "pass" : undefined,
  } as const;
}
