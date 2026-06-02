import { useGetSubscription } from "@workspace/api-client-react";

export type Plan = "free" | "pro" | "business";

const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, business: 2 };

export interface SubscriptionState {
  plan: Plan;
  status: string;
  isLoading: boolean;
  /** The plan the user can actually use right now (degrades to "free" when expired) */
  effectivePlan: Plan;
  /** Subscription is active and period has not lapsed */
  isActive: boolean;
  /** Payment failed — Paystack invoice bounce */
  isPastDue: boolean;
  /** Paid plan whose period end has already passed */
  isExpired: boolean;
  /** cancelAtPeriodEnd is set but period hasn't ended yet */
  isCancelling: boolean;
  currentPeriodEnd: Date | null;
  /** True when the user has at least `required` plan rights */
  hasPlan: (required: Plan) => boolean;
}

export function useSubscription(): SubscriptionState {
  const { data, isLoading } = useGetSubscription();

  const plan = (data?.plan ?? "free") as Plan;
  const status = data?.status ?? "active";
  const currentPeriodEnd = data?.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null;
  const cancelAtPeriodEnd = data?.cancelAtPeriodEnd ?? false;

  const now = new Date();
  const periodLapsed = currentPeriodEnd !== null && currentPeriodEnd < now;

  const isPastDue = status === "past_due";
  const isExpired = plan !== "free" && periodLapsed && status !== "active";
  const isCancelling = cancelAtPeriodEnd && !periodLapsed;

  // A paid subscription is "active" if status is active AND the period hasn't lapsed
  const isActive = status === "active" && (plan === "free" || !periodLapsed);

  // The plan rights the user currently holds
  const effectivePlan: Plan =
    plan === "free" ? "free" : isActive ? plan : "free";

  function hasPlan(required: Plan): boolean {
    return PLAN_RANK[effectivePlan] >= PLAN_RANK[required];
  }

  return {
    plan,
    status,
    isLoading,
    effectivePlan,
    isActive,
    isPastDue,
    isExpired,
    isCancelling,
    currentPeriodEnd,
    hasPlan,
  };
}
