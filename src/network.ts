import Object from "@rbxts/object-utils";
import { Players, RunService } from "@rbxts/services";
import { t } from "@rbxts/t";
import { finalizeBufferCreation } from "util/bufferwriter";
import Signal from "./util/signal";
import { ReplicatedInstance } from "./util/utilfuncs";

// # Types
interface PacketInfo {
  id: string;
  sender: Player | undefined;
  timestamp: number;
  content: buffer;
}

interface PacketOutgoingInfo {
  packet: PacketInfo;
  recipients: Set<Player>;
  unreliable: boolean;
}

// # Constants
const REMOTE_EVENT = ReplicatedInstance(workspace, "MESSAGES", "RemoteEvent");
const UNREL_REMOTE_EVENT = ReplicatedInstance(workspace, "UNREL_MESSAGES", "UnreliableRemoteEvent");

const DIRECT_REMOTE = ReplicatedInstance(workspace, "DIR_MESSAGES", "RemoteEvent");
const UNREL_DIRECT_REMOTE = ReplicatedInstance(workspace, "UNREL_DIR_MESSAGES", "UnreliableRemoteEvent");

const boundDirectCallbacks = new Map<string, Callback>();

const ASSERT_PACKET_CHECK = t.interface({
  id: t.string,
  sender: t.optional(t.instanceIsA("Player")),
  timestamp: t.number,
  content: t.buffer,
});

// # Functions
function HandleInfraction(user: Player | undefined, obj: unknown) {
  warn(`Player ${user?.Name} (${user?.UserId}) has sent an unknown object type.`, typeOf(obj), obj);
}

export function sendDirectPacket(id: string, user: Player | undefined, unreliable = false) {
  const bfr = finalizeBufferCreation();

  if (RunService.IsServer())
    assert(user, "Server packets must contain a recipient!");

  if (RunService.IsClient())
    if (unreliable)
      UNREL_DIRECT_REMOTE.FireServer(id, bfr);
    else
      DIRECT_REMOTE.FireServer(id, bfr);

  if (RunService.IsServer())
    if (unreliable)
      UNREL_DIRECT_REMOTE.FireClient(user!, id, bfr);
    else
      DIRECT_REMOTE.FireClient(user!, id, bfr);
}

export function listenDirectPacket(id: string, callback: (sender: Player | undefined, bfr: buffer) => void) {
  assert(!boundDirectCallbacks.has(id), `Direct package id "${id}" already contains a listener.`);
  boundDirectCallbacks.set(id, callback);
}

// # Class
export class NetworkManager {
  private boundListeners = new Map<string, Callback[]>();
  private connections: RBXScriptConnection[] = [];

  remoteEnabled = true;
  private incomingPackets = new Array<PacketInfo>();
  packetsPosted = new Signal<[packets: PacketInfo[]]>();
  outgoingPackets: PacketOutgoingInfo[] = [];

  readonly signedUsers = new Set<Player>();

  constructor() {
    let reliableConnection: RBXScriptConnection;
    let unreliableConnection: RBXScriptConnection;

    if (RunService.IsServer()) {
      reliableConnection = REMOTE_EVENT.OnServerEvent.Connect((user, content) => {
        if (!t.array(ASSERT_PACKET_CHECK)(content)) {
          HandleInfraction(user, content);
          return;
        }

        for (const packet of content)
          this.insertNetwork(packet);
      });
      unreliableConnection = UNREL_REMOTE_EVENT.OnServerEvent.Connect((user, content) => {
        if (!t.array(ASSERT_PACKET_CHECK)(content)) {
          HandleInfraction(user, content);
          return;
        }

        for (const packet of content)
          this.insertNetwork(packet);
      });
    } else {
      reliableConnection = REMOTE_EVENT.OnClientEvent.Connect((content) => {
        if (!t.array(ASSERT_PACKET_CHECK)(content)) {
          HandleInfraction(undefined, content);
          return;
        }

        for (const packet of content)
          this.insertNetwork(packet);
      });
      unreliableConnection = UNREL_REMOTE_EVENT.OnClientEvent.Connect((content) => {
        if (!t.array(ASSERT_PACKET_CHECK)(content)) {
          HandleInfraction(undefined, content);
          return;
        }

        for (const packet of content)
          this.insertNetwork(packet);
      });
    }

    this.connections.push(reliableConnection, unreliableConnection);
  }

  insertNetwork(packet: PacketInfo) {
    if (!ASSERT_PACKET_CHECK(packet)) {
      if (RunService.IsStudio()) warn("Packet failed checking!", packet);
      return;
    }

    if (RunService.IsServer() && !packet.sender) return;
    if (RunService.IsServer() && packet.sender && !this.signedUsers.has(packet.sender)) {
      print("User is not signed."); return; 
    }

    this.incomingPackets.push(packet);
  }

  processPackets() {
    const clonedIncomingPacketsList = Object.deepCopy(this.incomingPackets);
    const clonedOutgoingPacketsList = Object.deepCopy(this.outgoingPackets);

    this.incomingPackets.clear();
    this.outgoingPackets.clear();

    for (const packet of clonedIncomingPacketsList) {
      const callbackList = this.boundListeners.get(packet.id);
      if (!callbackList || callbackList.size() <= 0) {
        if (RunService.IsStudio())
          warn(`Unbound network callback: ${packet.id}`);
        else
          warn(`Unknown network callback: "${packet.id}" sent from ${RunService.IsClient() ? "Server" : packet.sender?.UserId}`);

        continue;
      }

      for (const callback of callbackList)
        task.spawn(callback, packet);
    }

    // -- Process outgoing packets
    // If this is the client, then just send it all without checking
    if (RunService.IsClient()) {
      const outgoingReliable: PacketInfo[] = [];
      const outgoingUnreliable: PacketInfo[] = [];
      const totalOutgoingPackets: PacketInfo[] = [];

      for (const packet of clonedOutgoingPacketsList) {
        if (packet.unreliable)
          outgoingReliable.push(packet.packet);
        else
          outgoingUnreliable.push(packet.packet);

        totalOutgoingPackets.push(packet.packet);
      }

      this.packetsPosted.Fire(totalOutgoingPackets);
      if (this.remoteEnabled) {
        if (outgoingReliable.size() > 0) REMOTE_EVENT.FireServer(outgoingReliable);
        if (outgoingUnreliable.size() > 0) UNREL_REMOTE_EVENT.FireServer(outgoingUnreliable);
      }

      outgoingReliable.clear();
      outgoingUnreliable.clear();
      totalOutgoingPackets.clear(); // Might be risky, since we're erasing the original reference
    }

    // Process server
    if (RunService.IsServer()) {
      const playersOutgoingPackets = new Map<Player, [PacketInfo[], PacketInfo[]]>(); // [Reliable, Unreliable]

      for (const packet of clonedOutgoingPacketsList) {
        for (const user of packet.recipients) {
          if (!user.IsDescendantOf(Players)) continue;

          const list = playersOutgoingPackets.get(user) || [[], []];

          if (packet.unreliable)
            list[1].push(packet.packet);
          else
            list[0].push(packet.packet);

          if (!playersOutgoingPackets.has(user))
            playersOutgoingPackets.set(user, list);
        }
      }

      // Server ignores if the remote is enabled or not.
      for (const [user, packetList] of playersOutgoingPackets) {
        if (packetList[0].size() > 0)
          REMOTE_EVENT.FireClient(user, packetList[0]);
        if (packetList[1].size() > 0)
          UNREL_DIRECT_REMOTE.FireClient(user, packetList[1]);
      }

      // print("Reached end.", clonedOutgoingPacketsList);
    }

    clonedIncomingPacketsList.clear();
    clonedOutgoingPacketsList.clear();
  }

  sendPacket(id: string, players = Players.GetPlayers(), ignore: Player[] = [], unreliable = false) {
    const bfr = finalizeBufferCreation();
    const filteredPlayerList = new Set<Player>();

    for (const user of players) {
      if (!user.IsDescendantOf(Players) || ignore.includes(user) || !this.signedUsers.has(user)) continue;
      filteredPlayerList.add(user);
    }

    const packet: PacketInfo = {
      id,
      sender: Players.LocalPlayer, // Will be *nil* on the server-side
      timestamp: workspace.GetServerTimeNow(),
      content: bfr,
    };

    this.outgoingPackets.push({
      packet,
      recipients: filteredPlayerList,
      unreliable,
    });
  }

  listenPacket(id: string, callback: (info: PacketInfo) => void) {
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
    this.incomingPackets.clear();
  }
}

// # Bindings & misc
if (RunService.IsServer()) {
  DIRECT_REMOTE.OnServerEvent.Connect((user, id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `User ${user.UserId} has sent an invalid DIRECT packet.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `User ${user.UserId} has sent a unknown DIRECT packet. "${id}"`;

    callback(user, bfr);
  });

  UNREL_DIRECT_REMOTE.OnServerEvent.Connect((user, id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `User ${user.UserId} has sent an invalid (unreliable) DIRECT packet.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `User ${user.UserId} has sent a unknown (unreliable) DIRECT packet. "${id}"`;

    callback(user, bfr);
  });
} else {
  DIRECT_REMOTE.OnClientEvent.Connect((id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `The server has sent an invalid DIRECT packet.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `The server has sent a unknown DIRECT packet. "${id}"`;

    callback(undefined, bfr);
  });

  UNREL_DIRECT_REMOTE.OnClientEvent.Connect((id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `The server has sent an invalid (unreliable) DIRECT packet.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `The server has sent a unknown (unreliable) DIRECT packet. "${id}"`;

    callback(undefined, bfr);
  });
}
