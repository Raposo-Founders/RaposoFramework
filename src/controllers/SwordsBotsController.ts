import { Players, RunService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import { SwordPlayerEntity } from "entities/SwordPlayerEntity";
import WorldEntity from "entities/WorldEntity";
import { RaposoConsole } from "logging";
import SessionInstance from "providers/SessionProvider";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation } from "util/bufferwriter";
import { DoesInstanceExist } from "util/utilfuncs";

// # Constants & variables
const THRESHOLD_DISTANCE = 5;
const SWORD_LENGTH = 4;
const NETWORK_REPL_ID = "botsword_";

// # Functions
function SearchTargetEntity(environment: T_EntityEnvironment, caller: PlayerEntity) {
  let currentTarget: WorldEntity | undefined;

  if (caller.team === PlayerTeam.Spectators) return;

  for (const ent of environment.getEntitiesThatIsA("PlayerEntity")) {
    if (ent.team === PlayerTeam.Spectators || ent.health <= 0) continue;
    if (ent.team === caller.team) continue;

    if (!currentTarget)
      currentTarget = ent;

    if (ent.id === currentTarget.id)
      continue;

    // Compare the distance between the target and the caller
    const currentDistance = caller.origin.Position.sub(currentTarget.origin.Position).Magnitude;
    const entityDistance = caller.origin.Position.sub(ent.origin.Position).Magnitude;

    if (currentDistance < entityDistance) continue;
    currentTarget = ent;
  }

  if (!currentTarget)
    for (const ent of environment.getEntitiesThatIsA("CapturePointEntity")) {
      if (ent.current_team === caller.team) continue;

      currentTarget = ent;
      break;
    }

  return currentTarget;
}

function CalculateBotMovement(entity: PlayerEntity, target: WorldEntity) {
  if (!DoesInstanceExist(entity.humanoidModel)) return;

  const currentPosition = entity.humanoidModel.GetPivot().Position.mul(new Vector3(1, 0, 1));
  const targetPosition = target.origin.Position.mul(new Vector3(1, 0, 1));
  const distance = currentPosition.sub(targetPosition).Magnitude;

  let moveToPosition = targetPosition;

  if (target.IsA("PlayerEntity") && distance <= THRESHOLD_DISTANCE) {
    const inverseDirection = new CFrame(targetPosition, currentPosition);

    moveToPosition = inverseDirection.mul(new CFrame(0, 0, -THRESHOLD_DISTANCE)).Position;
  }

  entity.humanoidModel.Humanoid.MoveTo(moveToPosition);
}

function CalculateLookVector(entity: PlayerEntity, target: PlayerEntity) {
  if (!DoesInstanceExist(entity.humanoidModel)) return;

  const currentPosition = entity.humanoidModel.HumanoidRootPart.GetPivot().Position;
  const targetPosition = target.origin.Position;

  const currentHorizontalPosition = currentPosition.mul(new Vector3(1, 0, 1));
  const targetHorizontalPosition = targetPosition.mul(new Vector3(1, 0, 1));
  const direction = new CFrame(currentHorizontalPosition, targetHorizontalPosition);
  const distance = currentHorizontalPosition.sub(targetHorizontalPosition).Magnitude;

  const swayX = 22.5 + (math.cos(time() * 40) * 30);

  if (distance > THRESHOLD_DISTANCE + 3) {
    entity.humanoidModel.Humanoid.AutoRotate = true;
    return;
  }

  const [, currentYRotation] = direction.ToOrientation();

  entity.humanoidModel.HumanoidRootPart.CFrame = new CFrame(currentPosition).mul(CFrame.Angles(0, currentYRotation + math.rad(swayX), 0));
}

// # Execution
SessionInstance.sessionCreated.Connect(session => {
  session.entity.entityCreated.Connect(ent => {
    if (!ent.IsA("SwordPlayerEntity")) return;
  });

  session.network.listenPacket(`${NETWORK_REPL_ID}botupd`, packet => {
    if (!packet.sender) return;

    const reader = BufferReader(packet.content);
    const entityId = reader.string(); // Entity ID can be read from here due to PlayerEntity writing it first

    const entity = session.entity.entities.get(entityId);
    if (!entity?.IsA("SwordPlayerEntity")) return;
    if (entity.GetUserFromNetworkOwner() !== packet.sender) {
      RaposoConsole.Warn(`Invalid ${SwordPlayerEntity} state update from ${packet.sender}.`);
      return;
    }

    entity.ApplyStateBuffer(reader);
  });
});

if (RunService.IsClient())
  defaultEnvironments.lifecycle.BindTickrate(() => {
    for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("SwordPlayerEntity")) {
      if (ent.GetUserFromNetworkOwner() !== Players.LocalPlayer) continue;
      if (ent.health <= 0 || ent.team === PlayerTeam.Spectators) continue;
      if (!DoesInstanceExist(ent.humanoidModel)) continue;

      const target = SearchTargetEntity(defaultEnvironments.entity, ent);

      if (target) {
        CalculateBotMovement(ent, target);

        if (target.IsA("PlayerEntity"))
          CalculateLookVector(ent, target);
      }

      ent.origin = ent.humanoidModel.GetPivot();
      ent.velocity = ent.humanoidModel.HumanoidRootPart?.AssemblyLinearVelocity ?? new Vector3();
      ent.grounded = ent.humanoidModel.Humanoid.FloorMaterial.Name !== "Air";

      startBufferCreation();
      ent.WriteStateBuffer();
      defaultEnvironments.network.sendPacket(`${NETWORK_REPL_ID}botupd`);
    }
  });