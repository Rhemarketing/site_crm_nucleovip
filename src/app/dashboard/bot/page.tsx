import { Bot } from "lucide-react";

import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function BotPage() {
  return (
    <ComingSoon
      icon={Bot}
      title="Automações e Bot"
      description="Construa fluxos automáticos e respostas inteligentes para sua operação de atendimento."
    />
  );
}
