import { t } from "@rbxts/t";
import { ReplicatedInstance } from "./util/utilfuncs";
import CBindableSignal from "./util/signal";
import { HttpService, Players, RunService } from "@rbxts/services";
import Object from "@rbxts/object-utils";
import { FinalizeBufferCreation, StartBufferCreation } from "./util/bufferwriter";

// # Types
interface PacketInfo {
  id: string;
  content: buffer;
  timestamp: number;
  sender: NetworkSenderInfo;
}

interface NetworkSenderInfo {
  userid: number;
  instance: Player | undefined;
  attributes: Map<string, AttributeValue>;
}

// # Constants
const packetsRemoteEvent = ReplicatedInstance(workspace, "NETWORK_PACKETS", "RemoteEvent");
const unreliablePacketsRemoteEvent = ReplicatedInstance(workspace, "NETWORK_UNRELIABLE_PACKETS", "UnreliableRemoteEvent");

const DIRECT_MESSAGES_REMOTE = ReplicatedInstance(workspace, "NETWORK_DIRECT_PACKETS", "RemoteEvent");
const UNREL_DIRECT_MESSAGES_REMOTE = ReplicatedInstance(workspace, "NETWORK_DIRECT_UNRELIABLE_PACKETS", "UnreliableRemoteEvent");

const boundDirectCallbacks = new Map<string, Callback>();

const writingDirectMessages = new Map<thread, { id: string, user: Player | undefined, unreliable: boolean }>();

// # Functions
export function startDirectMessage(id: string, user: Player | undefined = undefined, unreliable = false) {
  const thread = coroutine.running();
  if (writingDirectMessages.has(thread))
    throw "An direct packet is already being written in the current thread.";

  if (RunService.IsServer() && !t.instanceIsA("Player")(user))
    throw `Argument #2 must be an player, got ${tostring(user)} (${typeOf(user)}).`;

  StartBufferCreation();
  writingDirectMessages.set(thread, { id, user, unreliable });
}

export function finishDirectMessage() {
  const thread = coroutine.running();
  if (!writingDirectMessages.has(thread))
    throw "No direct messages have been started in the current thread.";

  const info = writingDirectMessages.get(thread)!;
  const bfr = FinalizeBufferCreation();

  if (RunService.IsClient())
    if (info.unreliable)
      UNREL_DIRECT_MESSAGES_REMOTE.FireServer(info.id, bfr);
    else
      DIRECT_MESSAGES_REMOTE.FireServer(info.id, bfr);

  if (RunService.IsServer())
    if (info.unreliable)
      UNREL_DIRECT_MESSAGES_REMOTE.FireClient(info.user!, info.id, bfr);
    else
      DIRECT_MESSAGES_REMOTE.FireClient(info.user!, info.id, bfr);

  writingDirectMessages.delete(thread);
}

export function listenDirectMessage(id: string, callback: (sender: Player | undefined, bfr: buffer) => void) {
  boundDirectCallbacks.set(id, callback);
}

// # Class
export class CNetworkPortal {
  private _packets_inbound = new Array<PacketInfo>();
  private _bound_listeners = new Map<string, Callback[]>();
  private _connections: RBXScriptConnection[] = [];
  private _current_snapshot = 0;

  network_outgoing_signal = new CBindableSignal<[id: string, bfr: buffer]>();
  post_to_remote = true;

  readonly player_list = new Set<Player>();

  constructor() {
    if (RunService.IsServer()) {
      this._connections.push(packetsRemoteEvent.OnServerEvent.Connect((user, id, bfr) => this.NetworkIn(user, id as string, bfr as buffer)));
      this._connections.push(unreliablePacketsRemoteEvent.OnServerEvent.Connect((user, id, bfr) => this.NetworkIn(user, id as string, bfr as buffer)));
    } else {
      this._connections.push(packetsRemoteEvent.OnClientEvent.Connect((id, bfr) => this.NetworkIn(undefined, id as string, bfr as buffer)));
      this._connections.push(unreliablePacketsRemoteEvent.OnClientEvent.Connect((id, bfr) => this.NetworkIn(undefined, id as string, bfr as buffer)));
    }
  }

  NetworkIn(sender: Player | undefined, id: string, bfr: buffer) {
    if (RunService.IsServer()) {
      if (!sender) return;
      if (!this.player_list.has(sender)) return;
    }
    if (!t.string(id) || !t.buffer(bfr)) {
      warn(`${sender?.UserId ?? "unknown"} has sent an invalid package.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`);
      return;
    }

    this._packets_inbound.push({
      id: id,
      sender: {
        userid: sender?.UserId ?? 0,
        instance: Players.GetPlayerByUserId(sender?.UserId ?? 0),
        attributes: sender?.GetAttributes() ?? new Map(),
      },
      timestamp: time(),
      content: bfr,
    });
  }

  ProcessIncomingPackets() {
    const packetsList = Object.deepCopy(this._packets_inbound);
    this._packets_inbound.clear();

    for (const pkt of packetsList) {
      const callbackList = this._bound_listeners.get(pkt.id);
      if (!callbackList || callbackList.size() <= 0) {
        if (RunService.IsStudio())
          warn(`Unbound network callback: ${pkt.id}`);
        else
          warn(`Unknown network callback: "${pkt.id}" sent from ${RunService.IsClient() ? "Server" : pkt.sender?.userid}`);

        continue;
      }

      for (const callback of callbackList)
        task.spawn(() => {
          callback(pkt.sender, pkt.content);
        });
    }

    packetsList.clear();
  }

  WritePacket(id: string, players = Players.GetPlayers(), ignore: Player[] = [], bfr: buffer) {
    if (this.post_to_remote) {
      if (RunService.IsServer())
        for (const user of players)
          if (!ignore.includes(user) && this.player_list.has(user))
            packetsRemoteEvent.FireClient(user, id, bfr);

      if (RunService.IsClient())
        packetsRemoteEvent.FireServer(id, bfr);
    }

    this.network_outgoing_signal.Fire(id, bfr);
  }

  WriteUnreliablePacket(id: string, players = Players.GetPlayers(), ignore: Player[] = [], bfr: buffer) {
    if (this.post_to_remote) {
      if (RunService.IsServer())
        for (const user of players)
          if (!ignore.includes(user) && this.player_list.has(user))
            unreliablePacketsRemoteEvent.FireClient(user, id, bfr);

      if (RunService.IsClient())
        unreliablePacketsRemoteEvent.FireServer(id, bfr);
    }

    this.network_outgoing_signal.Fire(id, bfr);
  }

  ListenPacket(id: string, callback: (sender: NetworkSenderInfo, bfr: buffer) => void) {
    const callbackList = this._bound_listeners.get(id) || [];
    callbackList.push(callback);

    if (!this._bound_listeners.has(id))
      this._bound_listeners.set(id, callbackList);
  }

  Destroy() {
    for (const conn of this._connections)
      conn.Disconnect();
    this._connections.clear();

    this._bound_listeners.clear();
    this._packets_inbound.clear();
  }
}

// # Bindings & misc
if (RunService.IsServer()) {
  DIRECT_MESSAGES_REMOTE.OnServerEvent.Connect((user, id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `User ${user.UserId} has sent an invalid DIRECT package.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `User ${user.UserId} has sent a unknown DIRECT package. "${id}"`;

    callback(user, bfr);
  });

  UNREL_DIRECT_MESSAGES_REMOTE.OnServerEvent.Connect((user, id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `User ${user.UserId} has sent an invalid (unreliable) DIRECT package.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `User ${user.UserId} has sent a unknown (unreliable) DIRECT package. "${id}"`;

    callback(user, bfr);
  });
} else {
  DIRECT_MESSAGES_REMOTE.OnClientEvent.Connect((id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `The server has sent an invalid DIRECT package.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `The server has sent a unknown DIRECT package. "${id}"`;

    callback(undefined, bfr);
  });

  UNREL_DIRECT_MESSAGES_REMOTE.OnClientEvent.Connect((id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `The server has sent an invalid (unreliable) DIRECT package.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `The server has sent a unknown (unreliable) DIRECT package. "${id}"`;

    callback(undefined, bfr);
  });
}
