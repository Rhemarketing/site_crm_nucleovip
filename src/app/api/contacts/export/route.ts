import Papa from "papaparse";

import { requireCurrentUser } from "@/lib/auth";
import { buildContactWhere } from "@/lib/contact-query";
import { sanitizeSpreadsheetCell } from "@/lib/contact-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const contacts = await prisma.contact.findMany({
    where: buildContactWhere(session.tenantId, searchParams),
    include: { contactTags: { include: { tag: { select: { name: true } } } } },
    orderBy: { name: "asc" },
  });
  const csv = Papa.unparse(
    contacts.map((contact) => ({
      nome: sanitizeSpreadsheetCell(contact.name),
      telefone: sanitizeSpreadsheetCell(contact.phone),
      email: sanitizeSpreadsheetCell(contact.email),
      etiquetas: sanitizeSpreadsheetCell(contact.contactTags.map(({ tag }) => tag.name).join("; ")),
      criado_em: contact.createdAt.toISOString(),
    })),
  );

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contatos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
