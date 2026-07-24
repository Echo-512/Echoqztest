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
    description: "为秋招学生做的大厂行测刷题站，从图形推理开始逐题练、确认提交后判题并查看细分考点。",
    openGraph: {
      title: "秋招行测｜大厂笔试刷题站",
      description: "大厂行测，终于有地方练了。",
      type: "website",
      images: [{ url: socialImage, width: 1200, height: 630, alt: "秋招行测图形推理刷题站" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "秋招行测｜大厂笔试刷题站",
      description: "图形推理逐题计时，确认提交后看答案与解析。",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
