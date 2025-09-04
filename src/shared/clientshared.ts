import { ErrorObject } from "./util/utilfuncs";
import { CEntityEnvironment } from "./entities";
import { CNetworkPortal } from "./network";
import { RunService } from "@rbxts/services";
import Object from "@rbxts/object-utils";
import { CLifecycleEnvironment } from "./lifecycle";
import CBindableSignal from "./util/signal";
import CWorldInstance from "./worldrender";

// # Constants
const worldInstance = new CWorldInstance("default");

export const clientSessionConnected = new CBindableSignal<[sessionId: string]>();
export const clientSessionDisconnected = new CBindableSignal<[sessionId: string, reason: string]>();

export const clientSharedEnv = {
  worldInstance: worldInstance,
  netportal: new CNetworkPortal(),
  entityEnvironment: new CEntityEnvironment(worldInstance),
  lifecycle: new CLifecycleEnvironment(),
};

// # Bindings & misc
if (RunService.IsServer())
  for (const key of Object.keys(clientSharedEnv))
    rawset(clientSharedEnv, key, ErrorObject("Client environment is not accessible from the server."));
