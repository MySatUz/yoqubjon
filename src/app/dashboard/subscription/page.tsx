import React, { cache, Suspense } from 'react';
import type { Metadata } from 'next';
import { auth } from "@/auth";
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import {
  formatManualPaymentAmount,
} from '@/lib/manual-payments';
import { getSubscriptionSettings } from '@/lib/subscription-settings';
import { isOwnerSessionUser } from '@/lib/admin';
import { getViewerAccess } from '@/lib/studentView';
import { getPurchasableCourses } from '@/lib/coursePurchase';
import { getActiveSectionAccessGrants } from '@/lib/sectionAccess';
import { getCachedTestCollections } from '@/lib/testCollections';
import { getCategoryLabel, isTestCategory, normalizeCategoryId } from '@/lib/testCatalog';
import { daysBetweenKeys, tashkentDateKey, utcDateKey } from '@/components/admin/courses/accessPlan';
import SubscriptionAvailabilityControl from '@/components/admin/SubscriptionAvailabilityControl';
import { Page, PageHeader } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Feedback';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { PREMIUM_PLAN, PREMIUM_PLAN_ID } from '@/lib/plans';
import { SubscriptionCheckout } from './SubscriptionCheckout';
import PaymentRequestsSection from './PaymentRequestsSection';

export const metadata: Metadata = { title: 'Subscription' };

/**
 * The active-subscription row, read through React `cache()` so that any second
 * reader in the same request (the header used to show the plan as well) costs
 * no extra Prisma call.
 */
const getActiveSubscription = cache((userId: string) =>
  prisma.subscription.findFirst({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() }
    },
    orderBy: { expiresAt: 'desc' },
  })
);

/**
 * `redirect('/login')` stays above every boundary: once a fallback is flushed
 * the response headers are already out and the status code can no longer
 * change (`loading.md`, "Status Codes"). `getSubscriptionSettings()` is the
 * cached global row, so awaiting it here costs a cache hit, not a DB round
 * trip — and the three per-user queries below no longer wait for it.
 *
 * Paused sales no longer swap the page for a lone notice: a student with
 * Premium still needs their plan, its expiry and their payments. Only the way
 * to buy closes, with a calm note in its place (see SubscriptionCheckout).
 */
export default async function SubscriptionPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  // `getViewerAccess` is false for an admin in student view, so the page then
  // looks exactly as a student sees it.
  const [subscriptionSettings, viewer, searchParams] = await Promise.all([
    getSubscriptionSettings(),
    getViewerAccess(userId),
    props.searchParams,
  ]);
  // `?course=` from a locked test on Practice: the page opens on paying for that course.
  const requestedCourse = typeof searchParams.course === 'string' && isTestCategory(searchParams.course)
    ? normalizeCategoryId(searchParams.course)
    : null;

  // Opening and closing sales lives here, on the page it controls, rather than
  // on the admin hub. It shows whether sales are open or not: an admin who
  // closed them has to be able to open them again from this same page. The server actions
  // check admin (and owner, for the card details) themselves.
  const canEditPaymentSettings = isOwnerSessionUser(session.user);
  const adminControl = viewer.isAdmin ? (
    <SubscriptionAvailabilityControl
      initialEnabled={subscriptionSettings.isEnabled}
      canEditPaymentSettings={canEditPaymentSettings}
      initialPaymentSettings={canEditPaymentSettings
        ? {
            cardHolder: subscriptionSettings.cardHolder,
            cardNumber: subscriptionSettings.cardNumber,
            cardType: subscriptionSettings.cardType,
            amount: subscriptionSettings.amount,
          }
        : null}
    />
  ) : null;

  const salesOpen = subscriptionSettings.isEnabled;

  return (
    <Page>
      <PageHeader
        title="Subscription"
        description={
          salesOpen
            ? `${PREMIUM_PLAN.name} opens every test in the one course you choose, for 30 days. Pay by card transfer; an admin opens the course once your receipt is checked.`
            : `Your courses and your payments. New ${PREMIUM_PLAN.name} subscriptions are paused for now.`
        }
      />

      {adminControl}

      {/* The admin's payment queue lives here, beside the sales switch: the
          separate Payments page is gone, and /admin/payments lands on
          #payments. Not in student view, where the page is the student's. */}
      {viewer.isAdmin && <PaymentRequestsSection />}

      <Suspense fallback={<CheckoutFallback />}>
        <CheckoutSection
          userId={userId}
          userName={session.user.name || ''}
          userEmail={session.user.email || ''}
          settings={subscriptionSettings}
          salesOpen={salesOpen}
          requestedCourse={requestedCourse}
        />
      </Suspense>
    </Page>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until `date`, rounded up: an end later today is "1 day left". */
function daysUntil(date: Date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / DAY_MS));
}

/** What a request without a course bought: Premium for every course, before courses were sold one at a time. */
const EVERY_COURSE_LABEL = `${PREMIUM_PLAN.name}, every course`;

async function CheckoutSection({
  userId,
  userName,
  userEmail,
  settings,
  salesOpen,
  requestedCourse,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  settings: Awaited<ReturnType<typeof getSubscriptionSettings>>;
  salesOpen: boolean;
  requestedCourse: string | null;
}) {
  const [subscription, manualRequests, payments, courses, grants, collections] = await Promise.all([
    getActiveSubscription(userId),
    prisma.manualPaymentRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      // No amount: a price is shown only in the payment details while sales
      // are open (the owner's rule), so a past one is not sent at all.
      select: {
        id: true,
        status: true,
        category: true,
        receiptFileName: true,
        adminNote: true,
        createdAt: true,
        reviewedAt: true,
      },
    }),
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        provider: true,
        status: true,
        createdAt: true,
      },
    }),
    getPurchasableCourses(userId, userEmail),
    getActiveSectionAccessGrants(userId, userEmail),
    getCachedTestCollections(),
  ]);

  const todayKey = tashkentDateKey(new Date());
  const serializedRequests = manualRequests.map((request) => ({
    ...request,
    courseLabel: request.category ? getCategoryLabel(request.category, collections) : EVERY_COURSE_LABEL,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() || null,
  }));
  const serializedPayments = payments.map((payment) => ({
    ...payment,
    createdAt: payment.createdAt.toISOString(),
  }));
  // Premium bought before courses were sold one at a time: every course until it ends.
  const premium = subscription?.planId === PREMIUM_PLAN_ID
    ? {
        expiresAt: subscription.expiresAt.toISOString(),
        provider: subscription.provider,
        daysLeft: daysUntil(subscription.expiresAt),
      }
    : null;
  // Every course the student holds, bought or given by an admin, soonest end
  // first: the one to renew next is on top, and a course with no end last.
  const ownedCourses = grants
    .map((grant) => {
      const endKey = grant.expiresAt ? utcDateKey(grant.expiresAt) : null;
      return {
        value: grant.category,
        label: getCategoryLabel(grant.category, collections),
        endKey,
        daysLeft: endKey ? Math.max(0, daysBetweenKeys(todayKey, endKey)) : null,
      };
    })
    .sort((a, b) => (a.endKey ?? '9999').localeCompare(b.endKey ?? '9999') || a.label.localeCompare(b.label));

  return (
    <SubscriptionCheckout
      userName={userName}
      userEmail={userEmail}
      salesOpen={salesOpen}
      todayKey={todayKey}
      courses={courses}
      ownedCourses={ownedCourses}
      premium={premium}
      initialCourse={courses.some((course) => course.value === requestedCourse) ? requestedCourse : null}
      requests={serializedRequests}
      payments={serializedPayments}
      // While sales are paused nothing here sells, so the card details - and
      // the price, which only the payment details show - stay out of the
      // payload, as they did when a pause replaced the whole page.
      transfer={salesOpen
        ? {
            cardHolder: settings.cardHolder,
            cardNumber: settings.cardNumber,
            cardType: settings.cardType,
            amount: settings.amount,
            currency: 'UZS',
            amountLabel: formatManualPaymentAmount(settings.amount),
          }
        : null}
    />
  );
}

/**
 * Mirrors the plans view of SubscriptionCheckout: the your-courses card, the
 * two plan cards and the billing history list. loading.tsx draws the same
 * blocks under its header skeleton.
 */
function CheckoutFallback() {
  return (
    <>
      <div className={cardClass}>
        <div className="border-b border-gray-100 px-5 py-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-1.5 h-4 w-56 max-w-full" />
        </div>
        <div className="flex items-center gap-4 px-4 py-3 sm:px-5">
          <div className="flex-1 space-y-1.5 py-0.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-16" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className={cn(cardClass, 'p-5')}>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-1.5 h-4 w-56 max-w-full" />
              <div className="mt-4 space-y-2">
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-4 w-44 max-w-full" />
                ))}
              </div>
              <Skeleton className="mt-5 h-9 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className={cn(cardClass, 'divide-y divide-gray-100')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <div className="flex-1 space-y-1.5 py-0.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-44 max-w-full" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
