export const PLAN_CONFIG = {
  pro: {
    name: "Creator Pro",
    priceNgn: 5000,
    priceKobo: 500000,
    referralRewardNgn: 1000,
  },
  business: {
    name: "Creator Business",
    priceNgn: 15000,
    priceKobo: 1500000,
    referralRewardNgn: 3000,
  },
} as const;

export type PlanKey = keyof typeof PLAN_CONFIG;

export const PLAN_PRICES_KOBO: Record<string, number> = {
  pro: PLAN_CONFIG.pro.priceKobo,
  business: PLAN_CONFIG.business.priceKobo,
};

export const PLAN_NAMES: Record<string, string> = {
  pro: PLAN_CONFIG.pro.name,
  business: PLAN_CONFIG.business.name,
};

export const REFERRAL_REWARDS_NGN: Record<string, number> = {
  pro: PLAN_CONFIG.pro.referralRewardNgn,
  business: PLAN_CONFIG.business.referralRewardNgn,
};
