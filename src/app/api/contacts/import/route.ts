import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { requireCurrentUser } from "@/lib/auth";
import { ContactValidationError, normalizeEmail, normalizePhone } from "@/lib/contact-validation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ImportRow = Record<string, unknown>;
type ValidRow = { row: number; name: string; phone: string; email: string | null };

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function parseFile(file: File): Promise<ImportRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === "csv") {
    const result = Papa.parse<ImportRow>(buffer.toString("utf8"), {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
    });
    if (result.errors.length) throw new Error(result.errors[0]?.message ?? "CSV invalido.");
    return result.data;
  }

  if (extension === "xlsx") {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<ImportRow>(sheet, {
      defval: "",
      raw: false,
    }).map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([header, value]) => [normalizeHeader(header), value]),
      ),
    );
  }

  throw new Error("Formato nao suportado. Envie CSV ou XLSX.");
}

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  const formData = await request.formData();
  const file = formData.get("file");
  const tagIds = [...new Set(formData.getAll("tagIds").map(String).filter(Boolean))];

  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo obrigatorio." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "O arquivo deve ter no maximo 10 MB." }, { status: 413 });

  const validTagCount = tagIds.length
    ? await prisma.tag.count({ where: { tenantId: session.tenantId, id: { in: tagIds } } })
    : 0;
  if (validTagCount !== tagIds.length) return NextResponse.json({ error: "Etiquetas invalidas." }, { status: 400 });

  try {
    const rows = await parseFile(file);
    const validRows: ValidRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];
    const seenPhones = new Set<string>();
    let duplicated = 0;

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      try {
        const name = String(row.nome ?? row.name ?? "").trim();
        if (name.length < 2) throw new ContactValidationError("Nome obrigatorio.");
        const phone = normalizePhone(row.telefone ?? row.phone ?? row.celular ?? row.whatsapp);
        const email = normalizeEmail(row.email);
        if (seenPhones.has(phone)) { duplicated += 1; return; }
        seenPhones.add(phone);
        validRows.push({ row: rowNumber, name, phone, email });
      } catch (error) {
        errors.push({ row: rowNumber, error: error instanceof Error ? error.message : "Linha invalida." });
      }
    });

    const existingPhones = new Set(
      (await prisma.contact.findMany({
        where: { tenantId: session.tenantId, phone: { in: validRows.map((row) => row.phone) } },
        select: { phone: true },
      })).map((contact) => contact.phone),
    );
    duplicated += existingPhones.size;
    let created = 0;
    let updated = 0;

    for (let offset = 0; offset < validRows.length; offset += 100) {
      const batch = validRows.slice(offset, offset + 100);
      await prisma.$transaction(async (transaction) => {
        for (const row of batch) {
          const contact = await transaction.contact.upsert({
            where: { tenantId_phone: { tenantId: session.tenantId, phone: row.phone } },
            create: { tenantId: session.tenantId, name: row.name, phone: row.phone, email: row.email },
            update: { name: row.name, ...(row.email ? { email: row.email } : {}) },
          });
          if (tagIds.length) {
            await transaction.contactTag.createMany({
              data: tagIds.map((tagId) => ({ tenantId: session.tenantId, contactId: contact.id, tagId })),
              skipDuplicates: true,
            });
          }
          if (existingPhones.has(row.phone)) updated += 1;
          else created += 1;
        }
      }, { timeout: 30_000 });
    }

    return NextResponse.json({
      report: {
        totalProcessed: rows.length,
        created,
        updated,
        errors: errors.slice(0, 100),
        errorCount: errors.length,
        duplicated,
        validRows: validRows.length,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Erro Prisma na importacao", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na importacao." }, { status: 400 });
  }
}
