import { Players, RunService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import { SwordPlayerEntity } from "entities/SwordPlayerEntity";
import { DoesInstanceExist } from "util/utilfuncs";

// # Constants & variables

// # Functions
function SearchTargetEntity(environment: T_EntityEnvironment, caller: PlayerEntity) {
  let currentTarget: PlayerEntity | undefined;

  if (caller.team === PlayerTeam.Spectators) return;

  for (const ent of environment.getEntitiesThatIsA("PlayerEntity")) {
    if (ent.team === PlayerTeam.Spectators || ent.health <= 0) continue;
    if (ent.team === caller.team) continue;

    if (!currentTarget)
      currentTarget = ent;

    // Compare the distance between the target and the caller
    const targetDistance = caller.origin.Position.sub(currentTarget.origin.Position);
    const currDistance = caller.origin.Position.sub(ent.origin.Position);

    if (targetDistance.Magnitude >= currDistance.Magnitude) continue;
    currentTarget = ent;
  }

  return currentTarget;
}

// # Execution
if (RunService.IsClient())
  defaultEnvironments.lifecycle.BindTickrate(() => {
    for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("SwordPlayerEntity")) {
      if (ent.GetUserFromNetworkOwner() !== Players.LocalPlayer) continue;
      if (ent.health <= 0 || ent.team === PlayerTeam.Spectators) continue;
      if (!DoesInstanceExist(ent.humanoidModel)) continue;

      const target = SearchTargetEntity(defaultEnvironments.entity, ent);

      if (target)
        ent.humanoidModel.Humanoid.MoveTo(target.origin.Position);
      else
        ent.humanoidModel.Humanoid.Move(new Vector3());

      ent.origin = ent.humanoidModel.GetPivot();
      ent.velocity = ent.humanoidModel.HumanoidRootPart?.AssemblyLinearVelocity ?? new Vector3();
      ent.grounded = ent.humanoidModel.Humanoid.FloorMaterial.Name !== "Air";
    }
  });