import { defendersCommandCheck } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ServerInstance from "serverinst";
import { sendSystemChatMessage } from "systems/ChatSystem";
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
      sendSystemChatMessage("Players cannot be kicked by temporary moderators.", [info.sender]);
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

    // Send kick message to all players
    sendSystemChatMessage(`Kicked ${targetEntity.GetUserFromController()} (${targetEntity.id}): ${reason}`);

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

    assert(targetPlayers.size() > 0, `Invalid player entity.`);

    for (const ent of targetPlayers) {
      startBufferCreation();
      writeBufferString(ent.id);
      writeBufferString(reason.join(" "));
      defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
    }
  });