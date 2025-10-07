import { defendersCommandCheck, writePlayerReply } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ServerInstance from "serverinst";
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
      writePlayerReply(info.sender, `Invalid player entity ${entityId}`);
      return;
    }

    const controller = targetEntity.GetUserFromController();
    if (!controller) {
      writePlayerReply(info.sender, `PlayerEntity ${targetEntity.id} has no controller.`);
      return;
    }

    controller.SetAttribute(gameValues.modattr, true);

    writePlayerReply(info.sender, `Gave ${targetEntity.GetUserFromController()} temporary moderation privileges.`);
  });
}); 

new ConsoleFunctionCallback(["resetstats", "rs"], [{ name: "player", type: "player" }])
  .setDescription("Resets a player's stats")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;

    assert(targetPlayers.size() > 0, `Invalid player entity.`);

    for (const ent of targetPlayers) {
      startBufferCreation();
      writeBufferString(ent.id);
      defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
    }
  });