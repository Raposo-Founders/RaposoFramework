import { mapStorageFolder } from "./folders";
import { RandomString } from "./util/utilfuncs";

// # Types

// # Constants & variables
export const spawnedWorlds = new Map<string, WorldInstance>();

// # Functions

// # Classes
export default class WorldInstance {
  world_id = RandomString(10);
  root_instance = new Instance("WorldModel");

  parts: Instance;
  objects: Instance;

  constructor(mapName: string) {
    const mapInstance = mapStorageFolder.FindFirstChild(mapName)?.Clone();
    assert(mapInstance && mapInstance.IsA("Folder"), `Unknown map ${mapName} or invalid instance classname.`);

    this.parts = mapInstance.WaitForChild("Parts");
    this.objects = mapInstance.WaitForChild("Objects");
    mapInstance.Parent = this.root_instance;

    this.root_instance.Name = `world_${this.world_id}`;
    // this.root_instance.Parent = workspace;

    spawnedWorlds.set(this.world_id, this);
  }

  destroy() {
    this.root_instance.Destroy();
    spawnedWorlds.delete(this.world_id);
    table.clear(this);
  }
}

// # Execution
