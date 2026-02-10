import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "🍹 BarBot - Digital Ordering",
  description: "Scan, Order, Sip, Repeat - Your digital bartender awaits!",
};

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">🍹</div>
        <p className="text-gray-400">Loading BarBot...</p>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Suspense fallback={<Loading />}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
