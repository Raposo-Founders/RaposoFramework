import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import { sendDirectPacket } from "network";
import ServerInstance from "serverinst";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString, writeBufferU32 } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_damage";

// # Bindings & execution

ServerInstance.serverCreated.Connect(inst => {
  inst.network.listenPacket(CMD_INDEX_NAME, (packet) => {
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

new ConsoleFunctionCallback(["damage", "dmg"], [{ name: "player", type: "player" }, { name: "amount", type: "number" }])
  .setDescription("Damages a player")
  .setCallback((ctx) => {
    const targetEntity = ctx.getArgument("player", "player").value;
    const amount = ctx.getArgument("amount", "number").value;

    assert(targetEntity[0], "Invalid player entity.");

    startBufferCreation();
    writeBufferString(targetEntity[0].id);
    writeBufferU32(amount as number);
    defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
  });