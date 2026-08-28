import type { CampaignStatus } from "@prisma/client";

export type CampaignProgressSource = {
  id: string;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
};

export function getCampaignPercentage(campaign: CampaignProgressSource) {
  if (!campaign.totalRecipients) return 0;
  return Math.min(
    100,
    Math.round(
      ((campaign.sentCount + campaign.failedCount) /
        campaign.totalRecipients) *
        100,
    ),
  );
}

export function serializeCampaign<T extends CampaignProgressSource>(campaign: T) {
  return {
    ...campaign,
    percentage: getCampaignPercentage(campaign),
  };
}
