import { RunService } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import CapturePointEntity from "entities/CapturePointEntity";
import { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ServerInstance from "serverinst";
import { uiValues } from "UI/default/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferF32, writeBufferI16, writeBufferString, writeBufferU16, writeBufferU32, writeBufferU8 } from "util/bufferwriter";
import WorldInstance from "worldrender";

// # Constants & variables

// # Functions
function SpawnCapturePoints(session: ServerInstance) {
  for (const obj of session.world.objects.GetChildren()) {
    if (!obj.IsA("BasePart")) continue;
    if (obj.Name !== "ent_objective_capturepoint") continue;

    session.entity.createEntity("CapturePointEntity", undefined, obj.CFrame, obj.Size)
      .andThen(ent => {

      });
  }
}

function ResetCapturePoints(session: ServerInstance) {
  for (const ent of session.entity.getEntitiesThatIsA("CapturePointEntity")) {
    ent.capture_progress = 0;
    ent.current_team = PlayerTeam.Spectators;
  }
}

function RespawnPlayers(session: ServerInstance) {
  for (const ent of session.entity.getEntitiesThatIsA("PlayerEntity"))
    ent.Spawn();
}

// # Bindings & misc
ServerInstance.serverCreated.Connect(server => {
  const teamPoints = new Map<PlayerTeam, number>();
  let isRunning = false;
  let targetPoints = 600;
  let nextUpdateTime = 0;
  let raidingGroupId = 0;
  let matchStartedTime = 0;

  SpawnCapturePoints(server);

  server.network.listenPacket("match_start", (caller, bfr) => {
    if (!caller) return;
    if (!caller.GetAttribute(gameValues.adminattr)) return;

    const reader = BufferReader(bfr);
    const pointsAmount = reader.u32();
    const raidersId = reader.u32();

    isRunning = true;
    targetPoints = pointsAmount;
    raidingGroupId = raidersId;
    teamPoints.clear();

    ResetCapturePoints(server);
    RespawnPlayers(server);

    nextUpdateTime = time() + 1;
    matchStartedTime = time();
  });

  server.network.listenPacket("match_changepts", (caller, bfr) => {
    if (!caller) return;
    if (!caller.GetAttribute(gameValues.adminattr)) return;

    const reader = BufferReader(bfr);
    targetPoints = reader.u32();
  });

  server.lifecycle.BindTickrate(ctx => {
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

        server.network.startWritingMessage("match_team_won");
        writeBufferU32(targetPoints);
        writeBufferU8(teamIndex);
        writeBufferU32(teamPoints.get(PlayerTeam.Defenders) || 0);
        writeBufferU32(teamPoints.get(PlayerTeam.Raiders) || 0);
        server.network.finishWritingMessage();

        break;
      }
    }

    server.network.startWritingMessage("match_update");
    writeBufferU32(targetPoints);
    writeBufferU32(raidingGroupId);
    writeBufferU32(teamPoints.get(PlayerTeam.Defenders) || 0);
    writeBufferU32(teamPoints.get(PlayerTeam.Raiders) || 0);
    writeBufferF32(currentTime - matchStartedTime);
    server.network.finishWritingMessage();
  });

  server.lifecycle.BindTickrate(ctx => {
    if (!isRunning) return;

    for (const ent of server.entity.getEntitiesThatIsA("CapturePointEntity")) {
      ent.UpdateCaptureProgress(ctx.tickrate);

      server.network.startWritingMessage("cpent_update");
      ent.WriteStateBuffer();
      server.network.finishWritingMessage();
    }
  });
});

if (RunService.IsClient()) {
  defaultEnvironments.network.listenPacket("match_update", (_, bfr) => {
    const reader = BufferReader(bfr);
    const targetPoints = reader.u32();
    const raidingGroupId = reader.u32();
    const defendersPoints = reader.u32();
    const raidersPoints = reader.u32();
    const elapsedTime = reader.f32();

    uiValues.hud_target_points[1](targetPoints);
    uiValues.hud_defenders_points[1](defendersPoints);
    uiValues.hud_raiders_points[1](raidersPoints);
    uiValues.hud_game_time[1](elapsedTime);
    uiValues.hud_gamemode[1]("Fairzone"); // TODO: Replicate current gamemode
  });

  defaultEnvironments.network.listenPacket("cpent_update", (_, bfr) => {
    const reader = BufferReader(bfr);
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
      ).andThen(ent => ent.ApplyStateBuffer(bfr));

      return;
    }

    targetEntity.ApplyStateBuffer(bfr);
  });
}

new ConsoleFunctionCallback(["start"], [{ name: "points", type: "number" }, { name: "raidersGroupId", type: "number" }])
  .setDescription("Starts the match with the given points and raiding group ID")
  .setCallback((ctx) => {
    const pointsAmount = ctx.getArgument("points", "number").value;
    const raidersGroupId = ctx.getArgument("raidersGroupId", "number").value;

    defaultEnvironments.network.startWritingMessage("match_start");
    writeBufferU32(pointsAmount);
    writeBufferU32(raidersGroupId);
    defaultEnvironments.network.finishWritingMessage();
  });