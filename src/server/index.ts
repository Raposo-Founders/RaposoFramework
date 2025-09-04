import BannerNotify from "@rbxts/banner-notify";
import { ReplicatedStorage, StarterGui } from "@rbxts/services";
import { modelsFolder, modulesFolder, uiFolder } from "shared/folders";
import { ListenDirectPacket } from "shared/network";
import CSessionInstance from "shared/session";
import { BufferReader } from "shared/util/bufferreader";

// # Constants

// # Variables
let defaultSession: CSessionInstance | undefined;

// # Functions
function CleanUpWorkspace() {
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
}

// # Bindings & misc
ListenDirectPacket("d_connectToPortal", (user, bfr) => {
  if (!user) return;

  const reader = BufferReader(bfr);
  const sessionId = reader.STRING();

  if (sessionId === "default") {
    if (!defaultSession) {
      defaultSession = new CSessionInstance("default", "default");

      game.BindToClose(() => defaultSession?.Close());
    }

    defaultSession.InsertPlayer(user);
  }
});

for (const inst of StarterGui.GetChildren()) {
  inst.Parent = uiFolder;
}

// Import systems
_G.Systems = {};
import("shared/systems/sound").andThen((val) => _G.Systems["sound"] = val);
import("shared/systems/playermngr").andThen((val) => _G.Systems["playermngr"] = val);
import("shared/systems/sessionmngr").andThen((val) => _G.Systems["sessionmngr"] = val);

import("./newsFetcher");

_G.ClientEnv = undefined;
_G.RaposoEnv = {
  folders: import("shared/folders").expect(),
  sessions: import("shared/session").expect(),
  network: import("shared/network").expect(),
  util: {
    BufferReader: BufferReader,
    BufferWriter: import("shared/util/bufferwriter").expect(),
  }
};

CleanUpWorkspace();

// Start game-defined modules
for (const inst of modulesFolder.GetChildren()) {
  if (!inst.IsA("ModuleScript")) continue;
  if (!inst.GetAttribute("ExecuteServer")) continue;

  task.spawn(() => {
    require(inst);
  });
}

// Misc & other shit
BannerNotify.InitServer(); // Why the fuck does the server need to be initialized?

modelsFolder.WaitForChild("CheezIt"); // ALL HAIL THE LOAD BEARING CHEEZIT!;

ReplicatedStorage.SetAttribute("ServerRunning", true);
