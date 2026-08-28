export type BusinessDay = {
  enabled: boolean;
  open: string;
  close: string;
};

export type BusinessHours = Record<string, BusinessDay>;

export const DEFAULT_BUSINESS_HOURS: BusinessHours = Object.fromEntries(
  Array.from({ length: 7 }, (_, day) => [
    String(day),
    { enabled: day >= 1 && day <= 5, open: "08:00", close: "18:00" },
  ]),
);

const WEEKDAY_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function parseBusinessHours(value: unknown): BusinessHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_BUSINESS_HOURS;
  }
  const input = value as Record<string, Partial<BusinessDay>>;
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, day) => {
      const key = String(day);
      const fallback = DEFAULT_BUSINESS_HOURS[key];
      const candidate = input[key];
      return [
        key,
        {
          enabled:
            typeof candidate?.enabled === "boolean"
              ? candidate.enabled
              : fallback.enabled,
          open: isValidTime(candidate?.open) ? candidate.open : fallback.open,
          close: isValidTime(candidate?.close)
            ? candidate.close
            : fallback.close,
        },
      ];
    }),
  );
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isWithinBusinessHours(
  value: unknown,
  timezone: string,
  date = new Date(),
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const local = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const day =
    parseBusinessHours(value)[String(WEEKDAY_NUMBER[local.weekday] ?? 0)];
  if (!day.enabled) return false;
  const current = Number(local.hour) * 60 + Number(local.minute);
  const opening = timeToMinutes(day.open);
  const closing = timeToMinutes(day.close);
  return closing >= opening
    ? current >= opening && current <= closing
    : current >= opening || current <= closing;
}
