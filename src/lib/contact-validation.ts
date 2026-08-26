export type ContactInput = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  avatarUrl?: unknown;
  customFields?: unknown;
};

export class ContactValidationError extends Error {}

export function normalizePhone(value: unknown, defaultCountryCode = "55") {
  const digits = String(value ?? "").replace(/\D/g, "");
  const withCountryCode =
    digits.length === 10 || digits.length === 11
      ? `${defaultCountryCode}${digits}`
      : digits;

  if (withCountryCode.length < 12 || withCountryCode.length > 15) {
    throw new ContactValidationError(
      "Telefone invalido. Informe DDI, DDD e numero (12 a 15 digitos).",
    );
  }

  return withCountryCode;
}

export function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) return null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ContactValidationError("Email invalido.");
  }

  return email;
}

export function parseContactInput(input: ContactInput) {
  const name = String(input.name ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    throw new ContactValidationError("O nome deve ter entre 2 e 120 caracteres.");
  }

  const avatarUrl = String(input.avatarUrl ?? "").trim() || null;
  if (avatarUrl) {
    try {
      new URL(avatarUrl);
    } catch {
      throw new ContactValidationError("avatarUrl deve ser uma URL valida.");
    }
  }

  if (
    input.customFields !== undefined &&
    input.customFields !== null &&
    (typeof input.customFields !== "object" || Array.isArray(input.customFields))
  ) {
    throw new ContactValidationError("customFields deve ser um objeto JSON.");
  }

  return {
    name,
    phone: normalizePhone(input.phone),
    email: normalizeEmail(input.email),
    avatarUrl,
    customFields: input.customFields ?? undefined,
  };
}

export function sanitizeSpreadsheetCell(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
