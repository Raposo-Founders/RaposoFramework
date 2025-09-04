import { msg } from "shared/logger";
import CSessionInstance from "shared/session";

// # Constants & variables
const DEFAULT_PLAYER_TEAM = "Spectator";

// # Functions
function CreateEntityForPlayer(user: Player) {

}

// # Execution
CSessionInstance.session_created.Connect(session => {
  
  session.player_joined.Connect(user => {
    session.entity_env.CreateEntityByName("PlayerEntity", undefined).andThen(ent => {
      msg("INFO", `Player entity created for user ${user.Name} with ID ${ent.id}.`);
    });
  });

});