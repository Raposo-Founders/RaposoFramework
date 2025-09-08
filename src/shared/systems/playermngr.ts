import { msg } from "shared/logger";
import CSessionInstance from "shared/session";

// # Constants & variables

// # Functions

// # Execution
CSessionInstance.sessionCreated.Connect(session => {
  session.playerJoined.Connect(user => {
    session.entityEnvironment.createEntity("SwordPlayerEntity", `PlayerEnt_${user.UserId}`).andThen(ent => {
      msg("INFO", `Player entity created for user ${user.Name} with ID ${ent.id}.`);

      ent.userid = user.UserId;
      ent.Spawn(new CFrame(0, 100, 0));
    });
  });
});
