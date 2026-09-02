import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/backend/auth/require-admin";
import { AdminShell } from "./AdminShell";

export const metadata: Metadata = {
  title: {
    default: "Admin Portal | Eventsika",
    template: "%s | Eventsika Admin",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authResult = await requireAdminSession();

  if (!authResult.authorized) {
    redirect("/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
