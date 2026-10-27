import type { Metadata } from 'next';
import LegalPage, { LegalSection } from '@/components/landing/LegalPage';
import { linkClass } from '@/components/ui/Button';
import { TELEGRAM_HANDLE, TELEGRAM_URL } from '@/lib/landing/warmup';
import { FREE_PLAN, PREMIUM_PLAN } from '@/lib/plans';
import { MIN_QUESTIONS_FOR_SCORE } from '@/lib/scoreDisplay';
import { BASE_OPEN_GRAPH, SITE_NAME, SITE_OG_IMAGE } from '@/lib/siteMetadata';

const DESCRIPTION = `How MYSATuz works: your account, ${FREE_PLAN.name} and ${PREMIUM_PLAN.name}, course access, tests, scores and olympiads.`;

export const metadata: Metadata = {
  title: 'Terms',
  description: DESCRIPTION,
  alternates: { canonical: '/terms' },
  // Its own preview: without it a shared link unfurls as the home page.
  openGraph: { ...BASE_OPEN_GRAPH, title: `Terms · ${SITE_NAME}`, description: DESCRIPTION, url: '/terms', images: [SITE_OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: `Terms · ${SITE_NAME}`, description: DESCRIPTION, images: [SITE_OG_IMAGE] },
};

/*
 * The rules as the code applies them on 26 Oct 2026: plans from plans.ts,
 * Premium from manual-payments.ts and the payment request route, course access
 * from accessPlan.ts, attempts and scores from the exam and scoreDisplay.ts,
 * olympiads from olympiad.ts. Change the page with the rule. Not settled in
 * code, and so not stated: who runs the service, refunds, governing law.
 * No price on this page (the owner's rule); the amount lives in the payment form.
 */
const UPDATED = new Date('2026-10-26T12:00:00+05:00');

function TelegramLink() {
  return (
    <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {TELEGRAM_HANDLE}
    </a>
  );
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated={UPDATED}
      intro={
        <p>
          These terms say how MYSATuz works: what your account gives you, how {PREMIUM_PLAN.name} and course access
          work, and what the scores mean. They describe the site as it works today. By using the site you agree to
          them.
        </p>
      }
    >
      <LegalSection title="Your account">
        <ul>
          <li>Each email can have 1 account. Your name is required, because it appears on olympiad rankings.</li>
          <li>A password needs at least 8 characters. Keep it to yourself: whoever signs in can see your results.</li>
          <li>When we send a confirmation code to your email, your account opens once you enter it.</li>
        </ul>
      </LegalSection>

      <LegalSection title={FREE_PLAN.name}>
        <p>
          Every account can take the tests marked Free in Practice, on the timed test screen, with a review of every
          question and a score estimate after each full test. No payment details are needed, and {FREE_PLAN.name} has no end date.
        </p>
      </LegalSection>

      <LegalSection title={PREMIUM_PLAN.name}>
        <ul>
          <li>
            {PREMIUM_PLAN.name} opens every test in every Practice course. Some tests also need a test code, and an
            olympiad opens only during its window.
          </li>
          <li>
            You pay by card transfer to the card shown in your account, then upload a photo or PDF of the receipt. An
            admin checks it and switches {PREMIUM_PLAN.name} on. The amount is shown only at that step.
          </li>
          <li>{PREMIUM_PLAN.name} lasts 30 days from the moment it is switched on. Nothing is ever charged automatically.</li>
          <li>
            You can have 1 payment request waiting at a time. While {PREMIUM_PLAN.name} is active you can’t send a new
            one, so a new period starts after the current one ends.
          </li>
          <li>We may pause new subscriptions. Premium that is already on keeps working.</li>
          <li>
            If you cancel, access to Premium tests stops right away, even with days left. Refunds are not handled in the
            app; write to us in Telegram, <TelegramLink />.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Course access">
        <ul>
          <li>An admin can give your email access to a course for 1, 2 or 3 months, even before you have an account.</li>
          <li>New months are added to the current end date. Access is only ever extended this way, never shortened.</li>
          <li>Access lasts through the last day shown in Practice. An admin can also remove it.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Tests and scores">
        <ul>
          <li>
            Each test has its own number of attempts, shown in Practice. An attempt counts when you submit it, and once
            they are used up the test no longer opens.
          </li>
          <li>
            A test is 1 timed block or a set of modules, each with its own clock, and the clock keeps running if you
            close the test. When a module’s time runs out on screen, it ends by itself. If it ran out while the test was
            closed, you choose to send the saved answers or start again.
          </li>
          <li>A test in progress is saved in your browser until you submit it.</li>
          <li>
            The score is an estimate on the 200–800 scale, given for a test of {MIN_QUESTIONS_FOR_SCORE} questions or
            more. It is not an official College Board score.
          </li>
          <li>Our modules are fixed sets. Unlike the real test, they don’t change with your answers.</li>
          <li>The review shows your answer and the correct one, one question at a time.</li>
          <li>If we remove a test, its results are removed with it.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Olympiads">
        <ul>
          <li>An olympiad opens and closes at set times, in Tashkent time.</li>
          <li>
            You can enter with {PREMIUM_PLAN.name}, with access to its course, or freely when the olympiad is marked
            Free. A new attempt can start until one full test length before it closes.
          </li>
          <li>
            Only attempts submitted inside the window count, and only your best one. More questions solved ranks higher;
            on a tie, the shorter time wins, and exact ties share a place.
          </li>
          <li>
            The ranking appears once the olympiad closes, for signed-in users, with names and never emails; for an
            olympiad in a private group course, only for its students and those who took part. The review of its
            questions opens at the same time.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="When access ends">
        <p>Paid tests close, and your results and reviews stay open to you.</p>
      </LegalSection>

      <LegalSection title="The test and its tools">
        <p>
          SAT is a registered trademark of the College Board, which is not affiliated with MYSATuz. The graphing
          calculator in tests is provided by Desmos.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          When these terms change, the date at the top changes with them. Questions go to Telegram, <TelegramLink />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
