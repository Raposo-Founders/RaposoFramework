import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import { sendDirectPacket } from "network";
import ServerInstance from "serverinst";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString, writeBufferU8 } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_team";

// # Bindings & execution

ServerInstance.serverCreated.Connect(inst => {
  inst.network.listenPacket(CMD_INDEX_NAME, (packet) => {
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
});

new ConsoleFunctionCallback(["team"], [{ name: "player", type: "player" }, { name: "team", type: "team" }])
  .setDescription("Changes a player's team")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;
    const team = ctx.getArgument("team", "team").value;

    assert(targetPlayers.size() > 0, `Invalid player entity.`);

    for (const ent of targetPlayers) {
      startBufferCreation();
      writeBufferString(ent.id);
      writeBufferU8(PlayerTeam[team]);
      defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
    }
  });