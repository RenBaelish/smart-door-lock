import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import "./globals.css";

// Body text. "seasonSans" is not bundled in the project, so Inter is used as its fallback.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

// Headings: Avantt 400 / 500 / 600
const avantt = localFont({
  variable: "--font-avantt",
  display: "swap",
  src: [
    { path: "../public/font/AvanttTRIAL-Regular-BF6721a86b1a848.otf", weight: "400", style: "normal" },
    { path: "../public/font/AvanttTRIAL-Medium-BF6721a86adebb3.otf", weight: "500", style: "normal" },
    { path: "../public/font/AvanttTRIAL-SemiBold-BF6721a86b1576e.otf", weight: "600", style: "normal" },
  ],
});

// All-caps labels: Foundry Gridnik 500
const gridnik = localFont({
  variable: "--font-gridnik",
  display: "swap",
  src: [{ path: "../public/font/FoundryGridnik Regular.otf", weight: "500", style: "normal" }],
});

export const metadata: Metadata = {
  title: { default: "FaceLock Console", template: "%s | FaceLock Console" },
  description:
    "Administration console for the face recognition smart door lock: enrollment, live recognition testing, access audit logs and network monitoring.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${avantt.variable} ${gridnik.variable}`}>
      <body className="font-sans">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1">
              <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
