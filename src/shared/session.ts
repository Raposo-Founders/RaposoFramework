import { Players } from "@rbxts/services";
import { CEntityEnvironment } from "./entities";
import { CLifecycleEnvironment } from "./lifecycle";
import { CNetworkPortal } from "./network";
import { WriteBufferString } from "./util/bufferwriter";
import CBindableSignal from "./util/signal";
import CWorldInstance from "./worldrender";

// # Class
class CSessionInstance {
  static running_sessions = new Map<string, CSessionInstance>();

  static session_created = new CBindableSignal<[CSessionInstance]>();
  static session_closing = new CBindableSignal<[CSessionInstance]>();

  private readonly _closing_connections = new Array<(session: CSessionInstance) => void>();
  private readonly _connections: RBXScriptConnection[] = [];
  private _netLifecycleDisconnect: Callback | undefined;

  readonly active_players = new Set<Player>();
  readonly player_joined = new CBindableSignal<[Player]>();
  readonly player_left = new CBindableSignal<[Player, string]>();

  readonly entity_env: CEntityEnvironment;
  readonly network_env = new CNetworkPortal();
  readonly lifecycle_env = new CLifecycleEnvironment();
  readonly world_env: CWorldInstance;

  constructor(readonly sessionid: string, readonly map: string) {
    warn(`Spawning session ${sessionid}`);

    this.world_env = new CWorldInstance(map);
    this.entity_env = new CEntityEnvironment(this.world_env);

    CSessionInstance.running_sessions.set(sessionid, this);
    CSessionInstance.session_created.Fire(this);

    this._netLifecycleDisconnect = this.lifecycle_env.BindTickrate(() => this.network_env.processQueuedPackets());

    this._connections.push(Players.PlayerRemoving.Connect(user => this.RemovePlayer(user, "Left the game.")));

    this.entity_env.is_server = true;
    this.lifecycle_env.running = true;

    this.network_env.listenPacket("session_disconnect_request", (sender, bfr) => {
      if (!sender) return;
      this.RemovePlayer(sender, "Disconnected by user.");
    });
  }

  async Close() {
    print(`Closing session ${this.sessionid}...`);

    this.lifecycle_env.Destroy();

    CSessionInstance.running_sessions.delete(this.sessionid);
    CSessionInstance.session_closing.Fire(this).expect();

    for (const user of this.active_players)
      this.RemovePlayer(user, "Session closed.");

    this._netLifecycleDisconnect?.();
    this.network_env.Destroy();

    task.wait(1);

    for (const callback of this._closing_connections)
      task.spawn(() => callback(this));
    this._closing_connections.clear();

    for (const conn of this._connections)
      conn.Disconnect();
    this._connections.clear();

    this.entity_env.KillAllThoseBitchAsses();

    this.player_joined.Clear();
    this.player_left.Clear();

    task.wait();
    task.wait();

    table.clear(this);
  }

  BindToClose(callback: (session: CSessionInstance) => void) {
    this._closing_connections.push(callback);
  }

  InsertPlayer(player: Player) {
    print(`${player.Name} has joined the session ${this.sessionid}`);

    this.network_env.signedUsers.add(player);
    this.active_players.add(player);
    this.player_joined.Fire(player);
  }

  RemovePlayer(player: Player, disconnectreason = "") {
    if (!this.active_players.has(player)) return;

    print(`${player.Name} has left the session ${this.sessionid}. (${disconnectreason})`);

    this.network_env.startWritingMessage("session_disconnected", [player], []);
    WriteBufferString(disconnectreason);
    this.network_env.finishWritingMessage();

    this.network_env.signedUsers.delete(player);
    this.active_players.delete(player);
    this.player_left.Fire(player, disconnectreason);
  }

  static GetSessionsFromPlayer(user: Player) {
    const list = new Array<CSessionInstance>();

    for (const [, sessioninst] of this.running_sessions)
      if (sessioninst.active_players.has(user)) list.push(sessioninst);

    return list;
  }
}

// * Export
export = CSessionInstance;
