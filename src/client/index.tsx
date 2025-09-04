import BannerNotify from "@rbxts/banner-notify";
import React from "@rbxts/react";
import { ReplicatedStorage } from "@rbxts/services";
import { clientSharedEnv } from "shared/clientshared";
import { modulesFolder } from "shared/folders";
import { CreateSoundGroup } from "shared/systems/sound";
import { BufferReader } from "shared/util/bufferreader";
import ConsoleWindow from "./UI/consolewindow";
import { defaultRoot } from "./UI/default/values";

// # Functions

// # Bindings & misc
while (!ReplicatedStorage.GetAttribute("ServerRunning")) task.wait();

_G.Systems = {};
_G.ClientEnv = import("shared/clientshared").expect();
_G.RaposoEnv = {
  folders: import("shared/folders").expect(),
  sessions: import("shared/session").expect(),
  network: import("shared/network").expect(),
  util: {
    BufferReader: BufferReader,
    BufferWriter: import("shared/util/bufferwriter").expect(),
  }
};

clientSharedEnv.lifecycle.BindTickrate(() => clientSharedEnv.netportal.ProcessIncomingPackets());
clientSharedEnv.lifecycle.BindTickrate((_, dt) => {
  for (const ent of clientSharedEnv.entityEnvironment.GetEntitiesThatIsA("BaseEntity")) {
    if (ent.entity_think_list.size() <= 0) continue;

    const rgCallbacks = ent.entity_think_list;
    for (const callback of rgCallbacks)
      task.spawn(callback, dt);
  }
});

// # Init
CreateSoundGroup("World");
CreateSoundGroup("Interface");

// Import systems
import("shared/cmd");
import("shared/recording");

import("shared/systems/sound").andThen((val) => _G.Systems["sound"] = val);
import("shared/systems/playermngr").andThen((val) => _G.Systems["playermngr"] = val);
import("shared/systems/sessionmngr").andThen((val) => _G.Systems["sessionmngr"] = val);

clientSharedEnv.lifecycle.running = true;

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

// ### TEST ###
defaultRoot.render(<ConsoleWindow />);
