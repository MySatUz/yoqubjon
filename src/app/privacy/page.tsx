import type { Metadata } from 'next';
import LegalPage, { LegalSection } from '@/components/landing/LegalPage';
import { linkClass } from '@/components/ui/Button';
import { TELEGRAM_HANDLE, TELEGRAM_URL } from '@/lib/landing/warmup';
import { PREMIUM_PLAN } from '@/lib/plans';
import { BASE_OPEN_GRAPH, SITE_NAME, SITE_OG_IMAGE } from '@/lib/siteMetadata';

const DESCRIPTION = 'What MYSATuz stores about you, why, who can see it and which services handle it.';

export const metadata: Metadata = {
  title: 'Privacy',
  description: DESCRIPTION,
  alternates: { canonical: '/privacy' },
  // Its own preview: without it a shared link unfurls as the home page.
  openGraph: { ...BASE_OPEN_GRAPH, title: `Privacy · ${SITE_NAME}`, description: DESCRIPTION, url: '/privacy', images: [SITE_OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: `Privacy · ${SITE_NAME}`, description: DESCRIPTION, images: [SITE_OG_IMAGE] },
};

/*
 * Written from what the code does on 26 Oct 2026, not from a template: each
 * line names something the app really stores, shows or sends, so change the
 * page when that changes (sign-up fields, the payment form, the Telegram
 * payment chat, cookies). Not settled in code, and so not promised here: who
 * runs the service, how long data is kept, and how deletion requests are
 * handled. Those are the owner's to add.
 */
const UPDATED = new Date('2026-10-26T12:00:00+05:00');

function TelegramLink() {
  return (
    <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {TELEGRAM_HANDLE}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated={UPDATED}
      intro={
        <p>
          MYSATuz, at www.slope.uz, is a Digital SAT Math practice site. This page says what we store about you, why,
          who can see it and which outside services handle it. It describes what the site does today.
        </p>
      }
    >
      <LegalSection title="What you give us">
        <ul>
          <li>At sign-up: your name, your email and a password. We ask for nothing else: no phone, birth date or school.</li>
          <li>Your name appears on olympiad rankings. You can change it in your profile.</li>
          <li>
            If you pay for {PREMIUM_PLAN.name}: the name and the Telegram or phone contact you type, a payment note, an optional
            message and a photo or PDF of your receipt. We never ask for your card number or bank details.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What we record when you use the site">
        <ul>
          <li>Each test you finish: your answers, which of them were correct, your score estimate, your total time and the date.</li>
          <li>Course access an admin gives you: your email, the course, the end date and an optional note.</li>
          <li>Your {PREMIUM_PLAN.name} periods and your payment requests, with their amount and status.</li>
          <li>
            Sign-in, sign-up, code and password reset requests, with the network address they came from and, for a
            sign-in, the email typed, to slow down password guessing. Records older than 1 day no longer count and are
            deleted from time to time.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we keep it safe">
        <p>
          Passwords are stored only as a bcrypt hash, never as text. Email codes are stored only as a keyed hash; each
          works for 15 minutes and allows 5 tries. Receipts sit in private file storage. In the admin pages a receipt opens
          through a link that works for 5 minutes; the link in the admins’ Telegram chat works for 7 days.
        </p>
      </LegalSection>

      <LegalSection title="Who can see it">
        <ul>
          <li>You: your profile, results, reviews and payment requests.</li>
          <li>
            Our admins: your name, email, results, course access, and payment requests with their receipts. They use them
            to give access, check payments and answer your questions.
          </li>
          <li>
            Other students: your name and your olympiad result (questions solved, time, attempts, and the score on longer
            tests), on the olympiad’s ranking once it closes. Rankings are shown only to signed-in users (a private group’s
            only to its students and participants) and never show an email.
          </li>
        </ul>
        <p>The public pages of this site show no student data.</p>
      </LegalSection>

      <LegalSection title="Services that handle your data">
        <ul>
          <li>Vercel runs the site.</li>
          <li>A hosted PostgreSQL database keeps your account, results and payment records.</li>
          <li>Supabase keeps receipt files, in a private bucket.</li>
          <li>Brevo sends the emails with your confirmation and password reset codes. It receives your email address and the code.</li>
          <li>
            Telegram: when you send a payment request, its details go to a private Telegram chat where our admins review
            payments: your name, email, contact, payment note, message, the amount, and a link to the receipt that works
            for 7 days.
          </li>
          <li>
            Desmos provides the graphing calculator in tests. It loads from desmos.com only when you open the
            calculator, and Desmos’s own privacy policy covers it.
          </li>
        </ul>
        <p>We send no marketing email, and the site has no analytics, advertising or tracking scripts.</p>
      </LegalSection>

      <LegalSection title="Cookies and storage in your browser">
        <ul>
          <li>A sign-in cookie keeps you signed in. It ends when you sign out, or after 30 days without a visit.</li>
          <li>While you confirm your email, a cookie holds that email for up to 1 hour.</li>
          <li>During an olympiad, a cookie for that test brings you back to it. It ends when the olympiad closes.</li>
          <li>
            The test you are taking is saved in this browser, so a reload does not lose it. Its answers stay there after
            you submit, until you start another test or sign out. Signing out clears them.
          </li>
          <li>
            While you sign in, a cookie remembers which page to return to. Your browser also remembers whether you
            collapsed the sidebar and, for the tab, where you moved the test’s tool windows.
          </li>
          <li>The 3 warm-up questions on the home page keep your answers in that browser tab only. They are never sent to us.</li>
        </ul>
        <p>These cookies are needed for the site to work, so there is no cookie banner.</p>
      </LegalSection>

      <LegalSection title="Students under 18">
        <p>
          Many students on MYSATuz are under 18. A parent who wants to know what we hold about their child can write to
          us.
        </p>
      </LegalSection>

      <LegalSection title="Your data and how to reach us">
        <p>
          You can change your name in your profile. Your email can’t be changed in the app, and there is no button to
          delete an account yet. To ask what we hold about you, or to ask for a change, write to us in Telegram,{' '}
          <TelegramLink />.
        </p>
        <p>When this page changes, the date at the top changes with it.</p>
      </LegalSection>
    </LegalPage>
  );
}
