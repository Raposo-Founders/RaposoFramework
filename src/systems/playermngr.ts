import { LocalizationService, Players, RunService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import { getPlayermodelFromEntity } from "playermodel";
import ServerInstance from "serverinst";
import { getLocalPlayerEntity } from "util/localent";
import { DoesInstanceExist } from "util/utilfuncs";

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

    inst.entity.createEntity("SwordPlayerEntity", `PlayerEnt_${user.UserId}`, referenceId, user.UserId).andThen(ent => {
      ent.died.Connect(() => {
        task.wait(Players.RespawnTime);
        ent.Spawn();
      });

      ent.stats.country = LocalizationService.GetCountryRegionForPlayerAsync(user);

      task.wait(2);

      ent.Spawn(new CFrame(0, 5, 0));
    });
  });

  inst.playerLeft.Connect(user => {
    const userSessionId = user.GetAttribute(gameValues.usersessionid);

    for (const ent of inst.entity.getEntitiesThatIsA("PlayerEntity")) {
      if (ent.controller !== userSessionId) continue;
      inst.entity.killThisFucker(ent);
    }
  });

  // Update players ping
  let nextPingUpdateTime = 0;
  inst.lifecycle.BindTickrate(() => {
    const currentTime = 0;
    if (currentTime < nextPingUpdateTime) return;
    nextPingUpdateTime = currentTime + 5;

    for (const user of inst.entity.getEntitiesThatIsA("PlayerEntity")) {
      const controller = user.GetUserFromController();
      if (!controller) continue;

      user.stats.ping = math.floor(controller.GetNetworkPing() * 1000);
    }
  });
});

if (RunService.IsClient()) {
  defaultEnvironments.entity.entityCreated.Connect(ent => {
    if (!ent.IsA("PlayerEntity")) return;

    let playermodel = getPlayermodelFromEntity(ent.id);
    while (!playermodel) {
      task.wait(1);
      playermodel = getPlayermodelFromEntity(ent.id);

      if (playermodel)
        break;
    }

    let controller: Player | undefined;
    let totalAttempts = 0;

    while (!controller) {
      totalAttempts++;
      if (totalAttempts >= 10) {
        controller = ent.GetUserFromController();
        print("Controller fetching timed out.", controller);
        break;
      }

      controller = ent.GetUserFromController();
      if (controller !== Players.LocalPlayer) controller = undefined;

      defaultEnvironments.lifecycle.YieldForTicks(1);
    }
    if (controller !== Players.LocalPlayer) return;

    workspace.CurrentCamera!.CameraSubject = playermodel.rig.Humanoid;
    workspace.CurrentCamera!.CameraType = Enum.CameraType.Custom;
    Players.LocalPlayer.Character = playermodel.rig;
  });

  defaultEnvironments.lifecycle.BindUpdate(() => {
    const entity = getLocalPlayerEntity(defaultEnvironments.entity);
    const playermodel = entity ? getPlayermodelFromEntity(entity.id) : undefined;
    if (!entity || !entity.IsA("SwordPlayerEntity") || !playermodel || !DoesInstanceExist(playermodel.rig)) return;
    if (entity.health <= 0) return;

    entity.origin = playermodel.GetPivot();
    entity.velocity = playermodel.rig.PrimaryPart?.AssemblyLinearVelocity ?? new Vector3();
    entity.grounded = playermodel.rig.Humanoid.FloorMaterial.Name !== "Air";
  });
}
