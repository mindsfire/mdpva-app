"use client";

import { Analytics as VercelAnalytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Drops the query string before a page view leaves the browser. The members
 * and applications search boxes put whatever was typed — a member's name,
 * phone number — into `?q=`, and that must not end up in Vercel's dashboard.
 * Page paths alone are enough to count visits.
 *
 * Exported for the test; the client wrapper exists only because the root
 * layout is a Server Component and can't hand a function to `<Analytics>`.
 */
export function stripQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.search = "";
  return { ...event, url: url.toString() };
}

export function Analytics() {
  return <VercelAnalytics beforeSend={stripQuery} />;
}
