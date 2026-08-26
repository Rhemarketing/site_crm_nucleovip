import { Prisma } from "@prisma/client";

export const contactInclude = {
  contactTags: {
    select: { tag: { select: { id: true, name: true, color: true } } },
  },
  _count: { select: { conversations: true } },
} satisfies Prisma.ContactInclude;

export function buildContactWhere(
  tenantId: string,
  searchParams: URLSearchParams,
): Prisma.ContactWhereInput {
  const search = searchParams.get("search")?.trim();
  const tagIds = (searchParams.get("tagIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(tagIds.length
      ? { contactTags: { some: { tagId: { in: tagIds } } } }
      : {}),
  };
}
