import type {
  CapabilityKind,
  CapabilityPolicyProfile,
  CapabilityPolicyRule,
  PolicyDecision,
} from "@delegate/compute-protocol";

export type EvaluateCapabilityRequest = {
  capability: CapabilityKind;
  command?: string | undefined;
  path?: string | undefined;
  domain?: string | undefined;
  estimatedCostCents?: number | undefined;
  hasPaidEntitlement?: boolean | undefined;
};

export type EvaluatedCapabilityDecision = {
  decision: PolicyDecision;
  reason: string;
  matchedRuleId?: string;
};

export function evaluateCapabilityPolicy(
  profile: CapabilityPolicyProfile,
  request: EvaluateCapabilityRequest,
): EvaluatedCapabilityDecision {
  const sortedRules = [...profile.rules].sort((left, right) => right.priority - left.priority);

  for (const rule of sortedRules) {
    if (rule.capability !== request.capability) {
      continue;
    }

    if (!matchesPattern(rule.commandPattern, request.command)) {
      continue;
    }

    if (!matchesPattern(rule.pathPattern, request.path)) {
      continue;
    }

    if (!matchesPattern(rule.domainPattern, request.domain)) {
      continue;
    }

    if (rule.requiresPaidPlan && !request.hasPaidEntitlement) {
      return {
        decision: "deny",
        reason: "paid_plan_required",
        matchedRuleId: rule.id,
      };
    }

    if (
      typeof rule.maxCostCents === "number" &&
      typeof request.estimatedCostCents === "number" &&
      request.estimatedCostCents > rule.maxCostCents
    ) {
      return {
        decision: "ask",
        reason: "cost_above_rule_limit",
        matchedRuleId: rule.id,
      };
    }

    if (rule.requiresHumanApproval) {
      return {
        decision: "ask",
        reason: "human_approval_required",
        matchedRuleId: rule.id,
      };
    }

    return {
      decision: rule.decision,
      reason: "matched_rule",
      matchedRuleId: rule.id,
    };
  }

  return {
    decision: profile.defaultDecision,
    reason: "default_profile_decision",
  };
}

function matchesPattern(pattern: string | undefined, value: string | undefined): boolean {
  if (!pattern) {
    return true;
  }

  if (!value) {
    return false;
  }

  try {
    return new RegExp(pattern, "i").test(value);
  } catch {
    return value.includes(pattern);
  }
}
