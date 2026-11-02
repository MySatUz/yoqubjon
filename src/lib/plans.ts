export const PREMIUM_PLAN_ID = 'PREMIUM';
export const PREMIUM_MONTHLY_AMOUNT_UZS = 119000;

/**
 * The two plans as a student or a parent reads them — one list for the landing
 * and for the app's subscription page, which used to disagree with each other
 * and to sell things that did not exist ("Progress dashboard", "Priority
 * support").
 *
 * Every line is something the code does today; check it before adding one.
 * A test marked Free (`Test.isFree`) is open to every account, and every other
 * test opens with access to its course. Premium Pro is sold one course at a
 * time (the owner's rule, 2026-10-31): an approved payment gives 30 days of
 * the course the student chose (coursePurchase.ts), the same access an admin
 * gives. Premium bought before then opened every course and still does until
 * it ends (a `Subscription` row). The
 * review comes with every finished attempt, on any plan; the score estimate
 * with every attempt at a test of 10+ questions (MIN_QUESTIONS_FOR_SCORE in
 * scoreDisplay.ts), since a shorter check reports "2 of 3 correct" instead.
 *
 * No price here: the amount is the owner's to show, and it lives in
 * `SubscriptionSetting`, read at the transfer step.
 */
export interface PlanSummary {
  id: string;
  name: string;
  /** One line under the name. */
  summary: string;
  features: string[];
}

export const FREE_PLAN: PlanSummary = {
  id: 'FREE',
  name: 'Free Starter',
  summary: 'To see how it works.',
  features: [
    // Not "timed like the real module": each test's time is set by an admin.
    'The tests marked Free in Practice, on the timed test screen',
    'A score estimate on the 200–800 scale after each full test',
    'A review of every question, your answer next to the correct one',
  ],
};

export const PREMIUM_PLAN: PlanSummary = {
  id: PREMIUM_PLAN_ID,
  name: 'Premium Pro',
  summary: 'Every test in the one course you choose.',
  features: [
    'Everything in Free Starter',
    'Every test in the Practice course you choose',
    '30 days of that course for each payment',
    'Paid by card transfer, never charged automatically',
  ],
};
