import { Players, RunService } from "@rbxts/services";
import { clientSessionConnected, clientSessionDisconnected, clientSharedEnv } from "shared/clientshared";
import { RegisterConsoleCallback } from "shared/cmd/cvar";
import { CEntityEnvironment } from "shared/entities";
import { ListenDirectPacket, WriteDirectPacket } from "shared/network";
import CSessionInstance from "shared/session";
import { BufferReader } from "shared/util/bufferreader";
import { FinalizeBufferCreation, StartBufferCreation, WriteBufferString, WriteBufferU8 } from "shared/util/bufferwriter";
import CWorldInstance from "shared/worldrender";

// # Interfaces & types
interface I_ConnectionQueueInfo {
  sessionId: string;
  nextCallId: SESSION_CONNECTION_IDS,
}

// # Constants & variables
enum SESSION_CONNECTION_IDS {
  CONNECT_REQUEST = "d_sessionConnect",
  GET_SESSION_INFO = "d_sessionGetInfo",
  MAP_LOADED = "d_sessionClientMapLoaded",
}

enum SESSION_CONNECTION_REPLY {
  ALLOWED,
  DISALLOWED,
  NOEXIST,
  INTERNALERR,
}

const CONNECTION_STEP_COOLDOWN = 1;

const playersConnectionQueue = new Map<Player, I_ConnectionQueueInfo>();

let canConnect = true;
let currentConnectionThread: thread | undefined;

// # Functions
export function ClientConnectToServerSession(sessionId: string) {
  assert(RunService.IsClient(), "Function can only be called from the client.");
  assert(canConnect, "Function is on cooldown.");

  canConnect = false;
  currentConnectionThread = coroutine.running();

  print("Requesting connection to session:", sessionId);

  StartBufferCreation();
  WriteBufferString(sessionId);
  WriteDirectPacket(SESSION_CONNECTION_IDS.CONNECT_REQUEST, undefined, FinalizeBufferCreation());

  const connectionResult = coroutine.yield()[0] as SESSION_CONNECTION_REPLY;
  if (connectionResult !== SESSION_CONNECTION_REPLY.ALLOWED) {
    warn("Failed to connect to the session. ID: ", connectionResult);
    return;
  }

  task.wait(CONNECTION_STEP_COOLDOWN);

  StartBufferCreation();
  WriteBufferString(sessionId);
  WriteDirectPacket(SESSION_CONNECTION_IDS.GET_SESSION_INFO, undefined, FinalizeBufferCreation());

  const mapName = tostring(coroutine.yield()[0]);

  task.wait(CONNECTION_STEP_COOLDOWN);

  clientSharedEnv.entityEnvironment?.KillAllThoseBitchAsses();
  clientSharedEnv.worldInstance?.Destroy();

  clientSharedEnv.worldInstance = new CWorldInstance(mapName);
  clientSharedEnv.entityEnvironment = new CEntityEnvironment(clientSharedEnv.worldInstance);

  clientSharedEnv.worldInstance.root_instance.Parent = workspace;

  task.wait(CONNECTION_STEP_COOLDOWN);

  StartBufferCreation();
  WriteBufferString(sessionId);
  WriteDirectPacket(SESSION_CONNECTION_IDS.MAP_LOADED, undefined, FinalizeBufferCreation());

  canConnect = true;
  currentConnectionThread = undefined;

  warn("Finished connection to server!");
}

export function ClientCreateLocalSession() {
  assert(RunService.IsClient(), "Function can only be called from the client.");

  const serverSession = new CSessionInstance("local", "default");
  serverSession.network_env.post_to_remote = false;
  const serverSessionConnection = serverSession.network_env.network_outgoing_signal.Connect((id, bfr) => clientSharedEnv.netportal.NetworkIn(undefined, id, bfr));

  clientSharedEnv.netportal.post_to_remote = false;
  const clientSessionConnection = clientSharedEnv.netportal.network_outgoing_signal.Connect((id, bfr) => serverSession.network_env.NetworkIn(Players.LocalPlayer, id, bfr));

  serverSession.BindToClose(() => {
    serverSessionConnection.Disconnect();
    clientSessionConnection.Disconnect();

    clientSharedEnv.netportal.post_to_remote = true;
  });

  clientSessionConnected.Fire("local");

  serverSession.player_left.Connect(user => {
    if (user !== Players.LocalPlayer) return; // WHAT?
    serverSession.Close();
  });

  task.spawn(() => {
    task.wait(1);
    serverSession.InsertPlayer(Players.LocalPlayer);
  });
}

// # Execution
RegisterConsoleCallback(["disconnect", "dc"])((ctx) => {
  ctx.Reply("Disconnecting from session...");

  StartBufferCreation();
  clientSharedEnv.netportal.WritePacket("session_disconnect_request", undefined, undefined, FinalizeBufferCreation());
});

RegisterConsoleCallback(["connect"], { name: "sessionId", number: false })((ctx, sessionId) => {
  ctx.Reply(`Connecting to session: ${sessionId}...`);

  if (sessionId === "local")
    ClientCreateLocalSession();
  else
    ClientConnectToServerSession(sessionId);
});

// Connection requests
if (RunService.IsServer())
  ListenDirectPacket(SESSION_CONNECTION_IDS.CONNECT_REQUEST, (sender, bfr) => {
    if (!sender) return;
    if (playersConnectionQueue.has(sender)) return;

    const reader = BufferReader(bfr);
    const sessionId = reader.STRING();

    if (!CSessionInstance.running_sessions.has(sessionId)) {
      StartBufferCreation();
      WriteBufferU8(SESSION_CONNECTION_REPLY.NOEXIST);
      WriteDirectPacket("SESSION_CONNECTION_REPLY", sender, FinalizeBufferCreation());

      return;
    }

    StartBufferCreation();
    WriteBufferU8(SESSION_CONNECTION_REPLY.ALLOWED);
    WriteDirectPacket("SESSION_CONNECTION_REPLY", sender, FinalizeBufferCreation());

    playersConnectionQueue.set(sender, {
      sessionId: sessionId,
      nextCallId: SESSION_CONNECTION_IDS.GET_SESSION_INFO,
    });
  });

// Getting info from sessions
if (RunService.IsServer())
  ListenDirectPacket(SESSION_CONNECTION_IDS.GET_SESSION_INFO, (sender, bfr) => {
    if (!sender) return;

    const reader = BufferReader(bfr);
    const sessionId = reader.STRING();

    const info = playersConnectionQueue.get(sender);
    if (!info || info.sessionId !== sessionId || info.nextCallId !== SESSION_CONNECTION_IDS.GET_SESSION_INFO) return;

    const targetSession = CSessionInstance.running_sessions.get(sessionId);
    if (!targetSession) return; // TODO: Better error handling

    StartBufferCreation();
    WriteBufferString(targetSession.map);
    WriteDirectPacket("SESSION_INFO_REPLY", sender, FinalizeBufferCreation());

    info.nextCallId = SESSION_CONNECTION_IDS.MAP_LOADED;
  });

// Finalize connection
if (RunService.IsServer())
  ListenDirectPacket(SESSION_CONNECTION_IDS.MAP_LOADED, (sender, bfr) => {
    if (!sender) return;

    const reader = BufferReader(bfr);
    const sessionId = reader.STRING();

    const info = playersConnectionQueue.get(sender);
    if (!info || info.sessionId !== sessionId || info.nextCallId !== SESSION_CONNECTION_IDS.MAP_LOADED) return;

    const targetSession = CSessionInstance.running_sessions.get(sessionId);
    if (!targetSession) return; // TODO: Better error handling

    targetSession.InsertPlayer(sender);

    playersConnectionQueue.delete(sender);
  });

// Receiving connection reply info
if (RunService.IsClient())
  ListenDirectPacket("SESSION_CONNECTION_REPLY", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const reply = reader.U8() as SESSION_CONNECTION_REPLY;

    if (!currentConnectionThread)
      return;

    coroutine.resume(currentConnectionThread, reply);
  });

// Receiving connection reply info
if (RunService.IsClient())
  ListenDirectPacket("SESSION_INFO_REPLY", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const mapName = reader.STRING();

    if (!currentConnectionThread)
      return;

    coroutine.resume(currentConnectionThread, mapName);
  });

// Handling disconnections
if (RunService.IsClient())
  clientSharedEnv.netportal.ListenPacket("session_disconnected", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const reason = reader.STRING();

    clientSessionDisconnected.Fire(reason, reason);

    warn("Disconnected from session. Reason:", reason);

    clientSharedEnv.entityEnvironment.KillAllThoseBitchAsses();
  });

if (RunService.IsServer())
  new CSessionInstance("default", "default");