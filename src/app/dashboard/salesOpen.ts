import { getSubscriptionSettings } from '@/lib/subscription-settings';

/**
 * Whether Premium is on sale, for the dashboard pages that point at it - the
 * catalog's locked cards and the profile's plan line. While an admin has
 * paused sales they must not send a student to a page with nothing to buy.
 *
 * A failed read keeps the usual wording, as on the landing: the subscription
 * page says so itself if sales are closed, and neither page should fail over
 * a setting.
 */
export async function readSalesOpen(where: string) {
  try {
    return (await getSubscriptionSettings()).isEnabled;
  } catch (error) {
    console.error(`${where}: could not read the subscription settings`, error);
    return true;
  }
}
