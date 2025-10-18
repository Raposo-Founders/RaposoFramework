import { defendersCommandCheck } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import SessionInstance from "providers/SessionProvider";
import ChatSystem from "systems/ChatSystem";
import { colorTable } from "UI/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_spawn";

// # Bindings & execution

SessionInstance.sessionCreated.Connect(inst => {
  inst.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !info.sender.GetAttribute(gameValues.modattr)) return;

    const reader = BufferReader(info.content);
    const entityId = reader.string();

    let callerEntity: PlayerEntity | undefined;
    for (const ent of inst.entity.getEntitiesThatIsA("PlayerEntity")) {
      if (ent.GetUserFromController() !== info.sender) continue;
      callerEntity = ent;
      break;
    }
    if (!callerEntity) return;

    const targetEntity = inst.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("PlayerEntity")) {
      ChatSystem.sendSystemMessage(`Invalid player entity ${entityId}`, [info.sender]);
      return;
    }
    
    if (!defendersCommandCheck(callerEntity, targetEntity)) {
      ChatSystem.sendSystemMessage(gameValues.cmdtempmoddefendersdeny);
      return;
    }

    targetEntity.Spawn();

    ChatSystem.sendSystemMessage(`Spawned ${targetEntity.GetUserFromController()} (${targetEntity.id}).`);
  });
}); 

new ConsoleFunctionCallback(["spawn"], [{ name: "player", type: "player" }])
  .setDescription("Respawns a player(s)")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;

    if (targetPlayers.size() <= 0) {
      ChatSystem.sendSystemMessage(`<b><font color="${colorTable.errorneousColor}">Argument #1 unknown player.</font></b>`);
      return;
    }

    for (const ent of targetPlayers) {
      startBufferCreation();
      writeBufferString(ent.id);
      defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
    }
  });