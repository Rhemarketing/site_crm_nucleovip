export type MetaWebhookContact = {
  wa_id?: string;
  profile?: { name?: string };
};

export type MetaWebhookMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; sha256?: string; caption?: string };
  audio?: { id?: string; mime_type?: string; sha256?: string; voice?: boolean };
  document?: {
    id?: string;
    mime_type?: string;
    sha256?: string;
    filename?: string;
    caption?: string;
  };
  interactive?: Record<string, unknown>;
  button?: Record<string, unknown>;
  [key: string]: unknown;
};

export type MetaWebhookStatus = {
  id?: string;
  status?: "sent" | "delivered" | "read" | "failed" | string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type MetaWebhookValue = {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: MetaWebhookContact[];
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
};

export type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: MetaWebhookValue;
    }>;
  }>;
};

export function getWebhookPhoneNumberIds(payload: MetaWebhookPayload) {
  const ids = new Set<string>();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (phoneNumberId) ids.add(phoneNumberId);
    }
  }

  return [...ids];
}
