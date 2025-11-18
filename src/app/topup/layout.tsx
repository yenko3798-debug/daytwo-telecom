// server component – protects every page under (telecom)
import { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TelecomLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/auth");
  return <>{children}</>;
}
