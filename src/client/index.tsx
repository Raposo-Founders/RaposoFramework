import BannerNotify from "@rbxts/banner-notify";
import React from "@rbxts/react";
import { Chat, ReplicatedStorage, StarterGui } from "@rbxts/services";
import { modulesFolder } from "shared/folders";
import { CreateSoundGroup } from "shared/systems/sound";
import { BufferReader } from "shared/util/bufferreader";
import ConsoleWindow from "./UI/consolewindow";
import { defaultRoot } from "./UI/default/values";
import { getInstanceFromPath } from "shared/util/instancepath";
import { defaultEnvironments } from "shared/defaultinsts";
import { MainMenu } from "./UI/mainmenu";
import conch from "shared/conch_pkg";
import { listenDirectMessage } from "shared/network";
import { gameValues } from "shared/gamevalues";
import { ChatBar, ChatButton } from "./UI/chatui";

// # Functions

// # Bindings & misc
while (!ReplicatedStorage.GetAttribute("ServerRunning")) task.wait();

StarterGui.SetCoreGuiEnabled("All", false);

conch.initiate_default_lifecycle();
conch.ui.bind_to(Enum.KeyCode.F2);

_G.Systems = {};
_G.ClientEnv = import("shared/defaultinsts").expect();
_G.RaposoEnv = {
  folders: import("shared/folders").expect(),
  sessions: import("shared/serverinst").expect(),
  network: import("shared/network").expect(),
  util: {
    BufferReader: BufferReader,
    BufferWriter: import("shared/util/bufferwriter").expect(),
  }
};

defaultEnvironments.lifecycle.BindTickrate(() => defaultEnvironments.network.processQueuedPackets());
defaultEnvironments.lifecycle.BindTickrate((_, dt) => {
  for (const [, entity] of defaultEnvironments.entity.entities)
    task.spawn(() => entity.Think(dt));
});
defaultEnvironments.lifecycle.running = true;

// # Init
CreateSoundGroup("World");
CreateSoundGroup("Interface");

// Import systems
import("shared/cmd");
import("shared/recording");

import("shared/systems/sound").andThen((val) => _G.Systems["sound"] = val);
import("shared/systems/playermngr").andThen((val) => _G.Systems["playermngr"] = val);
import("shared/systems/sessionmngr").andThen((val) => _G.Systems["sessionmngr"] = val);
import("shared/systems/chatmngr").andThen((val) => _G.Systems["chatmngr"] = val);

import("client/userinput");

// Import entities
{
  const [root, path] = $getModuleTree("shared/entities");
  for (const inst of getInstanceFromPath(root, path).GetChildren()) {
    if (!inst.IsA("ModuleScript")) continue;
    require(inst);
  }
}

// Start game-defined modules
for (const inst of modulesFolder.GetChildren()) {
  if (!inst.IsA("ModuleScript")) continue;
  if (!inst.GetAttribute("ExecuteClient")) continue;

  task.spawn(() => {
    require(inst);
  });
}

// Misc & other shit
BannerNotify.InitClient();

listenDirectMessage(gameValues.cmdnetinfo, (_, bfr) => {
  const reader = BufferReader(bfr);
  const message = reader.string();

  conch.log("normal", message);
});

// Build interface
// Shared UI
defaultRoot.render(<ConsoleWindow />);
defaultRoot.render(<MainMenu />);
defaultRoot.render(<><ChatBar /><ChatButton /></>);
