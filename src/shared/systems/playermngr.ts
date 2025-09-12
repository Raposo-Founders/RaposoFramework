import { Players, RunService } from "@rbxts/services";
import { defaultEnvironments } from "shared/defaultinsts";
import { getPlayermodelFromEntity } from "shared/playermodel";
import ServerInstance from "shared/serverinst";

// # Constants & variables

// # Functions

// # Execution
ServerInstance.serverCreated.Connect(inst => {
  inst.playerJoined.Connect((user, referenceId) => {
    inst.entity.createEntity("SwordPlayerEntity", `PlayerEnt_${user.UserId}`, referenceId, user.UserId).andThen(ent => {
      print(`Player entity created for user ${user.Name} with ID ${ent.id}.`);

      task.wait(2);

      ent.Spawn(new CFrame(0, 100, 0));
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
      if (totalAttempts >= 20) {
        controller = ent.GetUserFromController();

        print("Timed out.", controller);
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

    task.defer(() => {
      task.wait(1);
      warn(ent.appearanceId, ent.appearanceId === Players.LocalPlayer.UserId);
      print("Finished setting local character!");
    });

  });
}
