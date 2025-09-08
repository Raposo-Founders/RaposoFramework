import { Players } from "@rbxts/services";
import { EntityManager } from "./entities";
import { LifecycleInstance } from "./lifecycle";
import { NetworkManager } from "./network";
import { writeBufferString } from "./util/bufferwriter";
import Signal from "./util/signal";
import WorldInstance from "./worldrender";

// # Class
class CSessionInstance {
  static runningSessions = new Map<string, CSessionInstance>();

  static readonly sessionCreated = new Signal<[CSessionInstance]>();
  static readonly sessionClosed = new Signal<[CSessionInstance]>();

  private readonly closingConnections = new Array<(session: CSessionInstance) => void>();
  private readonly connections: RBXScriptConnection[] = [];
  private networkLifecycleDisconnect: Callback | undefined;

  readonly trackingPlayers = new Set<Player>();
  readonly playerJoined = new Signal<[Player]>();
  readonly playerLeft = new Signal<[Player, string]>();

  readonly entityEnvironment: EntityManager;
  readonly networkManager = new NetworkManager();
  readonly lifecycleInstance = new LifecycleInstance();
  readonly worldInstance: WorldInstance;

  constructor(readonly sessionid: string, readonly map: string) {
    warn(`Spawning session ${sessionid}`);

    this.worldInstance = new WorldInstance(map);
    this.entityEnvironment = new EntityManager(this.worldInstance);

    CSessionInstance.runningSessions.set(sessionid, this);
    CSessionInstance.sessionCreated.Fire(this);

    this.networkLifecycleDisconnect = this.lifecycleInstance.BindTickrate(() => this.networkManager.processQueuedPackets());

    this.connections.push(Players.PlayerRemoving.Connect(user => this.RemovePlayer(user, "Left the game.")));

    this.entityEnvironment.isServer = true;
    this.lifecycleInstance.running = true;

    this.networkManager.listenPacket("session_disconnect_request", (sender, bfr) => {
      if (!sender) return;
      this.RemovePlayer(sender, "Disconnected by user.");
    });
  }

  async Close() {
    print(`Closing session ${this.sessionid}...`);

    this.lifecycleInstance.Destroy();

    CSessionInstance.runningSessions.delete(this.sessionid);
    CSessionInstance.sessionClosed.Fire(this).expect();

    for (const user of this.trackingPlayers)
      this.RemovePlayer(user, "Session closed.");

    this.networkLifecycleDisconnect?.();
    this.networkManager.Destroy();

    task.wait(1);

    for (const callback of this.closingConnections)
      task.spawn(() => callback(this));
    this.closingConnections.clear();

    for (const conn of this.connections)
      conn.Disconnect();
    this.connections.clear();

    this.entityEnvironment.murderAllFuckers();

    this.playerJoined.Clear();
    this.playerLeft.Clear();

    task.wait();
    task.wait();

    table.clear(this);
  }

  BindToClose(callback: (session: CSessionInstance) => void) {
    this.closingConnections.push(callback);
  }

  InsertPlayer(player: Player) {
    print(`${player.Name} has joined the session ${this.sessionid}`);

    this.networkManager.signedUsers.add(player);
    this.trackingPlayers.add(player);
    this.playerJoined.Fire(player);
  }

  RemovePlayer(player: Player, disconnectreason = "") {
    if (!this.trackingPlayers.has(player)) return;

    print(`${player.Name} has left the session ${this.sessionid}. (${disconnectreason})`);

    this.networkManager.startWritingMessage("session_disconnected", [player], []);
    writeBufferString(disconnectreason);
    this.networkManager.finishWritingMessage();

    this.networkManager.signedUsers.delete(player);
    this.trackingPlayers.delete(player);
    this.playerLeft.Fire(player, disconnectreason);
  }

  static GetSessionsFromPlayer(user: Player) {
    const list = new Array<CSessionInstance>();

    for (const [, sessioninst] of this.runningSessions)
      if (sessioninst.trackingPlayers.has(user)) list.push(sessioninst);

    return list;
  }
}

// * Export
export = CSessionInstance;
