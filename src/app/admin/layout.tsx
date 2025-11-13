import { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/auth");
  if (session.role !== "admin" && session.role !== "superadmin") {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
