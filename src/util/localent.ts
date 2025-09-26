import { Players, RunService } from "@rbxts/services";

export function getLocalPlayerEntity(environment: T_EntityEnvironment) {
  assert(RunService.IsClient(), "Function can only be called from the client.");

  for (const ent of environment.getEntitiesThatIsA("PlayerEntity"))
    if (ent.GetUserFromController() === Players.LocalPlayer)
      return ent;
}