import { Players, RunService } from "@rbxts/services";
import { defaultEnvironments } from "shared/defaultinsts";
import { msg } from "shared/logger";
import { getPlayermodelFromEntity } from "shared/playermodel";
import ServerInstance from "shared/serverinst";

// # Constants & variables

// # Functions

// # Execution
ServerInstance.serverCreated.Connect(inst => {
  inst.playerJoined.Connect(user => {
    inst.entity.createEntity("SwordPlayerEntity", `PlayerEnt_${user.UserId}`).andThen(ent => {
      msg("INFO", `Player entity created for user ${user.Name} with ID ${ent.id}.`);

      ent.userid = user.UserId;
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

    if (ent.userid === Players.LocalPlayer.UserId) return;

    workspace.CurrentCamera!.CameraSubject = playermodel.rig.Humanoid;
    workspace.CurrentCamera!.CameraType = Enum.CameraType.Custom;
    Players.LocalPlayer.Character = playermodel.rig;

    msg("INFO", "Finished setting local character!");
  });
}
