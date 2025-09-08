import { ErrorObject } from "./util/utilfuncs";
import { EntityManager } from "./entities";
import { NetworkManager } from "./network";
import { RunService } from "@rbxts/services";
import Object from "@rbxts/object-utils";
import { LifecycleInstance } from "./lifecycle";
import Signal from "./util/signal";
import WorldInstance from "./worldrender";

// # Constants
const worldInstance = new WorldInstance("default");

export const clientSessionConnected = new Signal<[sessionId: string]>();
export const clientSessionDisconnected = new Signal<[sessionId: string, reason: string]>();

export const clientSharedEnv = {
  worldInstance: worldInstance,
  netportal: new NetworkManager(),
  entityEnvironment: new EntityManager(worldInstance),
  lifecycle: new LifecycleInstance(),
};

// # Bindings & misc
if (RunService.IsServer())
  for (const key of Object.keys(clientSharedEnv))
    rawset(clientSharedEnv, key, ErrorObject("Client environment is not accessible from the server."));
