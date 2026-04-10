import type { Metadata } from "next";
import { MarketingBodyClass } from "@/components/marketing/MarketingBodyClass";

export const metadata: Metadata = {
  title: "ViralCarousels | You already have the content.",
  description:
    "Transform your existing content into highly engaging, viral carousels in seconds. Built for creators who refuse to be inconsistent.",
  openGraph: {
    title: "ViralCarousels",
    description:
      "Transform your existing content into highly engaging, viral carousels in seconds.",
    type: "website",
  },
};

export default function HomeMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-theme min-h-dvh w-full">
      <MarketingBodyClass />
      {children}
    </div>
  );
}
