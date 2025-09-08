import { PlayerTeam } from "shared/entities/PlayerEntity";
import { msg } from "shared/logger";
import CSessionInstance from "shared/session";

// # Constants & variables
const defaultPlayerTeam = PlayerTeam.Spectators;

// # Functions
function CreateEntityForPlayer(user: Player) {

}

// # Execution
CSessionInstance.sessionCreated.Connect(session => {
  
  session.playerJoined.Connect(user => {
    session.entityEnvironment.createEntity("PlayerEntity", undefined).andThen(ent => {
      msg("INFO", `Player entity created for user ${user.Name} with ID ${ent.id}.`);
    });
  });

});