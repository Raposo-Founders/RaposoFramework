import { Players, RunService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import { getPlayermodelFromEntity } from "providers/PlayermodelProvider";
import { Playermodel } from "providers/PlayermodelProvider/rig";
import { DoesInstanceExist } from "util/utilfuncs";

// # Constants & variables

// # Functions
export function getLocalPlayerEntity() {
  assert(RunService.IsClient(), "Function can only be called from the client.");

  for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("PlayerEntity"))
    if (ent.GetUserFromController() === Players.LocalPlayer)
      return ent;
}

export function getLocalPlayermodel() {
  const entity = getLocalPlayerEntity();
  if (!entity) return;

  const playermodel = getPlayermodelFromEntity(entity.id);
  if (!playermodel) return;

  return playermodel;
}

// # Bindings & execution
if (RunService.IsClient())
  defaultEnvironments.lifecycle.BindUpdate(() => {
    const entity = getLocalPlayerEntity();
    const playermodel = getLocalPlayermodel();
    if (!entity || entity.health <= 0 || !playermodel || !DoesInstanceExist(playermodel.rig)) return;

    entity.origin = playermodel.GetPivot();
    entity.velocity = playermodel.rig.PrimaryPart?.AssemblyLinearVelocity ?? new Vector3();
    entity.grounded = playermodel.rig.Humanoid.FloorMaterial.Name !== "Air";
  });

if (RunService.IsClient())
  defaultEnvironments.entity.entityCreated.Connect(ent => {
    if (!ent.IsA("PlayerEntity")) return;
    if (ent.GetUserFromController() !== Players.LocalPlayer) return;

    // Fetch playermodel
    let playermodel: Playermodel | undefined;
    while (!playermodel) {
      playermodel = getPlayermodelFromEntity(ent.id);

      if (playermodel)
        break;

      task.wait();
    }

    workspace.CurrentCamera!.CameraSubject = playermodel.rig.Humanoid;
    workspace.CurrentCamera!.CameraType = Enum.CameraType.Custom;
    Players.LocalPlayer.Character = playermodel.rig;
  });