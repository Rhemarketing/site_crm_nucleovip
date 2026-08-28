ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE "CampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

ALTER TABLE "Campaign"
  ADD COLUMN "tagIds" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "variableMappings" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "cancelRequestedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Campaign" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE UNIQUE INDEX "Campaign_id_tenantId_key" ON "Campaign"("id", "tenantId");

CREATE TABLE "CampaignRecipient" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "conversationId" TEXT,
  "messageId" TEXT,
  "phone" TEXT NOT NULL,
  "status" "CampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignRecipient_messageId_key" ON "CampaignRecipient"("messageId");
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_contactId_key" ON "CampaignRecipient"("campaignId", "contactId");
CREATE INDEX "CampaignRecipient_tenantId_idx" ON "CampaignRecipient"("tenantId");
CREATE INDEX "CampaignRecipient_campaignId_status_idx" ON "CampaignRecipient"("campaignId", "status");
CREATE INDEX "CampaignRecipient_contactId_idx" ON "CampaignRecipient"("contactId");
CREATE INDEX "CampaignRecipient_messageId_idx" ON "CampaignRecipient"("messageId");

ALTER TABLE "CampaignRecipient"
  ADD CONSTRAINT "CampaignRecipient_campaignId_tenantId_fkey"
  FOREIGN KEY ("campaignId", "tenantId") REFERENCES "Campaign"("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignRecipient"
  ADD CONSTRAINT "CampaignRecipient_contactId_tenantId_fkey"
  FOREIGN KEY ("contactId", "tenantId") REFERENCES "Contact"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
