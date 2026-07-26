import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title: "秋招行测｜大厂笔试刷题站",
    description: "为秋招学生做的大厂行测练习工具：北森题库、逐题计时、错题归档、收藏复练与跨端同步。",
    openGraph: {
      title: "秋招行测｜大厂笔试刷题站",
      description: "把大厂行测，练得更有把握。",
      type: "website",
      images: [{ url: socialImage, width: 1200, height: 630, alt: "秋招行测图形推理刷题站" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "秋招行测｜大厂笔试刷题站",
      description: "北森题库逐题计时，错题归档，收藏复练。",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
