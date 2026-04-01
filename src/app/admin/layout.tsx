import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coasis Admin Panel",
  description: "Restaurant Admin Dashboard - Manage orders, menu, and tables",
  other: {
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
