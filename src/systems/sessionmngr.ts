import { Players, RunService, TextChatService } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { clientSessionConnected, clientSessionDisconnected, defaultEnvironments } from "defaultinsts";
import { EntityManager } from "entities";
import { LifecycleInstance } from "lifecycle";
import { listenDirectPacket, NetworkManager, sendDirectPacket } from "network";
import ServerInstance from "serverinst";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString, writeBufferU64, writeBufferU8 } from "util/bufferwriter";
import WorldInstance from "worldrender";

// # Interfaces & types
interface ConnectionQueueInfo {
  sessionId: string;
  nextCallId: SessionConnectionIds,
}

interface ServerListingInfo {
  sessionId: string;
  currentMap: string;
  players: Player[];
}

// # Constants & variables
enum SessionConnectionIds {
  Request = "d_sessionConnect",
  GetSessionInfo = "d_sessionGetInfo",
  MapLoaded = "d_sessionClientMapLoaded",
}

enum SessionConnectionReply {
  Allowed,
  Disallowed,
  NoExist,
  InternalErr,
}

const connectionStepCooldown = 1;
const playersConnectionQueue = new Map<Player, ConnectionQueueInfo>();

let canConnect = true;
let currentConnectionThread: thread | undefined;
let currentServerListFetchThread: thread | undefined;

// # Functions
export function clientConnectToServerSession(sessionId: string) {
  assert(RunService.IsClient(), "Function can only be called from the client.");
  assert(canConnect, "Function is on cooldown.");

  canConnect = false;
  currentConnectionThread = coroutine.running();

  print("Requesting connection to session:", sessionId);

  startBufferCreation();
  writeBufferString(sessionId);
  sendDirectPacket(SessionConnectionIds.Request, undefined);

  const connectionResult = coroutine.yield()[0] as SessionConnectionReply;
  if (connectionResult !== SessionConnectionReply.Allowed) {
    warn("Failed to connect to the session. ID: ", connectionResult);
    return;
  }

  task.wait(connectionStepCooldown);

  startBufferCreation();
  writeBufferString(sessionId);
  sendDirectPacket(SessionConnectionIds.GetSessionInfo, undefined);

  const mapName = tostring(coroutine.yield()[0]);

  task.wait(connectionStepCooldown);

  defaultEnvironments.entity?.murderAllFuckers();
  defaultEnvironments.world.loadMap(mapName);
  defaultEnvironments.world.rootInstance.Parent = workspace;

  task.wait(connectionStepCooldown);

  startBufferCreation();
  writeBufferString(sessionId);
  sendDirectPacket(SessionConnectionIds.MapLoaded, undefined);

  canConnect = true;
  currentConnectionThread = undefined;

  (TextChatService.WaitForChild("ChatInputBarConfiguration") as ChatInputBarConfiguration).TargetTextChannel = TextChatService.WaitForChild(sessionId) as TextChannel;

  warn("Finished connection to server!");
}

export function clientCreateLocalSession() {
  assert(RunService.IsClient(), "Function can only be called from the client.");

  const worldInstance = new WorldInstance("default");

  const serverInst = new ServerInstance(
    "local",
    worldInstance,
    new NetworkManager(),
    new EntityManager(worldInstance),
    new LifecycleInstance(),
  );
  defaultEnvironments.server = serverInst;

  serverInst.network.remoteEnabled = false;
  const serverSessionConnection = serverInst.network.packetsPosted.Connect(packets => {
    for (const packet of packets)
      defaultEnvironments.network.insertNetwork(packet);
  });

  defaultEnvironments.network.remoteEnabled = false;
  const clientSessionConnection = defaultEnvironments.network.packetsPosted.Connect(packets => {
    for (const packet of packets)
      serverInst.network.insertNetwork(packet);
  });

  serverInst.BindToClose(() => {
    serverSessionConnection.Disconnect();
    clientSessionConnection.Disconnect();

    defaultEnvironments.network.remoteEnabled = true;
    defaultEnvironments.server = undefined;
  });

  clientSessionConnected.Fire("local");

  serverInst.playerLeft.Connect(user => {
    if (user !== Players.LocalPlayer) return; // WHAT?
    serverInst.Close();
  });

  task.spawn(() => {
    task.wait(1);
    serverInst.InsertPlayer(Players.LocalPlayer);
  });
}

export function FetchServers() {
  assert(RunService.IsClient(), "Function can only be called from the client.");
  assert(!currentServerListFetchThread, "Function on cooldown.");

  currentServerListFetchThread = coroutine.running();

  startBufferCreation();
  sendDirectPacket("game_getservers", undefined);

  const [serversInfo] = coroutine.yield() as LuaTuple<[ServerListingInfo[]]>;

  return serversInfo;
}

// # Execution
new ConsoleFunctionCallback(["disconnect", "dc"], [])
  .setDescription("Disconnects from the current session.")
  .setCallback((ctx) => {
    ctx.Reply("Disconnecting from session...");

    startBufferCreation();
    sendDirectPacket("disconnect_request", undefined);
  });

new ConsoleFunctionCallback(["connect"], [{ name: "id", type: "string" }])
  .setDescription("Attempts to connect to a multiplayer session.")
  .setCallback((ctx) => {
    const sessionId = ctx.getArgument("id", "string").value;

    ctx.Reply(`Connecting to session: ${sessionId}...`);
    if (sessionId === "local")
      clientCreateLocalSession();
    else
      clientConnectToServerSession(sessionId);
  });

// Connection requests
if (RunService.IsServer())
  listenDirectPacket(SessionConnectionIds.Request, (sender, bfr) => {
    if (!sender) return;
    if (playersConnectionQueue.has(sender)) return;

    const reader = BufferReader(bfr);
    const sessionId = reader.string();

    if (!ServerInstance.runningInstances.has(sessionId)) {
      startBufferCreation();
      writeBufferU8(SessionConnectionReply.NoExist);
      sendDirectPacket("SESSION_CONNECTION_REPLY", sender);

      return;
    }

    startBufferCreation();
    writeBufferU8(SessionConnectionReply.Allowed);
    sendDirectPacket("SESSION_CONNECTION_REPLY", sender);

    playersConnectionQueue.set(sender, {
      sessionId: sessionId,
      nextCallId: SessionConnectionIds.GetSessionInfo,
    });
  });

// Getting info from sessions
if (RunService.IsServer())
  listenDirectPacket(SessionConnectionIds.GetSessionInfo, (sender, bfr) => {
    if (!sender) return;

    const reader = BufferReader(bfr);
    const sessionId = reader.string();

    const info = playersConnectionQueue.get(sender);
    if (!info || info.sessionId !== sessionId || info.nextCallId !== SessionConnectionIds.GetSessionInfo) return;

    const targetSession = ServerInstance.runningInstances.get(sessionId);
    if (!targetSession) return; // TODO: Better error handling

    startBufferCreation();
    writeBufferString("default"); // TODO: Change this.
    sendDirectPacket("SESSION_INFO_REPLY", sender);

    info.nextCallId = SessionConnectionIds.MapLoaded;
  });

// Finalize connection
if (RunService.IsServer())
  listenDirectPacket(SessionConnectionIds.MapLoaded, (sender, bfr) => {
    if (!sender) return;

    const reader = BufferReader(bfr);
    const sessionId = reader.string();

    const info = playersConnectionQueue.get(sender);
    if (!info || info.sessionId !== sessionId || info.nextCallId !== SessionConnectionIds.MapLoaded) return;

    const targetSession = ServerInstance.runningInstances.get(sessionId);
    if (!targetSession) return; // TODO: Better error handling

    targetSession.InsertPlayer(sender);

    playersConnectionQueue.delete(sender);
  });

// Receiving connection reply info
if (RunService.IsClient())
  listenDirectPacket("SESSION_CONNECTION_REPLY", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const reply = reader.u8() as SessionConnectionReply;

    if (!currentConnectionThread)
      return;

    coroutine.resume(currentConnectionThread, reply);
  });

// Receiving connection reply info
if (RunService.IsClient())
  listenDirectPacket("SESSION_INFO_REPLY", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const mapName = reader.string();

    if (!currentConnectionThread)
      return;

    coroutine.resume(currentConnectionThread, mapName);
  });

// Handling disconnections
if (RunService.IsClient())
  defaultEnvironments.network.listenPacket("server_disconnected", (packet) => {
    const reader = BufferReader(packet.content);
    const reason = reader.string();

    clientSessionDisconnected.Fire(reason, reason);

    warn("Disconnected from session. Reason:", reason);

    defaultEnvironments.entity.murderAllFuckers();
  });

// Fetching server list
if (RunService.IsServer())
  listenDirectPacket("game_getservers", (sender, bfr) => {
    if (!sender) return;

    startBufferCreation();
    writeBufferU8(ServerInstance.runningInstances.size());
    for (const [serverId, inst] of ServerInstance.runningInstances) {
      writeBufferString(serverId);
      writeBufferString(inst.world.currentMap);

      writeBufferU8(inst.trackingPlayers.size());
      for (const user of inst.trackingPlayers)
        writeBufferU64(user.UserId);
    }
    sendDirectPacket("game_getservers_reply", sender);
  });

// Receiving server list
if (RunService.IsClient())
  listenDirectPacket("game_getservers_reply", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const serverList: ServerListingInfo[] = [];
    const serversAmount = reader.u8();

    for (let i = 0; i < serversAmount; i++) {
      const serverId = reader.string();
      const currentMap = reader.string();
      const playersAmount = reader.u8();

      const players: Player[] = [];

      for (let i = 0; i < playersAmount; i++) {
        const user = Players.GetPlayerByUserId(reader.u64());
        if (!user) continue;

        players.push(user);
      }

      serverList.push({
        sessionId: serverId,
        currentMap: currentMap,
        players: players,
      });
    }

    if (currentServerListFetchThread)
      coroutine.resume(currentServerListFetchThread, serverList);
  });
