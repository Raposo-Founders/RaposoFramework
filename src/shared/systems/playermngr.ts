import { Players, RunService } from "@rbxts/services";
import { registerConsoleFunction } from "shared/cmd/cvar";
import conch from "shared/conch_pkg";
import { Type, VarargType } from "shared/conch_pkg/conch";
import { defaultEnvironments } from "shared/defaultinsts";
import PlayerEntity, { PlayerTeam } from "shared/entities/PlayerEntity";
import { gameValues } from "shared/gamevalues";
import { finishDirectMessage, startDirectMessage } from "shared/network";
import { getPlayermodelFromEntity } from "shared/playermodel";
import ServerInstance from "shared/serverinst";
import { BufferReader } from "shared/util/bufferreader";
import { writeBufferString, writeBufferU8 } from "shared/util/bufferwriter";
import { getLocalPlayerEntity } from "shared/util/localent";
import { DoesInstanceExist } from "shared/util/utilfuncs";

// # Constants & variables
const TARGET_GROUP = 7203437 as const;
const ADMIN_ROLES: string[] = [
  "HOLDER",
  "PRESIDENT",
  "DIRECTOR",
  "COMMANDER",
  "WARDEN",
  "DEVELOPER",
  "CAPTAIN",
  "SERGEANT",
] as const;

// # Functions

// # Execution
ServerInstance.serverCreated.Connect(inst => {
  inst.playerJoined.Connect((user, referenceId) => {
    user.SetAttribute(gameValues.adminattr, ADMIN_ROLES.includes(user.GetRoleInGroup(TARGET_GROUP).upper()));
    user.SetAttribute(gameValues.modattr, user.GetAttribute(gameValues.adminattr));

    inst.entity.createEntity("SwordPlayerEntity", `PlayerEnt_${user.UserId}`, referenceId, user.UserId).andThen(ent => {
      print(`Player entity created for user ${user.Name} with ID ${ent.id}.`);

      task.wait(2);

      ent.Spawn(new CFrame(0, 100, 0));
    });
  });

  inst.network.listenPacket("team", (sender, bfr) => {
    if (!sender || !sender.GetAttribute(gameValues.modattr)) return;

    const reader = BufferReader(bfr);
    const entityId = reader.string();
    const team = reader.u8();

    const targetEntity = inst.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("PlayerEntity")) {
      startDirectMessage(gameValues.cmdnetinfo, sender);
      writeBufferString(`Invalid player entity ${entityId}`);
      finishDirectMessage();

      return;
    }

    // Check to see if the sender is just someone with tempmod
    if (!sender.GetAttribute(gameValues.adminattr) && sender.GetAttribute(gameValues.modattr)) {

      // Block the action if the target player is from the defenders team
      if (targetEntity.team === PlayerTeam.Defenders) {
        startDirectMessage(gameValues.cmdnetinfo, sender);
        // writeBufferString("Moderators can't switch players off the Defenders team."); // Formal?
        writeBufferString("Moderators can't mess with the Defenders' team."); // :)
        finishDirectMessage();

        return;
      }
    }

    targetEntity.team = team;
    targetEntity.Spawn();

    startDirectMessage(gameValues.cmdnetinfo, sender);
    writeBufferString(`Changed ${targetEntity.GetUserFromController()}'s team to ${PlayerTeam[team]}.`);
    finishDirectMessage();
  });
});

registerConsoleFunction(["team"], [conch.args.player(), conch.args.string()], "Changes a player's team")((ctx, user, team) => {
  let targetEntity: PlayerEntity | undefined;
  for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("PlayerEntity")) {
    if (ent.GetUserFromController() !== user) continue;
    targetEntity = ent;
    break;
  }
  assert(targetEntity, "Player has no entity.");

  let targetTeamId = PlayerTeam.Spectators;

  if (("defenders").match((team as string).lower())[0]) targetTeamId = PlayerTeam.Defenders;
  if (("raiders").match((team as string).lower())[0]) targetTeamId = PlayerTeam.Raiders;
  if (("spectators").match((team as string).lower())[0]) targetTeamId = PlayerTeam.Spectators;

  defaultEnvironments.network.startWritingMessage("team");
  writeBufferString(targetEntity.id);
  writeBufferU8(targetTeamId);
  defaultEnvironments.network.finishWritingMessage();

  ctx.Reply("Finished executing.");
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
