import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";
import { AnnouncementTicker } from "@/components/AnnouncementTicker";
import { CartProvider } from "@/components/CartProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { MobileTabBar } from "@/components/MobileTabBar";
import { DepthEffect } from "@/components/DepthEffect";
import { listSports } from "@/lib/categories";

export const metadata: Metadata = {
  title: { default: "SPORTIQ | Wear Your Game", template: "%s | SPORTIQ" },
  description: "SPORTIQ is a Sri Lankan sportswear store for football, NBA, NFL, NHL, Formula 1 and more. Ready stock and pre-orders from S to 3XL, delivered worldwide.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sports = await listSports();
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col pb-20 md:pb-0">
        <CartProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-ink">
            Skip to content
          </a>
          <AnnouncementTicker />
          <Header sports={sports} />
          <main id="main" className="flex-1">{children}</main>
          <Footer sports={sports} />
          <WhatsAppButton />
          <MobileTabBar />
          <DepthEffect />
        </CartProvider>
      </body>
    </html>
  );
}
