import { Players } from "@rbxts/services";
import { RaposoConsole } from "logging";
import { EntityManager } from "./entities";
import { gameValues } from "./gamevalues";
import { LifecycleInstance } from "./lifecycle";
import { NetworkManager, sendDirectPacket } from "./network";
import { startBufferCreation, writeBufferString } from "./util/bufferwriter";
import Signal from "./util/signal";
import { RandomString } from "./util/utilfuncs";
import WorldInstance from "./worldrender";

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

  readonly bannedPlayers = new Map<Player["UserId"], string>;

  constructor(
    readonly id: string,
    readonly world: WorldInstance,
    readonly network: NetworkManager,
    readonly entity: EntityManager,
    readonly lifecycle: LifecycleInstance,
  ) {
    RaposoConsole.Warn(`Spawning server ${id}`);

    ServerInstance.runningInstances.set(id, this);

    this.networkLifecycleDisconnect = lifecycle.BindTickrate(() => network.processPackets());
    this.connections.push(Players.PlayerRemoving.Connect(user => this.RemovePlayer(user, "Left the game.")));

    network.listenPacket("disconnect_request", (packet) => {
      if (!packet.sender) return;
      this.RemovePlayer(packet.sender, "Disconnected by user.");
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

    startBufferCreation();
    writeBufferString(disconnectreason);
    sendDirectPacket("server_disconnected", player);

    this.network.signedUsers.delete(player);
    this.trackingPlayers.delete(player);
    this.playerLeft.Fire(player, disconnectreason);
  }

  BanPlayer(player: Player, reason = "undefined.") {
    this.bannedPlayers.set(player.UserId, reason);

    this.RemovePlayer(player, `Banned by administrator: ${reason}`);
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