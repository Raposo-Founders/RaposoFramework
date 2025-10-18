import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import { GetCreatorGroupInfo } from "providers/GroupsProvider";
import SessionInstance from "providers/SessionProvider";
import ChatSystem from "systems/ChatSystem";
import { getPlayersFromTeam } from "controllers/PlayerController";
import { colorTable } from "UI/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString, writeBufferU8 } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_team";

// # Bindings & execution

SessionInstance.sessionCreated.Connect(inst => {
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
      ChatSystem.sendSystemMessage(`Invalid player entity ${entityId}`, [info.sender]);
      return;
    }
    const targetController = targetEntity.GetUserFromController();

    // Prevent people with tempmod from messing with the defenders' team
    if (!info.sender.GetAttribute(gameValues.adminattr) && callerEntity.team !== PlayerTeam.Defenders) {
      if (team === PlayerTeam.Defenders || targetEntity.team === PlayerTeam.Defenders) {
        ChatSystem.sendSystemMessage(gameValues.cmdtempmoddefendersdeny);
        return;
      }
    }

    const creatorGroupInfo = GetCreatorGroupInfo();
    const raidingGroupId = tonumber(inst.attributes.raidingGroupId);

    if (targetController && creatorGroupInfo && raidingGroupId) {
      if (team === PlayerTeam.Defenders && !targetController.IsInGroup(creatorGroupInfo.groupInfo.Id)) {
        ChatSystem.sendSystemMessage(`Unable to team player: ${targetController} is not in the "${creatorGroupInfo.groupInfo.Name}" group.`);
        return;
      }

      if (team === PlayerTeam.Raiders && !targetController.IsInGroup(raidingGroupId)) {
        ChatSystem.sendSystemMessage(`Unable to team player: ${targetController} is not in the raiders' group.`);
        return;
      }
    }

    // Check if the amount of players exceedes the team size
    {
      const playersOnTeam = getPlayersFromTeam(inst.entity, team);
      const totalDefinedSize = tonumber(inst.attributes.totalTeamSize) || 999;

      if (playersOnTeam.size() + 1 > totalDefinedSize) {
        ChatSystem.sendSystemMessage(`Unable to team player: Maximum amount of players on the team exceeds ${totalDefinedSize}.`);
        return;
      }
    }

    targetEntity.team = team;
    targetEntity.Spawn();

    // Write reply
    let teamColor = colorTable.spectatorsColor;
    if (team === PlayerTeam.Defenders) teamColor = colorTable.defendersColor;
    if (team === PlayerTeam.Raiders) teamColor = colorTable.raidersColor;

    ChatSystem.sendSystemMessage(`${targetController} (${targetEntity.id}) joined the <font color="${teamColor}">${PlayerTeam[team]}</font> team.`);
  });
}); 

new ConsoleFunctionCallback(["team"], [{ name: "player", type: "player" }, { name: "team", type: "team" }])
  .setDescription("Changes a player's team")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;
    const team = ctx.getArgument("team", "team").value;

    if (targetPlayers.size() <= 0) {
      ChatSystem.sendSystemMessage(`<b><font color="${colorTable.errorneousColor}">Argument #1 unknown player.</font></b>`);
      return;
    }

    for (const ent of targetPlayers) {
      startBufferCreation();
      writeBufferString(ent.id);
      writeBufferU8(PlayerTeam[team]);
      defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
    }
  });