import type { WhatsAppAccountStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { validateMetaAccountCredentials } from "@/services/meta-whatsapp.service";

export type CreateWhatsAppAccountInput = {
  name: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  businessAccountId: string;
};

const publicAccountSelect = {
  id: true,
  name: true,
  phoneNumberId: true,
  wabaId: true,
  businessAccountId: true,
  status: true,
  qualityRating: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function listWhatsAppAccounts(tenantId: string) {
  return prisma.whatsAppAccount.findMany({
    where: { tenantId },
    select: publicAccountSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function createWhatsAppAccount(
  tenantId: string,
  input: CreateWhatsAppAccountInput,
) {
  const validation = await validateMetaAccountCredentials(input);

  return prisma.whatsAppAccount.create({
    data: {
      tenantId,
      ...input,
      qualityRating: validation.qualityRating,
      status: "ACTIVE",
    },
    select: publicAccountSelect,
  });
}

export async function updateWhatsAppAccount(
  tenantId: string,
  id: string,
  data: { name?: string; status?: WhatsAppAccountStatus },
) {
  const updated = await prisma.whatsAppAccount.updateMany({
    where: { id, tenantId },
    data,
  });

  if (!updated.count) {
    return null;
  }

  return prisma.whatsAppAccount.findFirst({
    where: { id, tenantId },
    select: publicAccountSelect,
  });
}

export async function deleteWhatsAppAccount(tenantId: string, id: string) {
  const deleted = await prisma.whatsAppAccount.deleteMany({
    where: { id, tenantId },
  });

  return deleted.count > 0;
}
