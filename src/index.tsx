import BannerNotify from "@rbxts/banner-notify";
import React from "@rbxts/react";
import { ReplicatedStorage, RunService, StarterGui } from "@rbxts/services";
import { RaposoConsole } from "shared/cmd";
import { defaultEnvironments } from "shared/defaultinsts";
import { modulesFolder, uiFolder } from "shared/folders";
import { gameValues } from "shared/gamevalues";
import { listenDirectMessage } from "shared/network";
import ServerInstance from "shared/serverinst";
import { BufferReader } from "shared/util/bufferreader";
import { getInstanceFromPath } from "shared/util/instancepath";
import { ChatBar, ChatButton } from "UI/chatui";
import { CommandLine } from "UI/cmdline";
import ConsoleWindow from "UI/consolewindow";
import { defaultRoot } from "UI/default/values";
import { MainMenu } from "UI/mainmenu";


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
      Sound: import("shared/systems/sound").expect(),
      Playermngr: import("shared/systems/playermngr").expect(),
      Sessionmngr: import("shared/systems/sessionmngr").expect(),
      Chatmngr: import("shared/systems/chatmngr").expect(),
    },
    Environment: {
      Folders: import("shared/folders").expect(),
      Sessions: import("shared/serverinst").expect(),
      Network: import("shared/network").expect(),
      defaultEnvironments,
      util: {
        BufferReader: BufferReader,
        BufferWriter: import("shared/util/bufferwriter").expect(),
      }
    }
  };
}

// # Execution
if (RunService.IsClient())
  while (!game.IsLoaded()) task.wait();

if (RunService.IsClient()) {
  StarterGui.SetCoreGuiEnabled("All", false);
  WaitForServer();
}

// Import entities
{
  const [root, path] = $getModuleTree("shared/entities");
  for (const inst of getInstanceFromPath(root, path).GetChildren()) {
    if (!inst.IsA("ModuleScript")) continue;
    require(inst);
  }
}

if (RunService.IsServer())
  CleanUpWorkspace();

ImportSystems();

// Start backend scripts
import "scripts/userinput";

// Start game-defined modules
for (const inst of modulesFolder.GetChildren()) {
  if (!inst.IsA("ModuleScript")) continue;
  if (!inst.GetAttribute(`Execute${RunService.IsServer() ? "Server" : "Client"}`)) continue;

  task.spawn(() => {
    require(inst);
  });
}

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
    <MainMenu />
    <ConsoleWindow />
    <CommandLine />
    <ChatBar /><ChatButton />
  </>);
}
