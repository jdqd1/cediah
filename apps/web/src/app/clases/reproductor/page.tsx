import { PlayerScreen } from "@/components/player-screen";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export default async function PlayerPage() {
  return <PlayerScreen isAdministrator={await currentUserIsAdministrator()} />;
}
