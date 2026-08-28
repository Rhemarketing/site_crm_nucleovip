import { FlowEditor } from "@/components/bot/flow-editor";

type PageProps = { params: Promise<{ id: string }> };

export default async function BotFlowEditorPage({ params }: PageProps) {
  const { id } = await params;
  return <FlowEditor flowId={id} />;
}
