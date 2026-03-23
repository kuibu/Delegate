import type { ActionKey, GateMode, Representative } from "@delegate/domain";

const gateReasons: Record<GateMode, string> = {
  allow: "This action is part of the representative's public operating scope.",
  ask_first: "This action touches owner approval, pricing discretion, or sensitive material.",
  deny: "This action would cross the boundary into private systems or irreversible commitments.",
};

export type GateDecision = {
  action: ActionKey;
  mode: GateMode;
  allowed: boolean;
  requiresOwnerApproval: boolean;
  reason: string;
};

export function evaluateActionGate(
  representative: Representative,
  action: ActionKey,
): GateDecision {
  const mode = representative.actionGate[action] ?? "deny";

  return {
    action,
    mode,
    allowed: mode === "allow",
    requiresOwnerApproval: mode === "ask_first",
    reason: gateReasons[mode],
  };
}
