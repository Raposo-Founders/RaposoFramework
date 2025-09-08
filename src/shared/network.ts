import { t } from "@rbxts/t";
import { ReplicatedInstance } from "./util/utilfuncs";
import Signal from "./util/signal";
import { HttpService, Players, RunService } from "@rbxts/services";
import Object from "@rbxts/object-utils";
import { finalizeBufferCreation, startBufferCreation } from "./util/bufferwriter";

// # Types
interface MessageInfo {
  id: string;
  content: buffer;
  timestamp: number;
  sender?: number;
}

// # Constants
const MESSAGES_REMOTE = ReplicatedInstance(workspace, "NETWORK_PACKETS", "RemoteEvent");
const UNREL_MESSAGES_REMOTE = ReplicatedInstance(workspace, "NETWORK_UNRELIABLE_PACKETS", "UnreliableRemoteEvent");

const DIRECT_MESSAGES_REMOTE = ReplicatedInstance(workspace, "NETWORK_DIRECT_PACKETS", "RemoteEvent");
const UNREL_DIRECT_MESSAGES_REMOTE = ReplicatedInstance(workspace, "NETWORK_DIRECT_UNRELIABLE_PACKETS", "UnreliableRemoteEvent");

const boundDirectCallbacks = new Map<string, Callback>();
const writingDirectMessages = new Map<thread, { id: string, user: Player | undefined, unreliable: boolean }>();

// # Functions
export function startDirectMessage(id: string, user: Player | undefined = undefined, unreliable = false) {
  const thread = coroutine.running();
  if (writingDirectMessages.has(thread))
    throw "An direct message is already being written in the current thread.";

  if (RunService.IsServer() && !t.instanceIsA("Player")(user))
    throw `Argument #2 must be an player, got ${tostring(user)} (${typeOf(user)}).`;

  startBufferCreation();
  writingDirectMessages.set(thread, { id, user, unreliable });
}

export function finishDirectMessage() {
  const thread = coroutine.running();
  if (!writingDirectMessages.has(thread))
    throw "No direct messages have been started in the current thread.";

  const info = writingDirectMessages.get(thread)!;
  const bfr = finalizeBufferCreation();

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
export class NetworkManager {
  private messageQueue = new Array<MessageInfo>();
  private boundListeners = new Map<string, Callback[]>();
  private connections: RBXScriptConnection[] = [];
  private writingMessages = new Map<thread, { id: string, players: Player[], ignore: Player[], unreliable: boolean }>();

  networkOutgoing = new Signal<[id: string, bfr: buffer]>();
  postToRemote = true;

  readonly signedUsers = new Set<Player>();

  constructor() {
    if (RunService.IsServer()) {
      this.connections.push(MESSAGES_REMOTE.OnServerEvent.Connect((user, id, bfr) => this.insertNetwork(user, id as string, bfr as buffer)));
      this.connections.push(UNREL_MESSAGES_REMOTE.OnServerEvent.Connect((user, id, bfr) => this.insertNetwork(user, id as string, bfr as buffer)));
    } else {
      this.connections.push(MESSAGES_REMOTE.OnClientEvent.Connect((id, bfr) => this.insertNetwork(undefined, id as string, bfr as buffer)));
      this.connections.push(UNREL_MESSAGES_REMOTE.OnClientEvent.Connect((id, bfr) => this.insertNetwork(undefined, id as string, bfr as buffer)));
    }
  }

  insertNetwork(sender: Player | undefined, id: string, bfr: buffer) {
    if (RunService.IsServer()) {
      if (!sender) return;
      if (!this.signedUsers.has(sender)) return;
    }
    if (!t.string(id) || !t.buffer(bfr)) {
      warn(`${sender?.UserId ?? "unknown"} has sent an invalid message.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`);
      return;
    }

    this.messageQueue.push({
      id: id,
      sender: sender?.UserId,
      timestamp: time(),
      content: bfr,
    });
  }

  processQueuedPackets() {
    const messageQueue = Object.deepCopy(this.messageQueue);
    this.messageQueue.clear();

    for (const msg of messageQueue) {
      const callbackList = this.boundListeners.get(msg.id);
      if (!callbackList || callbackList.size() <= 0) {
        if (RunService.IsStudio())
          warn(`Unbound network callback: ${msg.id}`);
        else
          warn(`Unknown network callback: "${msg.id}" sent from ${RunService.IsClient() ? "Server" : msg.sender}`);

        continue;
      }

      for (const callback of callbackList)
        task.spawn(() => {
          callback(msg.sender, msg.content);
        });
    }

    messageQueue.clear();
  }

  startWritingMessage(id: string, players = Players.GetPlayers(), ignore: Player[] = [], unreliable = false) {
    const thread = coroutine.running();
    if (this.writingMessages.has(thread))
      throw "An message is already being written in the current thread.";

    this.writingMessages.set(thread, { id, players, ignore, unreliable });

    startBufferCreation();
  }

  finishWritingMessage() {
    const thread = coroutine.running();
    if (!this.writingMessages.has(thread))
      throw "No messages have been started in the current thread.";

    const info = this.writingMessages.get(thread)!;
    const bfr = finalizeBufferCreation();

    if (this.postToRemote) {
      if (RunService.IsServer())
        for (const user of info.players)
          if (!info.ignore.includes(user) && this.signedUsers.has(user))
            MESSAGES_REMOTE.FireClient(user, info.id, bfr);

      if (RunService.IsClient())
        MESSAGES_REMOTE.FireServer(info.id, bfr);
    }

    this.networkOutgoing.Fire(info.id, bfr);
    this.writingMessages.delete(thread);
  }

  listenPacket(id: string, callback: (sender: Player | undefined, bfr: buffer) => void) {
    const callbackList = this.boundListeners.get(id) || [];
    callbackList.push(callback);

    if (!this.boundListeners.has(id))
      this.boundListeners.set(id, callbackList);
  }

  Destroy() {
    for (const conn of this.connections)
      conn.Disconnect();
    this.connections.clear();

    this.boundListeners.clear();
    this.messageQueue.clear();
  }
}

// # Bindings & misc
if (RunService.IsServer()) {
  DIRECT_MESSAGES_REMOTE.OnServerEvent.Connect((user, id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `User ${user.UserId} has sent an invalid DIRECT message.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `User ${user.UserId} has sent a unknown DIRECT message. "${id}"`;

    callback(user, bfr);
  });

  UNREL_DIRECT_MESSAGES_REMOTE.OnServerEvent.Connect((user, id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `User ${user.UserId} has sent an invalid (unreliable) DIRECT message.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `User ${user.UserId} has sent a unknown (unreliable) DIRECT message. "${id}"`;

    callback(user, bfr);
  });
} else {
  DIRECT_MESSAGES_REMOTE.OnClientEvent.Connect((id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `The server has sent an invalid DIRECT message.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `The server has sent a unknown DIRECT message. "${id}"`;

    callback(undefined, bfr);
  });

  UNREL_DIRECT_MESSAGES_REMOTE.OnClientEvent.Connect((id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `The server has sent an invalid (unreliable) DIRECT message.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `The server has sent a unknown (unreliable) DIRECT message. "${id}"`;

    callback(undefined, bfr);
  });
}
