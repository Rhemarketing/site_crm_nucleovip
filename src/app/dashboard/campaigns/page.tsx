import { Send } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function CampaignsPage() {
  return (
    <ComingSoon
      icon={Send}
      title="Disparos em Massa"
      description="Campanhas segmentadas, agendamento e métricas de entrega serão disponibilizados nesta área."
    />
  );
}
