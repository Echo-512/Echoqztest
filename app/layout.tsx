import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { AccountProvider } from "./account-context";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title: "Offer Fawn｜Offer 鹿 · 秋招行测",
    description: "Offer Fawn 为秋招学生提供北森题库、逐题计时、错题归档、收藏复练与跨端同步。",
    openGraph: {
      title: "Offer Fawn｜Offer 鹿，一路录取",
      description: "沿着自己的节奏，走向那份 Offer。",
      type: "website",
      images: [{ url: socialImage, width: 1200, height: 630, alt: "Offer Fawn 秋招行测刷题站" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Offer Fawn｜Offer 鹿 · 秋招行测",
      description: "Offer 鹿，一路录取。",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AccountProvider>{children}</AccountProvider>
      </body>
    </html>
  );
}
