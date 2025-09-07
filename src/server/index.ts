import BannerNotify from "@rbxts/banner-notify";
import { ReplicatedStorage, StarterGui } from "@rbxts/services";
import { modelsFolder, modulesFolder, uiFolder } from "shared/folders";
import { BufferReader } from "shared/util/bufferreader";

// # Constants & variables

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

for (const inst of StarterGui.GetChildren()) {
  inst.Parent = uiFolder;
}

// Import systems
_G.Systems = {};
import("shared/systems/sound").andThen((val) => _G.Systems["sound"] = val);
import("shared/systems/playermngr").andThen((val) => _G.Systems["playermngr"] = val);
import("shared/systems/sessionmngr").andThen((val) => _G.Systems["sessionmngr"] = val);

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

ReplicatedStorage.SetAttribute("ServerRunning", true);
