import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "netrikxr.shop Tenant Admin",
  description: "Tenant restaurant admin dashboard",
  other: {
    "application-name": "netrikxr.shop Tenant Admin",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
