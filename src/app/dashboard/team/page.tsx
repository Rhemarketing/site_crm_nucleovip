import { TeamManager } from "@/components/team/team-manager";
import { requireCurrentUser } from "@/lib/auth";

export default async function TeamPage() {
  const session = await requireCurrentUser();
  return (
    <TeamManager
      currentUserId={session.userId}
      canEdit={session.role === "ADMIN"}
    />
  );
}
