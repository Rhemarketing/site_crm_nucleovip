import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  let session;
  try {
    session = await requireCurrentUser();
  } catch {
    redirect("/login");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      tenantId: session.tenantId,
      tenant: { status: "ACTIVE" },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tenant: { select: { id: true, name: true, document: true } },
    },
  });
  if (!user) redirect("/login");

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
