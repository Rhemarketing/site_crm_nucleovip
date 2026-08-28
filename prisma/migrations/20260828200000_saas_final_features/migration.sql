ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Conversation"
  ADD COLUMN "pipelineStageId" TEXT,
  ADD COLUMN "pipelineOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PipelineStage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuickReply" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "shortcut" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "mediaUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantSettings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessHours" JSONB NOT NULL,
  "outOfOfficeMessage" TEXT,
  "isOutOfOfficeActive" BOOLEAN NOT NULL DEFAULT false,
  "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PipelineStage_id_tenantId_key" ON "PipelineStage"("id", "tenantId");
CREATE UNIQUE INDEX "PipelineStage_tenantId_name_key" ON "PipelineStage"("tenantId", "name");
CREATE INDEX "PipelineStage_tenantId_order_idx" ON "PipelineStage"("tenantId", "order");
CREATE UNIQUE INDEX "QuickReply_tenantId_shortcut_key" ON "QuickReply"("tenantId", "shortcut");
CREATE INDEX "QuickReply_tenantId_idx" ON "QuickReply"("tenantId");
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");
CREATE INDEX "TenantSettings_tenantId_idx" ON "TenantSettings"("tenantId");
CREATE INDEX "Conversation_pipelineStageId_pipelineOrder_idx" ON "Conversation"("pipelineStageId", "pipelineOrder");

ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_pipelineStageId_tenantId_fkey" FOREIGN KEY ("pipelineStageId", "tenantId") REFERENCES "PipelineStage"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
