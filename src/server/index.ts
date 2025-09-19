import BannerNotify from "@rbxts/banner-notify";
import { ReplicatedStorage, StarterGui } from "@rbxts/services";
import { defaultEnvironments } from "shared/defaultinsts";
import { modulesFolder, uiFolder } from "shared/folders";
import ServerInstance from "shared/serverinst";
import { BufferReader } from "shared/util/bufferreader";
import { getInstanceFromPath } from "shared/util/instancepath";
import conch from "shared/conch_pkg";

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

// # Initialize
conch.initiate_default_lifecycle();

for (const inst of StarterGui.GetChildren()) {
  inst.Parent = uiFolder;
}

// Import systems
_G.Systems = {};
import("shared/systems/sound").andThen((val) => _G.Systems["sound"] = val);
import("shared/systems/playermngr").andThen((val) => _G.Systems["playermngr"] = val);
import("shared/systems/sessionmngr").andThen((val) => _G.Systems["sessionmngr"] = val);
import("shared/systems/chatmngr").andThen((val) => _G.Systems["chatmngr"] = val);

_G.ClientEnv = undefined;
_G.RaposoEnv = {
  folders: import("shared/folders").expect(),
  sessions: import("shared/serverinst").expect(),
  network: import("shared/network").expect(),
  util: {
    BufferReader: BufferReader,
    BufferWriter: import("shared/util/bufferwriter").expect(),
  }
};

// Import entities
{
  const [root, path] = $getModuleTree("shared/entities");
  for (const inst of getInstanceFromPath(root, path).GetChildren()) {
    if (!inst.IsA("ModuleScript")) continue;
    require(inst);
  }
}

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
