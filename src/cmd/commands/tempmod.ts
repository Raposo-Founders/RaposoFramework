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
const CMD_INDEX_NAME = "cmd_tempmod";

// # Bindings & execution

ServerInstance.serverCreated.Connect(inst => {
  inst.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !info.sender.GetAttribute(gameValues.adminattr)) return;

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
      sendSystemChatMessage(`Invalid player entity ${entityId}`, [info.sender]);
      return;
    }

    const controller = targetEntity.GetUserFromController();
    if (!controller) {
      sendSystemChatMessage(`PlayerEntity ${targetEntity.id} has no controller.`, [info.sender]);
      return;
    }

    controller.SetAttribute(gameValues.modattr, true);

    sendSystemChatMessage(`Gave ${targetEntity.GetUserFromController()} temporary moderation privileges.`);
  });
}); 

new ConsoleFunctionCallback(["tempmod"], [{ name: "player", type: "player" }])
  .setDescription("Gives a player temporary moderation privileges")
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