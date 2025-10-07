import { Players, RunService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import { gameValues } from "gamevalues";
import { getPlayermodelFromEntity } from "playermodel";
import ServerInstance from "serverinst";
import { getLocalPlayerEntity } from "util/localent";
import { DoesInstanceExist } from "util/utilfuncs";

// # Constants & variables
const TARGET_GROUP = 7203437 as const;
const ADMIN_ROLES: string[] = [
  "OWNER",
  "LEADER",
  "DIRECTOR",
  "COMMANDER",
  "DEVELOPER",
  "CAPTAIN",
  "SERGEANT",
] as const;

// # Functions

// # Execution
ServerInstance.serverCreated.Connect(inst => {
  inst.playerJoined.Connect((user, referenceId) => {
    user.SetAttribute(gameValues.adminattr, ADMIN_ROLES.includes(user.GetRoleInGroup(TARGET_GROUP).upper()) || RunService.IsStudio());
    user.SetAttribute(gameValues.modattr, user.GetAttribute(gameValues.adminattr));

    inst.entity.createEntity("SwordPlayerEntity", `PlayerEnt_${user.UserId}`, referenceId, user.UserId).andThen(ent => {
      ent.died.Connect(() => {
        task.wait(Players.RespawnTime);
        ent.Spawn();
      });

      let connection: BindableEventConnection | undefined;
      connection = inst.playerLeft.Connect((leavingUser, reason) => {
        if (leavingUser !== user) return;

        inst.entity.killThisFucker(ent);
        connection?.Disconnect();
        connection = undefined;
      });

      task.wait(2);

      ent.Spawn(new CFrame(0, 5, 0));
    });
  });
});

if (RunService.IsClient()) {
  defaultEnvironments.entity.entityCreated.Connect(ent => {
    if (!ent.IsA("PlayerEntity")) return;

    let playermodel = getPlayermodelFromEntity(ent.id);
    while (!playermodel) {
      task.wait(1);
      playermodel = getPlayermodelFromEntity(ent.id);

      if (playermodel)
        break;
    }

    let controller: Player | undefined;
    let totalAttempts = 0;

    while (!controller) {
      totalAttempts++;
      if (totalAttempts >= 10) {
        controller = ent.GetUserFromController();
        print("Controller fetching timed out.", controller);
        break;
      }

      controller = ent.GetUserFromController();
      if (controller !== Players.LocalPlayer) controller = undefined;

      defaultEnvironments.lifecycle.YieldForTicks(1);
    }
    if (controller !== Players.LocalPlayer) return;

    workspace.CurrentCamera!.CameraSubject = playermodel.rig.Humanoid;
    workspace.CurrentCamera!.CameraType = Enum.CameraType.Custom;
    Players.LocalPlayer.Character = playermodel.rig;
  });

  defaultEnvironments.lifecycle.BindUpdate(() => {
    const entity = getLocalPlayerEntity(defaultEnvironments.entity);
    const playermodel = entity ? getPlayermodelFromEntity(entity.id) : undefined;
    if (!entity || !entity.IsA("SwordPlayerEntity") || !playermodel || !DoesInstanceExist(playermodel.rig)) return;
    if (entity.health <= 0) return;

    entity.origin = playermodel.GetPivot();
    entity.velocity = playermodel.rig.PrimaryPart?.AssemblyLinearVelocity ?? new Vector3();
    entity.grounded = playermodel.rig.Humanoid.FloorMaterial.Name !== "Air";
  });
}
