import { BusinessHoursSettings } from "@/components/settings/business-hours-settings";
import { requireCurrentUser } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await requireCurrentUser();
  return <BusinessHoursSettings canEdit={session.role === "ADMIN"} />;
}
