import { Players, RunService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import { getPlayermodelFromEntity } from "providers/PlayermodelProvider";
import { PlayermodelRig } from "providers/PlayermodelProvider/rig";
import { DoesInstanceExist } from "util/utilfuncs";
import { CameraSystem } from "../systems/CameraSystem";

// # Constants & variables

// # Functions
export function getLocalPlayerEntity() {
  assert(RunService.IsClient(), "Function can only be called from the client.");

  for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("PlayerEntity"))
    if (ent.GetUserFromController() === Players.LocalPlayer)
      return ent;
}

// # Bindings & execution
if (RunService.IsClient())
  defaultEnvironments.lifecycle.BindUpdate(() => {
    if (defaultEnvironments.entity.isPlayback) return;

    const entity = getLocalPlayerEntity();
    if (!entity || entity.health <= 0 || !entity.humanoidModel) return;

    CameraSystem.setTrackingEntity(entity.id);

    if (CameraSystem.isShiftlockEnabled()) {
      const currentPosition = entity.humanoidModel.HumanoidRootPart.CFrame;
      const [charX, , charZ] = currentPosition.ToOrientation();
      const [, camRotY] = CameraSystem.getOrigin().ToOrientation();

      entity.humanoidModel.HumanoidRootPart.CFrame = new CFrame(currentPosition.Position).mul(CFrame.Angles(charX, camRotY, charZ));
    }

    entity.humanoidModel.Humanoid.AutoRotate = !CameraSystem.isShiftlockEnabled();

    entity.origin = entity.humanoidModel.GetPivot();
    entity.velocity = entity.humanoidModel.HumanoidRootPart?.AssemblyLinearVelocity ?? new Vector3();
    entity.grounded = entity.humanoidModel.Humanoid.FloorMaterial.Name !== "Air";
  });