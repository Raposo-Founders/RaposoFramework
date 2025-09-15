import { Players, RunService } from "@rbxts/services";
import { registerConsoleFunction } from "shared/cmd/cvar";
import conch from "shared/conch_pkg";
import { clientSessionConnected, clientSessionDisconnected, defaultEnvironments } from "shared/defaultinsts";
import { EntityManager } from "shared/entities";
import { LifecycleInstance } from "shared/lifecycle";
import { finishDirectMessage, listenDirectMessage, NetworkManager, startDirectMessage } from "shared/network";
import ServerInstance from "shared/serverinst";
import { BufferReader } from "shared/util/bufferreader";
import { writeBufferString, writeBufferU64, writeBufferU8 } from "shared/util/bufferwriter";
import WorldInstance from "shared/worldrender";

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
export function ClientConnectToServerSession(sessionId: string) {
  assert(RunService.IsClient(), "Function can only be called from the client.");
  assert(canConnect, "Function is on cooldown.");

  canConnect = false;
  currentConnectionThread = coroutine.running();

  print("Requesting connection to session:", sessionId);

  startDirectMessage(SessionConnectionIds.Request, undefined);
  writeBufferString(sessionId);
  finishDirectMessage();

  const connectionResult = coroutine.yield()[0] as SessionConnectionReply;
  if (connectionResult !== SessionConnectionReply.Allowed) {
    warn("Failed to connect to the session. ID: ", connectionResult);
    return;
  }

  task.wait(connectionStepCooldown);

  startDirectMessage(SessionConnectionIds.GetSessionInfo, undefined);
  writeBufferString(sessionId);
  finishDirectMessage();

  const mapName = tostring(coroutine.yield()[0]);

  task.wait(connectionStepCooldown);

  defaultEnvironments.entity?.murderAllFuckers();
  defaultEnvironments.world.loadMap(mapName);
  defaultEnvironments.world.rootInstance.Parent = workspace;

  task.wait(connectionStepCooldown);

  startDirectMessage(SessionConnectionIds.MapLoaded, undefined);
  writeBufferString(sessionId);
  finishDirectMessage();

  canConnect = true;
  currentConnectionThread = undefined;

  warn("Finished connection to server!");
}

export function ClientCreateLocalSession() {
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

  serverInst.network.postToRemote = false;
  const serverSessionConnection = serverInst.network.networkOutgoing.Connect((id, bfr) => defaultEnvironments.network.insertNetwork(undefined, id, bfr));

  defaultEnvironments.network.postToRemote = false;
  const clientSessionConnection = defaultEnvironments.network.networkOutgoing.Connect((id, bfr) => serverInst.network.insertNetwork(Players.LocalPlayer, id, bfr));

  serverInst.BindToClose(() => {
    serverSessionConnection.Disconnect();
    clientSessionConnection.Disconnect();

    defaultEnvironments.network.postToRemote = true;
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

  startDirectMessage("game_getservers");
  finishDirectMessage();

  const [serversInfo] = coroutine.yield() as LuaTuple<[ServerListingInfo[]]>;

  return serversInfo;
}

// # Execution
registerConsoleFunction(["disconnect", "dc"], [], "Disconnects from the current session.")((ctx) => {
  ctx.Reply("Disconnecting from session...");

  defaultEnvironments.network.startWritingMessage("disconnect_request", undefined, undefined);
  defaultEnvironments.network.finishWritingMessage();
});

registerConsoleFunction(["connect"], [conch.args.string("ServerId")], "Join the current server's session.")((ctx, sessionId) => {
  ctx.Reply(`Connecting to session: ${sessionId}...`);

  if (sessionId === "local")
    ClientCreateLocalSession();
  else
    ClientConnectToServerSession(sessionId);
});

registerConsoleFunction(["kick"], [conch.args.player(), conch.args.strings("Reason", "Reason for kicking the player.")])((context, player, reason) => {
  warn("WIP", player, reason);
});

// Connection requests
if (RunService.IsServer())
  listenDirectMessage(SessionConnectionIds.Request, (sender, bfr) => {
    if (!sender) return;
    if (playersConnectionQueue.has(sender)) return;

    const reader = BufferReader(bfr);
    const sessionId = reader.string();

    if (!ServerInstance.runningInstances.has(sessionId)) {
      startDirectMessage("SESSION_CONNECTION_REPLY", sender);
      writeBufferU8(SessionConnectionReply.NoExist);
      finishDirectMessage();

      return;
    }

    startDirectMessage("SESSION_CONNECTION_REPLY", sender);
    writeBufferU8(SessionConnectionReply.Allowed);
    finishDirectMessage();

    playersConnectionQueue.set(sender, {
      sessionId: sessionId,
      nextCallId: SessionConnectionIds.GetSessionInfo,
    });
  });

// Getting info from sessions
if (RunService.IsServer())
  listenDirectMessage(SessionConnectionIds.GetSessionInfo, (sender, bfr) => {
    if (!sender) return;

    const reader = BufferReader(bfr);
    const sessionId = reader.string();

    const info = playersConnectionQueue.get(sender);
    if (!info || info.sessionId !== sessionId || info.nextCallId !== SessionConnectionIds.GetSessionInfo) return;

    const targetSession = ServerInstance.runningInstances.get(sessionId);
    if (!targetSession) return; // TODO: Better error handling

    startDirectMessage("SESSION_INFO_REPLY", sender);
    writeBufferString("default"); // TODO: Change this.
    finishDirectMessage();

    info.nextCallId = SessionConnectionIds.MapLoaded;
  });

// Finalize connection
if (RunService.IsServer())
  listenDirectMessage(SessionConnectionIds.MapLoaded, (sender, bfr) => {
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
  listenDirectMessage("SESSION_CONNECTION_REPLY", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const reply = reader.u8() as SessionConnectionReply;

    if (!currentConnectionThread)
      return;

    coroutine.resume(currentConnectionThread, reply);
  });

// Receiving connection reply info
if (RunService.IsClient())
  listenDirectMessage("SESSION_INFO_REPLY", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const mapName = reader.string();

    if (!currentConnectionThread)
      return;

    coroutine.resume(currentConnectionThread, mapName);
  });

// Handling disconnections
if (RunService.IsClient())
  defaultEnvironments.network.listenPacket("server_disconnected", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const reason = reader.string();

    clientSessionDisconnected.Fire(reason, reason);

    warn("Disconnected from session. Reason:", reason);

    defaultEnvironments.entity.murderAllFuckers();
  });

// Fetching server list
if (RunService.IsServer())
  listenDirectMessage("game_getservers", (sender, bfr) => {
    if (!sender) return;

    startDirectMessage("game_getservers_reply", sender, false);
    writeBufferU8(ServerInstance.runningInstances.size());
    for (const [serverId, inst] of ServerInstance.runningInstances) {
      writeBufferString(serverId);
      writeBufferString(inst.world.currentMap);

      writeBufferU8(inst.trackingPlayers.size());
      for (const user of inst.trackingPlayers)
        writeBufferU64(user.UserId);
    }
    finishDirectMessage();
  });

// Receiving server list
if (RunService.IsClient())
  listenDirectMessage("game_getservers_reply", (sender, bfr) => {
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
