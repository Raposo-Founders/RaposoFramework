import BannerNotify from "@rbxts/banner-notify";
import React from "@rbxts/react";
import { CollectionService, ReplicatedStorage, RunService, StarterGui } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import { requireEntities } from "entities";
import { mapStorageFolder, modulesFolder, uiFolder } from "folders";
import { gameValues } from "gamevalues";
import { RaposoConsole } from "logging";
import { listenDirectPacket } from "network";
import ServerInstance from "serverinst";
import { ChatBar, ChatButton } from "UI/chatui";
import { ChatWindow, RenderChatMessage } from "UI/chatui/chatwindow";
import { CommandLine } from "UI/cmdline";
import { ConsoleCommandsLogs } from "UI/cmdline/logs";
import { FairzoneCounter } from "UI/hud/fairzonetimer";
import { FairzoneTopDisplay } from "UI/hud/fairzonetopdisplay";
import { KillfeedDisplay } from "UI/hud/killfeedDisplay";
import { NotificationsDisplay } from "UI/hud/notificationmsg";
import { ObjectivesLine } from "UI/hud/objectivesDisplay";
import { HudPlayerPanel } from "UI/hud/playerpanel";
import { PlayersTopListing } from "UI/hud/playerteamentry";
import { SpectatorLabel } from "UI/hud/spectatinglabel";
import { SpectatorsList } from "UI/hud/spectatorslist";
import { DisplayLoadingScreen, HideLoadingScreen } from "UI/loadscreen";
import { defaultRoot, uiValues } from "UI/values";
import { BufferReader } from "util/bufferreader";
import { GetCreatorGroupInfo, GetGameName } from "util/groupsutil";


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
      Matchmngr: import("systems/matchmngr").expect(),
      HudMngr: import("systems/hudvalues").expect(),
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

function ParentMaps() {
  if (RunService.IsClient()) return;

  for (const inst of CollectionService.GetTagged(gameValues.maptag)) {
    if (!inst.IsA("Folder")) continue;
    inst.Parent = mapStorageFolder;
  }
}

// # Execution
if (RunService.IsClient())
  while (!game.IsLoaded()) task.wait();

ParentMaps();

GetCreatorGroupInfo(); // Pre-cache this thing
GetGameName();

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
  defaultEnvironments.lifecycle.BindTickrate((_, dt) => {
    defaultEnvironments.network.processPackets();

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
  listenDirectPacket(gameValues.cmdnetinfo, (_, bfr) => {
    const reader = BufferReader(bfr);
    const message = reader.string();
  
    RaposoConsole.Info(message);
    RenderChatMessage(message);
  });
  
  // Build interface
  // Shared UI
  defaultRoot.render(<>
    <frame // 16:9 aspect ratio gameplay frame
      AnchorPoint={new Vector2(0.5, 0.5)}
      BackgroundTransparency={1}
      Position={UDim2.fromScale(0.5, 0.5)}
      Size={UDim2.fromScale(1, 1)}
      // Visible={uiValues.hud_gameplay_visible[0]}
    >
      <uiaspectratioconstraint AspectRatio={1.78} />
      <uipadding
        PaddingBottom={new UDim(0, 16)}
        PaddingLeft={new UDim(0, 16)}
        PaddingRight={new UDim(0, 16)}
        PaddingTop={new UDim(0, 16)}
      />
      <HudPlayerPanel />

      <FairzoneTopDisplay>
        <PlayersTopListing team="Defenders" />
        <FairzoneCounter />
        <PlayersTopListing team="Raiders" />
      </FairzoneTopDisplay>

      <ObjectivesLine />

      <SpectatorLabel />

      <KillfeedDisplay />
    </frame>

    <frame // Non gameplay related stuff
      AnchorPoint={new Vector2(0.5, 0.5)}
      BackgroundColor3={new Color3()}
      BackgroundTransparency={0.5}
      Position={UDim2.fromScale(0.5, 0.5)}
      Size={UDim2.fromScale(1, 1)}
      Visible={uiValues.hud_gameplay_visible[0].map(val => !val)}
    >
      <uipadding
        PaddingBottom={new UDim(0, 16)}
        PaddingLeft={new UDim(0, 16)}
        PaddingRight={new UDim(0, 16)}
        PaddingTop={new UDim(0, 16)}
      />

      <SpectatorsList />
    </frame>

    <NotificationsDisplay />

    <CommandLine />
    <ConsoleCommandsLogs />

    <ChatBar />
    <ChatButton />
    <ChatWindow />
  </>);
}

if (!RunService.IsStudio())
  task.spawn(() => {
    DisplayLoadingScreen("Init")
    task.wait(10);
    HideLoadingScreen("Init")
  });
