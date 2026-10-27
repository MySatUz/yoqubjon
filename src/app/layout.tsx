import type { Metadata } from "next";
import { Fira_Sans } from "next/font/google";
import { SIDEBAR_INIT_SCRIPT } from "@/components/layout/sidebarState";
import { SITE_URL } from "@/lib/landing/warmup";
import { BASE_OPEN_GRAPH, SITE_OG_IMAGE, SITE_TITLE } from "@/lib/siteMetadata";
import "./globals.css";

// Fira Sans: Russian and Uzbek Cyrillic (Ққ Ғғ Ҳҳ Ўў), the Uzbek ʻ (oʻ, gʻ —
// in the latin subset), tabular figures, and it holds up at 12–14px; see
// AGENTS.md, "Type". Three weights only: 400 to read, 500 to act on, 600 for
// titles. Every subset is self-hosted whatever this lists — `subsets` only
// picks the files that are preloaded. The UI is English, so only latin is;
// Cyrillic names still render, loaded on demand.
const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

const SITE_DESCRIPTION =
  "Digital SAT Math practice for students in Uzbekistan: timed modules in the format of the real test, with an estimated score.";

export const metadata: Metadata = {
  // The production domain, never a preview deploy: the og:image URL resolves
  // against it, and a link shared from anywhere should unfurl to slope.uz.
  metadataBase: new URL(SITE_URL),
  // Pages name themselves ("Sign in", ...) and get "· MYSATuz" appended, so
  // tabs and history entries can be told apart - and Next announces a route
  // change to screen readers only when the title changes.
  title: { default: SITE_TITLE, template: "%s · MYSATuz" },
  description: SITE_DESCRIPTION,
  // What a link shared in Telegram unfurls to: the site kit's card. The tab
  // and home-screen icons are the files beside this one (favicon.ico,
  // icon.png, apple-icon.png) and manifest.ts.
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [SITE_OG_IMAGE] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The head script sets <html data-sidebar> from localStorage before the
  // first paint (see sidebarState.ts). It lives here, not in the app shell,
  // because the root layout is rendered once and never re-rendered on the
  // client, where React would refuse to run an inline script. The attribute
  // it adds is why <html> needs suppressHydrationWarning.
  return (
    <html lang="en" className={`${firaSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
