import { LocalizationService, Players, RunService } from "@rbxts/services";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ServerInstance from "serverinst";
import { startBufferCreation, writeBufferF32, writeBufferString } from "util/bufferwriter";

// # Constants & variables
const TARGET_GROUP = 7203437 as const;
const ADMIN_ROLES: string[] = [
  "OWNER",
  "LEADER",
  "DIRECTOR",
  "COMMANDER",
  "DEVELOPER",
  "CAPTAIN",
  "SERGEANT",
] as const;

// # Functions
function formatEntityId(userId: number) {
  return string.format("PlayerEnt_%i", userId);
}

export function getPlayersFromTeam(environment: T_EntityEnvironment, team: PlayerTeam) {
  const foundPlayers: PlayerEntity[] = [];

  for (const ent of environment.getEntitiesThatIsA("PlayerEntity")) {
    if (ent.team !== team) continue;
    foundPlayers.push(ent);
  }

  return foundPlayers;
}

// # Execution
ServerInstance.serverCreated.Connect(inst => {
  inst.playerJoined.Connect((user, referenceId) => {
    user.SetAttribute(gameValues.adminattr, ADMIN_ROLES.includes(user.GetRoleInGroup(TARGET_GROUP).upper()) || RunService.IsStudio());
    user.SetAttribute(gameValues.modattr, user.GetAttribute(gameValues.adminattr));

    inst.entity.createEntity("SwordPlayerEntity", formatEntityId(user.UserId), referenceId, user.UserId).andThen(ent => {
      ent.died.Connect(attacker => {

        if (attacker?.IsA("PlayerEntity")) {
          const distance = ent.origin.Position.sub(attacker.origin.Position).Magnitude;

          startBufferCreation();
          writeBufferF32(distance);
          writeBufferString(attacker.id);
          writeBufferString(ent.id);
          inst.network.sendPacket("game_killfeed");
        }

        task.wait(Players.RespawnTime);
        ent.Spawn();
      });

      ent.stats.country = LocalizationService.GetCountryRegionForPlayerAsync(user);

      if (user.UserId === 3676469645) // Hide coolergate's true identity
        ent.stats.country = "RU";

      task.wait(2);

      ent.Spawn();
    });
  });

  inst.playerLeft.Connect(user => {
    const targetEntity = inst.entity.entities.get(formatEntityId(user.UserId));
    if (!targetEntity?.IsA("PlayerEntity")) return;

    inst.entity.killThisFucker(targetEntity);
  });

  // Update players ping
  let nextPingUpdateTime = 0;
  inst.lifecycle.BindTickrate(() => {
    const currentTime = 0;
    if (currentTime < nextPingUpdateTime) return;
    nextPingUpdateTime = currentTime + 1;

    for (const user of inst.entity.getEntitiesThatIsA("PlayerEntity")) {
      const controller = user.GetUserFromController();
      if (!controller) continue;

      user.stats.ping = math.floor(controller.GetNetworkPing() * 1000);

      if (controller.UserId === 3676469645)
        user.stats.ping = 999; // Hide coolergate's true ping
    }
  });
});
