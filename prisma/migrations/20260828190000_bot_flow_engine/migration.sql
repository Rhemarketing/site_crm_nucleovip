ALTER TABLE "Conversation"
  ADD COLUMN "botActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "currentBotFlowId" TEXT,
  ADD COLUMN "currentNodeId" TEXT,
  ADD COLUMN "botContext" JSONB;

CREATE INDEX "Conversation_currentBotFlowId_idx" ON "Conversation"("currentBotFlowId");

CREATE UNIQUE INDEX "BotFlow_id_tenantId_key" ON "BotFlow"("id", "tenantId");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_currentBotFlowId_tenantId_fkey"
  FOREIGN KEY ("currentBotFlowId", "tenantId") REFERENCES "BotFlow"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
