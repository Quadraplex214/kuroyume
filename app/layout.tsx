import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  Instrument_Serif,
  Noto_Serif_JP,
  Outfit,
} from "next/font/google";

import { cn } from "@/lib/utils";

import "./globals.css";
import "./platform.css";
import { SiteHeader, SiteFooter } from "@/components/site/shell";

import Script from "next/script";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
});

const notoSerifJp = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-noto-jp",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Kuroyume — Your personal story atlas",
    template: "%s | Kuroyume",
  },
  applicationName: "Kuroyume",
  description:
    "Discover anime, manga, and manhwa worth getting lost in. Curated stories, a personal collection, and rankings from the MyAnimeList community.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={cn(
        "dark h-full antialiased",
        outfit.variable,
        instrument.variable,
        notoSerifJp.variable,
        ibmPlexMono.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <Script
          src="https://storage.googleapis.com/website-translation-script/translator.staging.js"
          data-api-key="wt_2c121c6f8f8a48e1_fVa-wZ8814aG-CJ3ge5u3Q"
          data-disable-auto-browser-translation="false"
        />
      </body>
    </html>
  );
}
