import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coasis Admin Panel",
  description: "Restaurant Admin Dashboard - Manage orders, menu, and tables",
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Coasis Admin",
    startupImage: [
      {
        url: "/icons/icon-512x512.png",
      },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "application-name": "Coasis Admin",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
