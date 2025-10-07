import { defendersCommandCheck, writePlayerReply } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import { sendDirectPacket } from "network";
import ServerInstance from "serverinst";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString, writeBufferU32 } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_damage";

// # Bindings & execution

ServerInstance.serverCreated.Connect(inst => {
  inst.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !info.sender.GetAttribute(gameValues.modattr)) return;

    const reader = BufferReader(info.content);
    const entityId = reader.string();
    const amount = reader.u32();

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

    // Check to see if the sender is just someone with tempmod
    if (!defendersCommandCheck(callerEntity, targetEntity)) {
      writePlayerReply(info.sender, gameValues.cmdtempmoddefendersdeny);
      return;
    }

    targetEntity.takeDamage(amount);

    startBufferCreation();
    writeBufferString(`Damaged ${targetEntity.GetUserFromController()} by ${amount} points.`);
    sendDirectPacket(gameValues.cmdnetinfo, info.sender);
  });
});

new ConsoleFunctionCallback(["damage", "dmg"], [{ name: "player", type: "player" }, { name: "amount", type: "number" }])
  .setDescription("Damages a player")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;
    const amount = ctx.getArgument("amount", "number").value;

    assert(targetPlayers[0], "Invalid player entity.");

    for (const ent of targetPlayers) {
      startBufferCreation();
      writeBufferString(ent.id);
      writeBufferU32(amount as number);
      defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
    }
  });