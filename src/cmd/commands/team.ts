import { defendersCommandCheck, writePlayerReply } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import { sendDirectPacket } from "network";
import ServerInstance from "serverinst";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString, writeBufferU8 } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_team";

// # Bindings & execution

ServerInstance.serverCreated.Connect(inst => {
  inst.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !info.sender.GetAttribute(gameValues.modattr)) return;

    const reader = BufferReader(info.content);
    const entityId = reader.string();
    const team = reader.u8();

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

    // Prevent people with tempmod from messing with the defenders' team
    if (!info.sender.GetAttribute(gameValues.adminattr) && callerEntity.team !== PlayerTeam.Defenders) {
      if (team === PlayerTeam.Defenders || targetEntity.team === PlayerTeam.Defenders) {
        writePlayerReply(info.sender, gameValues.cmdtempmoddefendersdeny);
        return;
      }
    }

    targetEntity.team = team;
    targetEntity.Spawn();

    startBufferCreation();
    writeBufferString(`Changed ${targetEntity.GetUserFromController()}'s team to ${PlayerTeam[team]}.`);
    sendDirectPacket(gameValues.cmdnetinfo, info.sender);
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