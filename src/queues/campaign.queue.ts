import { Queue } from "bullmq";

import { redis } from "@/lib/redis";

export const CAMPAIGN_QUEUE_NAME = "campaign-dispatch-queue";

export type CampaignJobData = {
  campaignId: string;
};

let campaignQueue: Queue<CampaignJobData> | undefined;

export function getCampaignQueue() {
  campaignQueue ??= new Queue<CampaignJobData>(CAMPAIGN_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });

  return campaignQueue;
}

export async function addCampaignToQueue(
  campaignId: string,
  delayMs = 0,
) {
  return getCampaignQueue().add(
    "dispatch-campaign",
    { campaignId },
    {
      jobId: campaignId,
      delay: Math.max(0, Math.floor(delayMs)),
    },
  );
}
