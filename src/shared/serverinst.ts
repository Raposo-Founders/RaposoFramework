import { HttpService, Players } from "@rbxts/services";
import { EntityManager } from "./entities";
import { LifecycleInstance } from "./lifecycle";
import { NetworkManager } from "./network";
import { writeBufferString } from "./util/bufferwriter";
import Signal from "./util/signal";
import WorldInstance from "./worldrender";
import { gameValues } from "./gamevalues";
import { RandomString } from "./util/utilfuncs";

// # Class
class ServerInstance {
  static runningInstances = new Map<string, ServerInstance>();
  static serverCreated = new Signal<[inst: ServerInstance]>();

  private readonly closingConnections = new Array<(environment: ServerInstance) => void>();
  private readonly connections: RBXScriptConnection[] = [];
  private networkLifecycleDisconnect: Callback | undefined;

  readonly trackingPlayers = new Set<Player>();
  readonly playerJoined = new Signal<[user: Player, referenceId: string]>();
  readonly playerLeft = new Signal<[Player, string]>();

  constructor(
    readonly id: string,
    readonly world: WorldInstance,
    readonly network: NetworkManager,
    readonly entity: EntityManager,
    readonly lifecycle: LifecycleInstance,
  ) {
    warn(`Spawning server ${id}`);

    ServerInstance.runningInstances.set(id, this);

    this.networkLifecycleDisconnect = lifecycle.BindTickrate(() => network.processQueuedPackets());
    this.connections.push(Players.PlayerRemoving.Connect(user => this.RemovePlayer(user, "Left the game.")));

    network.listenPacket("disconnect_request", (sender, bfr) => {
      if (!sender) return;
      this.RemovePlayer(sender, "Disconnected by user.");
    });

    ServerInstance.serverCreated.Fire(this);
  }

  async Close() {
    print(`Closing server instance ${this.id}...`);

    this.lifecycle.Destroy();
    ServerInstance.runningInstances.delete(this.id);

    for (const user of this.trackingPlayers)
      this.RemovePlayer(user, "Instance closing.");

    this.networkLifecycleDisconnect?.();
    this.network.Destroy();

    task.wait(1);

    for (const callback of this.closingConnections)
      task.spawn(() => callback(this));
    this.closingConnections.clear();

    for (const conn of this.connections)
      conn.Disconnect();
    this.connections.clear();

    this.entity.murderAllFuckers();

    this.playerJoined.Clear();
    this.playerLeft.Clear();

    task.wait();
    task.wait();

    table.clear(this);
  }

  BindToClose(callback: (server: ServerInstance) => void) {
    this.closingConnections.push(callback);
  }

  InsertPlayer(player: Player) {
    // const referenceId = HttpService.GenerateGUID(false);
    const referenceId = RandomString(10);

    print(`${player.Name} (${referenceId}) has joined the server ${this.id}`);

    player.SetAttribute(gameValues.usersessionid, referenceId);

    this.network.signedUsers.add(player);
    this.trackingPlayers.add(player);
    this.playerJoined.Fire(player, referenceId);
  }

  RemovePlayer(player: Player, disconnectreason = "") {
    if (!this.trackingPlayers.has(player)) return;

    print(`${player.Name} has left the server ${this.id}. (${disconnectreason})`);
    player.SetAttribute(gameValues.usersessionid, undefined);

    this.network.startWritingMessage("server_disconnected", [player], []);
    writeBufferString(disconnectreason);
    this.network.finishWritingMessage();

    this.network.signedUsers.delete(player);
    this.trackingPlayers.delete(player);
    this.playerLeft.Fire(player, disconnectreason);
  }

  static GetServersFromPlayer(user: Player) {
    const list = new Array<ServerInstance>();

    for (const [, server] of this.runningInstances)
      if (server.trackingPlayers.has(user)) list.push(server);

    return list;
  }
}

// * Export
export = ServerInstance;