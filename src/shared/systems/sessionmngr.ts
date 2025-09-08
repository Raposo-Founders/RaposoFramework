import { Players, RunService } from "@rbxts/services";
import { clientSessionConnected, clientSessionDisconnected, clientSharedEnv } from "shared/clientshared";
import { registerConsoleFunction } from "shared/cmd/cvar";
import { EntityManager } from "shared/entities";
import { finishDirectMessage, listenDirectMessage, startDirectMessage } from "shared/network";
import CSessionInstance from "shared/session";
import { BufferReader } from "shared/util/bufferreader";
import { writeBufferString, writeBufferU8 } from "shared/util/bufferwriter";
import WorldInstance from "shared/worldrender";

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

  clientSharedEnv.entityEnvironment?.murderAllFuckers();
  clientSharedEnv.worldInstance?.destroy();

  clientSharedEnv.worldInstance = new WorldInstance(mapName);
  clientSharedEnv.entityEnvironment = new EntityManager(clientSharedEnv.worldInstance);

  clientSharedEnv.worldInstance.rootInstance.Parent = workspace;

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

  const serverSession = new CSessionInstance("local", "default");
  serverSession.networkManager.postToRemote = false;
  const serverSessionConnection = serverSession.networkManager.networkOutgoing.Connect((id, bfr) => clientSharedEnv.netportal.insertNetwork(undefined, id, bfr));

  clientSharedEnv.netportal.postToRemote = false;
  const clientSessionConnection = clientSharedEnv.netportal.networkOutgoing.Connect((id, bfr) => serverSession.networkManager.insertNetwork(Players.LocalPlayer, id, bfr));

  serverSession.BindToClose(() => {
    serverSessionConnection.Disconnect();
    clientSessionConnection.Disconnect();

    clientSharedEnv.netportal.postToRemote = true;
  });

  clientSessionConnected.Fire("local");

  serverSession.playerLeft.Connect(user => {
    if (user !== Players.LocalPlayer) return; // WHAT?
    serverSession.Close();
  });

  task.spawn(() => {
    task.wait(1);
    serverSession.InsertPlayer(Players.LocalPlayer);
  });
}

// # Execution
registerConsoleFunction(["disconnect", "dc"])((ctx) => {
  ctx.Reply("Disconnecting from session...");

  clientSharedEnv.netportal.startWritingMessage("session_disconnect_request", undefined, undefined);
  clientSharedEnv.netportal.finishWritingMessage();
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

    if (!CSessionInstance.runningSessions.has(sessionId)) {
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

    const targetSession = CSessionInstance.runningSessions.get(sessionId);
    if (!targetSession) return; // TODO: Better error handling

    startDirectMessage("SESSION_INFO_REPLY", sender);
    writeBufferString(targetSession.map);
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

    const targetSession = CSessionInstance.runningSessions.get(sessionId);
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
  clientSharedEnv.netportal.listenPacket("session_disconnected", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const reason = reader.string();

    clientSessionDisconnected.Fire(reason, reason);

    warn("Disconnected from session. Reason:", reason);

    clientSharedEnv.entityEnvironment.murderAllFuckers();
  });

if (RunService.IsServer())
  new CSessionInstance("default", "default");