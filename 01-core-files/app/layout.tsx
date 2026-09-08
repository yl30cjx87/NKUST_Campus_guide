import type { Metadata } from "next";
import "./globals.css";
import LandscapeExperience from "./landscape-experience";

export const metadata: Metadata = {
  title: "高科生力軍｜五校區藝術探索",
  description: "跟著小高探索高科大五座校園藝術島。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body><LandscapeExperience>{children}</LandscapeExperience></body></html>;
}
