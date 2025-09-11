import { Players, RunService } from "@rbxts/services";
import { clientSessionConnected, clientSessionDisconnected, defaultEnvironments } from "shared/defaultinsts";
import { registerConsoleFunction } from "shared/cmd/cvar";
import { finishDirectMessage, listenDirectMessage, NetworkManager, startDirectMessage } from "shared/network";
import ServerInstance from "shared/serverinst";
import { BufferReader } from "shared/util/bufferreader";
import { writeBufferString, writeBufferU8 } from "shared/util/bufferwriter";
import WorldInstance from "shared/worldrender";
import { EntityManager } from "shared/entities";
import { LifecycleInstance } from "shared/lifecycle";

// # Interfaces & types
interface ConnectionQueueInfo {
  sessionId: string;
  nextCallId: SessionConnectionIds,
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

// # Execution
registerConsoleFunction(["disconnect", "dc"])((ctx) => {
  ctx.Reply("Disconnecting from session...");

  defaultEnvironments.network.startWritingMessage("disconnect_request", undefined, undefined);
  defaultEnvironments.network.finishWritingMessage();
});

registerConsoleFunction(["connect"], { name: "sessionId", number: false })((ctx, sessionId) => {
  ctx.Reply(`Connecting to session: ${sessionId}...`);

  if (sessionId === "local")
    ClientCreateLocalSession();
  else
    ClientConnectToServerSession(sessionId);
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
