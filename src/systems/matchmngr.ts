import { GroupService, RunService } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ServerInstance from "serverinst";
import { uiValues } from "UI/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferF32, writeBufferU32, writeBufferU8 } from "util/bufferwriter";
import { getPlayersFromTeam } from "./playermngr";
import { writePlayerReply } from "cmd/cmdutils";

// # Constants & variables

// # Functions
function SpawnCapturePoints(session: ServerInstance) {
  for (const obj of session.world.objects.GetChildren()) {
    if (!obj.IsA("BasePart")) continue;
    if (obj.Name !== "ent_objective_capturepoint") continue;

    session.entity.createEntity("CapturePointEntity", undefined, obj.CFrame, obj.Size);
  }
}

function ResetCapturePoints(session: ServerInstance) {
  for (const ent of session.entity.getEntitiesThatIsA("CapturePointEntity")) {
    ent.capture_progress = 0;
    ent.current_team = PlayerTeam.Spectators;
  }
}

function ResetPlayers(session: ServerInstance) {
  for (const ent of session.entity.getEntitiesThatIsA("PlayerEntity")) {
    ent.stats.kills = 0;
    ent.stats.deaths = 0;
    ent.stats.damage = 0;
    ent.Spawn();
  }
}

// # Bindings & misc
ServerInstance.serverCreated.Connect(server => {
  const teamPoints = new Map<PlayerTeam, number>();
  let isRunning = false;
  let targetPoints = 600;
  let nextUpdateTime = 0;
  let raidingGroupId = 0;
  let matchStartedTime = 0;
  let totalTeamSize = 5;

  SpawnCapturePoints(server);

  server.network.listenPacket("match_start", (packet) => {
    if (!packet.sender) return;
    if (!packet.sender.GetAttribute(gameValues.adminattr)) return;

    const reader = BufferReader(packet.content);
    const pointsAmount = reader.u32();

    isRunning = true;
    targetPoints = pointsAmount;
    teamPoints.clear();

    ResetCapturePoints(server);
    ResetPlayers(server);

    nextUpdateTime = time() + 1;
    matchStartedTime = time();
  });

  server.network.listenPacket("match_changepts", (packet) => {
    if (!packet.sender) return;
    if (!packet.sender.GetAttribute(gameValues.adminattr)) return;

    const reader = BufferReader(packet.content);
    targetPoints = reader.u32();
  });

  server.lifecycle.BindTickrate(() => {
    if (!isRunning) return;

    const currentTime = time();
    if (currentTime < nextUpdateTime) return;
    nextUpdateTime = currentTime + 1;

    for (const ent of server.entity.getEntitiesThatIsA("CapturePointEntity")) {
      if (math.abs(ent.capture_progress) !== 1) continue;
      if (ent.current_team === PlayerTeam.Spectators) continue;

      const pointsAmount = (teamPoints.get(ent.current_team) || 0);
      teamPoints.set(ent.current_team, pointsAmount + 1);
    }

    for (const [teamIndex, points] of teamPoints) {
      if (points >= targetPoints) {
        isRunning = false;

        startBufferCreation();
        writeBufferU32(targetPoints);
        writeBufferU8(teamIndex);
        writeBufferU32(teamPoints.get(PlayerTeam.Defenders) || 0);
        writeBufferU32(teamPoints.get(PlayerTeam.Raiders) || 0);
        server.network.sendPacket("match_team_won");

        break;
      }
    }

    startBufferCreation();
    writeBufferU32(targetPoints);
    writeBufferU32(raidingGroupId);
    writeBufferU8(totalTeamSize);
    writeBufferU32(teamPoints.get(PlayerTeam.Defenders) || 0);
    writeBufferU32(teamPoints.get(PlayerTeam.Raiders) || 0);
    writeBufferF32(currentTime - matchStartedTime);
    server.network.sendPacket("match_update");
  });

  server.network.listenPacket("match_teamamount", info => {
    if (!info.sender) return;
    if (!info.sender.GetAttribute(gameValues.adminattr)) return;

    const reader = BufferReader(info.content);
    const playersAmount = reader.u8();

    totalTeamSize = playersAmount;
    server.attributesList.set("totalTeamSize", raidingGroupId);
  });

  server.network.listenPacket("match_setraiders", info => {
    if (!info.sender) return;
    if (!info.sender.GetAttribute(gameValues.adminattr)) return;

    const reader = BufferReader(info.content);
    const groupId = reader.u32();

    raidingGroupId = groupId;
    server.attributesList.set("raidingGroupId", groupId);

    // Check to see if all the raiding players are in the raiding group
    for (const ent of getPlayersFromTeam(server.entity, PlayerTeam.Raiders)) {
      const controller = ent.GetUserFromController();
      if (!controller || controller.IsInGroup(groupId)) continue;

      ent.team = PlayerTeam.Spectators;
      ent.Spawn();

      for (const user of server.trackingPlayers)
        writePlayerReply(user, `Player ${controller.Name} moved to spectators: Not in the raiding group.`);
    }
  });

  server.lifecycle.BindTickrate(ctx => {
    // if (!isRunning) return;

    for (const ent of server.entity.getEntitiesThatIsA("CapturePointEntity")) {
      ent.UpdateCaptureProgress(ctx.tickrate);

      startBufferCreation();
      ent.WriteStateBuffer();
      server.network.sendPacket("cpent_update");
    }
  });
});

if (RunService.IsClient()) {
  defaultEnvironments.network.listenPacket("match_update", (packet) => {
    const reader = BufferReader(packet.content);
    const targetPoints = reader.u32();
    const raidingGroupId = reader.u32();
    const matchTeamSize = reader.u8();
    const defendersPoints = reader.u32();
    const raidersPoints = reader.u32();
    const elapsedTime = reader.f32();

    uiValues.hud_target_points[1](targetPoints);
    uiValues.hud_defenders_points[1](defendersPoints);
    uiValues.hud_raiders_points[1](raidersPoints);
    uiValues.hud_game_time[1](elapsedTime);
    uiValues.hud_gamemode[1]("Fairzone"); // TODO: Replicate current gamemode
    uiValues.hud_team_size[1](matchTeamSize);
    uiValues.hud_raiders_group[1](raidingGroupId);
  });

  defaultEnvironments.network.listenPacket("cpent_update", (packet) => {
    const reader = BufferReader(packet.content);
    const entityId = reader.string();

    const worldPosition = reader.vec();
    const worldRotation = reader.vec();
    const worldSize = reader.vec();

    const targetEntity = defaultEnvironments.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("CapturePointEntity")) {

      defaultEnvironments.entity.createEntity(
        "CapturePointEntity",
        entityId,
        new CFrame(worldPosition.x, worldPosition.y, worldPosition.z).mul(CFrame.Angles(math.rad(worldRotation.y), math.rad(worldRotation.x), math.rad(worldRotation.z))),
        new Vector3(worldSize.x, worldSize.y, worldSize.z),
      ).andThen(ent => ent.ApplyStateBuffer(packet.content));

      return;
    }

    targetEntity.ApplyStateBuffer(packet.content);
  });
}

new ConsoleFunctionCallback(["setraiders"], [{ name: "groupId", type: "number" }])
  .setDescription("Sets the raiding group's ID")
  .setCallback(ctx => {
    const raidingGroupId = ctx.getArgument("groupId", "number");

    startBufferCreation();
    writeBufferU32(raidingGroupId.value);
    defaultEnvironments.network.sendPacket("match_setraiders");
  });

new ConsoleFunctionCallback(["teamsize"], [{ name: "amount", type: "number" }])
  .setDescription("Changes the amount of players allowed on each playing team")
  .setCallback((ctx) => {
    const playersAmount = math.min(ctx.getArgument("amount", "number").value, 255);

    startBufferCreation();
    writeBufferU8(playersAmount);
    defaultEnvironments.network.sendPacket("match_teamamount");
  });

new ConsoleFunctionCallback(["start"], [{ name: "points", type: "number" }, { name: "raidersGroupId", type: "number" }])
  .setDescription("Starts the match with the given points and raiding group ID")
  .setCallback((ctx) => {
    const pointsAmount = ctx.getArgument("points", "number").value;

    startBufferCreation();
    writeBufferU32(pointsAmount);
    defaultEnvironments.network.sendPacket("match_start");
  });