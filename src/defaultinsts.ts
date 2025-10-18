import { EntityManager } from "./entities";
import { LifecycleInstance } from "./lifecycle";
import { NetworkManager } from "./network";
import SessionInstance from "./providers/SessionProvider";
import Signal from "./util/signal";
import WorldInstance from "./worldrender";

// # Constants & variables
export const clientSessionConnected = new Signal<[sessionId: string]>();
export const clientSessionDisconnected = new Signal<[sessionId: string, reason: string]>();

const defaultWorldInstance = new WorldInstance("default");

export const defaultEnvironments = {
  world: defaultWorldInstance,
  network: new NetworkManager(),
  lifecycle: new LifecycleInstance(),
  entity: new EntityManager(defaultWorldInstance),

  server: undefined as SessionInstance | undefined,
};