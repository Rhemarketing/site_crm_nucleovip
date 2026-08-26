type ContactWithRelations = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  customFields: unknown;
  createdAt: Date;
  updatedAt: Date;
  contactTags: Array<{ tag: { id: string; name: string; color: string } }>;
  _count: { conversations: number };
};

export function serializeContact(contact: ContactWithRelations) {
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    avatarUrl: contact.avatarUrl,
    customFields: contact.customFields,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
    tags: contact.contactTags.map(({ tag }) => tag),
    conversationCount: contact._count.conversations,
  };
}
