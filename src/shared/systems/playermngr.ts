import { msg } from "shared/logger";
import CSessionInstance from "shared/session";

// # Constants & variables

// # Functions

// # Execution
CSessionInstance.sessionCreated.Connect(session => {
  session.playerJoined.Connect(user => {
    session.entityEnvironment.createEntity("PlayerEntity", `PlayerEnt_${user.UserId}`).andThen(ent => {
      msg("INFO", `Player entity created for user ${user.Name} with ID ${ent.id}.`);
    });
  });
});
