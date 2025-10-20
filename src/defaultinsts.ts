import { EntityManager } from "./entities";
import { LifecycleInstance } from "./lifecycle";
import { NetworkManager } from "./network";
import SessionInstance from "./providers/SessionProvider";
import Signal from "./util/signal";

// # Constants & variables
export const clientSessionConnected = new Signal<[sessionId: string]>();
export const clientSessionDisconnected = new Signal<[sessionId: string, reason: string]>();

export const defaultEnvironments = {
  network: new NetworkManager(),
  lifecycle: new LifecycleInstance(),
  entity: new EntityManager(),

  server: undefined as SessionInstance | undefined,
};