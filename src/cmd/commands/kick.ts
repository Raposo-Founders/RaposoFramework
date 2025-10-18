import { defendersCommandCheck } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ServerInstance from "serverinst";
import ChatSystem from "systems/ChatSystem";
import { colorTable } from "UI/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_kick";

// # Bindings & execution

ServerInstance.serverCreated.Connect(inst => {
  inst.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !info.sender.GetAttribute(gameValues.modattr)) return;

    const reader = BufferReader(info.content);
    const entityId = reader.string();
    const reason = reader.string();

    // TODO: Properly make this command only available for admins
    if (!info.sender.GetAttribute(gameValues.adminattr)) {
      ChatSystem.sendSystemMessage("Players cannot be kicked by temporary moderators.");
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
      ChatSystem.sendSystemMessage(`Invalid player entity ${entityId}`, [info.sender]);
      return;
    }

    if (!defendersCommandCheck(callerEntity, targetEntity)) {
      ChatSystem.sendSystemMessage(gameValues.cmdtempmoddefendersdeny);
      return;
    }

    // Send kick message to all players
    ChatSystem.sendSystemMessage(`Kicked ${targetEntity.GetUserFromController()} (${targetEntity.id}): ${reason}`);

    {
      const targetEntityController = targetEntity.GetUserFromController();

      if (targetEntityController)
        inst.RemovePlayer(targetEntityController, `Kicked by administrator.\n\n${info.sender.Name}: ${reason}.`);
      else
        inst.entity.killThisFucker(targetEntity);
    }
  });
}); 

new ConsoleFunctionCallback(["kick"], [{ name: "player", type: "player" }, { name: "reason", type: "strings" }])
  .setDescription("Kicks a player from the current session")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;
    const reason = ctx.getArgument("reason", "strings").value;

    if (targetPlayers.size() <= 0) {
      ChatSystem.sendSystemMessage(`<b><font color="${colorTable.errorneousColor}">Argument #1 unknown player.</font></b>`);
      return;
    }

    for (const ent of targetPlayers) {
      startBufferCreation();
      writeBufferString(ent.id);
      writeBufferString(reason.join(" "));
      defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
    }
  });