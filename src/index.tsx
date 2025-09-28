import BannerNotify from "@rbxts/banner-notify";
import React from "@rbxts/react";
import { ReplicatedStorage, RunService, StarterGui } from "@rbxts/services";
import { RaposoConsole } from "cmd";
import { defaultEnvironments } from "defaultinsts";
import { requireEntities } from "entities";
import { modulesFolder, uiFolder } from "folders";
import { gameValues } from "gamevalues";
import { listenDirectMessage } from "network";
import ServerInstance from "serverinst";
import { ChatBar, ChatButton } from "UI/chatui";
import { CommandLine } from "UI/cmdline";
import ConsoleWindow from "UI/consolewindow";
import { defaultRoot } from "UI/default/values";
import { HudPlayerPanel } from "UI/hud/playerpanel";
import { DisplayLoadingScreen, HideLoadingScreen } from "UI/loadscreen";
import { BufferReader } from "util/bufferreader";


// # Constants & variables

// # Functions
function CleanUpWorkspace() {
  if (!RunService.IsServer()) return;

  for (const inst of workspace.GetChildren()) {
    if (
      inst.IsA("Folder")
      || inst.IsA("Terrain")
      || inst.IsA("RemoteEvent")
      || inst.IsA("RemoteFunction")
      || inst.IsA("UnreliableRemoteEvent")
    ) continue;
    inst.Destroy();
  }

  for (const inst of StarterGui.GetChildren()) {
    inst.Parent = uiFolder;
  }
}

function WaitForServer() {
  if (!RunService.IsClient()) return;
  while (!ReplicatedStorage.GetAttribute("ServerRunning")) task.wait();
}

function ImportSystems() {
  _G.Raposo = {
    Systems: {
      Sound: import("systems/sound").expect(),
      Playermngr: import("systems/playermngr").expect(),
      Sessionmngr: import("systems/sessionmngr").expect(),
      Chatmngr: import("systems/chatmngr").expect(),
    },
    Environment: {
      Folders: import("folders").expect(),
      Sessions: import("serverinst").expect(),
      Network: import("network").expect(),
      defaultEnvironments,
      util: {
        BufferReader: BufferReader,
        BufferWriter: import("util/bufferwriter").expect(),
      }
    }
  };
}

function ExecuteModules() {
  for (const inst of modulesFolder.GetChildren()) {
    if (!inst.IsA("ModuleScript")) continue;
    if (!inst.GetAttribute(`Execute${RunService.IsServer() ? "Server" : "Client"}`)) continue;

    task.spawn(() => {
      require(inst);
    });
  }
}

// # Execution
if (RunService.IsClient())
  while (!game.IsLoaded()) task.wait();

if (RunService.IsClient()) {
  StarterGui.SetCoreGuiEnabled("All", false);
  WaitForServer();
}

requireEntities();

if (RunService.IsServer())
  CleanUpWorkspace();

ImportSystems();
ExecuteModules();

// Misc & other shit
if (RunService.IsServer())
  BannerNotify.InitServer(); // Why the fuck does the server need to be initialized?
else
  BannerNotify.InitClient();

if (RunService.IsClient()) {
  defaultEnvironments.lifecycle.BindTickrate(() => defaultEnvironments.network.processQueuedPackets());
  defaultEnvironments.lifecycle.BindTickrate((_, dt) => {
    for (const [, entity] of defaultEnvironments.entity.entities)
      task.spawn(() => entity.Think(dt));
  });
  defaultEnvironments.lifecycle.running = true;
}

if (RunService.IsServer()) {
  print("Starting.");

  defaultEnvironments.lifecycle.running = true;
  defaultEnvironments.entity.isServer = true;
  defaultEnvironments.server = new ServerInstance(
    "default",
    defaultEnvironments.world,
    defaultEnvironments.network,
    defaultEnvironments.entity,
    defaultEnvironments.lifecycle,
  );

  ReplicatedStorage.SetAttribute("ServerRunning", true);
}

if (RunService.IsClient()) {
  listenDirectMessage(gameValues.cmdnetinfo, (_, bfr) => {
    const reader = BufferReader(bfr);
    const message = reader.string();
  
    RaposoConsole.info(message);
  });
  
  // Build interface
  // Shared UI
  defaultRoot.render(<>
    <frame // 16:9 aspect ratio frame
      AnchorPoint={new Vector2(0.5, 0.5)}
      BackgroundTransparency={1}
      Position={UDim2.fromScale(0.5, 0.5)}
      Size={UDim2.fromScale(1, 1)}
    >
      <uiaspectratioconstraint AspectRatio={1.78} />
      <uipadding
        PaddingBottom={new UDim(0, 16)}
        PaddingLeft={new UDim(0, 16)}
        PaddingRight={new UDim(0, 16)}
        PaddingTop={new UDim(0, 16)}
      />

      <HudPlayerPanel />
    </frame>

    <ConsoleWindow />
    <CommandLine />
    <ChatBar /><ChatButton />
  </>);
}

if (!RunService.IsStudio())
  task.spawn(() => {
    DisplayLoadingScreen("Init")
    task.wait(10);
    HideLoadingScreen("Init")
  });
