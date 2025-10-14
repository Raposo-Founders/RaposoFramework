import { defendersCommandCheck } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ServerInstance from "serverinst";
import { sendSystemChatMessage } from "systems/ChatSystem";
import { colorTable } from "UI/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_resetstats";

// # Bindings & execution

ServerInstance.serverCreated.Connect(inst => {
  inst.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !info.sender.GetAttribute(gameValues.modattr)) return;

    const reader = BufferReader(info.content);
    const entityId = reader.string();

    // TODO: Make this an integrated UI interface for requesting stats resetting
    if (!info.sender.GetAttribute(gameValues.adminattr)) {
      sendSystemChatMessage("The stats you have is what you get. (blame coolergate :P)", [info.sender]);
      return;
    }

    let callerEntity: PlayerEntity | undefined;
    for (const ent of inst.entity.getEntitiesThatIsA("PlayerEntity")) {
      if (ent.GetUserFromController() !== info.sender) continue;
      callerEntity = ent;
      break;
    }
    if (!callerEntity) return;

    const targetEntity = inst.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("PlayerEntity")) {
      sendSystemChatMessage(`Invalid player entity ${entityId}`, [info.sender]);
      return;
    }

    if (!defendersCommandCheck(callerEntity, targetEntity)) {
      sendSystemChatMessage(gameValues.cmdtempmoddefendersdeny, [info.sender]);
      return;
    }

    targetEntity.stats.kills = 0;
    targetEntity.stats.damage = 0;
    targetEntity.stats.deaths = 0;

    sendSystemChatMessage(`Reset ${targetEntity.GetUserFromController()}'s (${targetEntity.id}) stats.`); // All players
  });
}); 

new ConsoleFunctionCallback(["resetstats", "rs"], [{ name: "player", type: "player" }])
  .setDescription("Resets a player's stats")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;

    if (targetPlayers.size() <= 0) {
      sendSystemChatMessage(`<b><font color="${colorTable.errorneousColor}">Argument #1 unknown player.</font></b>`);
      return;
    }

    for (const ent of targetPlayers) {
      startBufferCreation();
      writeBufferString(ent.id);
      defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
    }
  });