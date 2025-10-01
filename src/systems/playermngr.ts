import { Players, RunService } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import { sendDirectPacket } from "network";
import { getPlayermodelFromEntity } from "playermodel";
import ServerInstance from "serverinst";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString, writeBufferU32, writeBufferU8 } from "util/bufferwriter";
import { getLocalPlayerEntity } from "util/localent";
import { DoesInstanceExist, RandomString } from "util/utilfuncs";

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
    user.SetAttribute(gameValues.adminattr, ADMIN_ROLES.includes(user.GetRoleInGroup(TARGET_GROUP).upper()) || RunService.IsStudio());
    user.SetAttribute(gameValues.modattr, user.GetAttribute(gameValues.adminattr));

    inst.entity.createEntity("SwordPlayerEntity", `PlayerEnt_${user.UserId}`, referenceId, user.UserId).andThen(ent => {
      print(`Player entity created for user ${user.Name} with ID ${ent.id}.`);

      ent.died.Connect(() => {
        task.wait(Players.RespawnTime);
        ent.Spawn();
      });

      task.wait(2);

      ent.Spawn(new CFrame(0, 5, 0));
    });

    if (RunService.IsStudio()) {
      task.wait(2);
      inst.entity.createEntity("SwordPlayerEntity", undefined, RandomString(3), user.UserId).andThen(ent => {

        ent.died.Connect(() => {
          task.wait(Players.RespawnTime);
          ent.Spawn(ent.origin);
        });

        ent.team = PlayerTeam.Raiders;
        ent.Spawn(new CFrame(0, 5, 0));
      });
    }
  });

  inst.network.listenPacket("team", (packet) => {
    if (!packet.sender || !packet.sender.GetAttribute(gameValues.modattr)) return;

    const reader = BufferReader(packet.content);
    const entityId = reader.string();
    const team = reader.u8();

    const targetEntity = inst.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("PlayerEntity")) {
      startBufferCreation();
      writeBufferString(`Invalid player entity ${entityId}`);
      sendDirectPacket(gameValues.cmdnetinfo, packet.sender);

      return;
    }

    // Check to see if the sender is just someone with tempmod
    if (!packet.sender.GetAttribute(gameValues.adminattr) || team === PlayerTeam.Defenders) {

      // Block the action if the target player is from the defenders team
      if (targetEntity.team === PlayerTeam.Defenders) {
        startBufferCreation();
        // writeBufferString("Moderators can't switch players off the Defenders team."); // Formal?
        writeBufferString("Moderators can't mess with the Defenders' team."); // :)
        sendDirectPacket(gameValues.cmdnetinfo, packet.sender);

        return;
      }
    }

    targetEntity.team = team;
    targetEntity.Spawn();

    startBufferCreation();
    writeBufferString(`Changed ${targetEntity.GetUserFromController()}'s team to ${PlayerTeam[team]}.`);
    sendDirectPacket(gameValues.cmdnetinfo, packet.sender);
  });

  inst.network.listenPacket("damage", (packet) => {
    if (!packet.sender || !packet.sender.GetAttribute(gameValues.modattr)) return;

    const reader = BufferReader(packet.content);
    const entityId = reader.string();
    const amount = reader.u32();

    const targetEntity = inst.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("PlayerEntity")) {
      startBufferCreation();
      writeBufferString(`Invalid player entity ${entityId}`);
      sendDirectPacket(gameValues.cmdnetinfo, packet.sender);

      return;
    }

    // Check to see if the sender is just someone with tempmod
    if (!packet.sender.GetAttribute(gameValues.adminattr)) {

      // Block the action if the target player is from the defenders team
      if (targetEntity.team === PlayerTeam.Defenders) {
        startBufferCreation();
        // writeBufferString("Moderators can't switch players off the Defenders team."); // Formal?
        writeBufferString("Moderators can't mess with the Defenders' team."); // :)
        sendDirectPacket(gameValues.cmdnetinfo, packet.sender);

        return;
      }
    }

    targetEntity.takeDamage(amount);

    startBufferCreation();
    writeBufferString(`Damaged ${targetEntity.GetUserFromController()} by ${amount} points.`);
    sendDirectPacket(gameValues.cmdnetinfo, packet.sender);
  });
});

new ConsoleFunctionCallback(["team"], [{ name: "player", type: "player" }, { name: "team", type: "team" }])
  .setDescription("Changes a player's team")
  .setCallback((ctx) => {
    const playerEntity = ctx.getArgument("player", "player").value[0];
    const team = ctx.getArgument("team", "team").value;

    assert(playerEntity, `Invalid player entity.`);

    startBufferCreation();
    writeBufferString(playerEntity.id);
    writeBufferU8(PlayerTeam[team]);
    defaultEnvironments.network.sendPacket("team");
  });

new ConsoleFunctionCallback(["damage", "dmg"], [{ name: "player", type: "player" }, { name: "amount", type: "number" }])
  .setDescription("Damages a player")
  .setCallback((ctx) => {
    const targetEntity = ctx.getArgument("player", "player").value;
    const amount = ctx.getArgument("amount", "number").value;

    assert(targetEntity[0], "Invalid player entity.");

    startBufferCreation();
    writeBufferString(targetEntity[0].id);
    writeBufferU32(amount as number);
    defaultEnvironments.network.sendPacket("damage");
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
