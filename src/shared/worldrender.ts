import { mapStorageFolder } from "./folders";
import { RandomString } from "./util/utilfuncs";

// # Types

// # Constants & variables
export const spawnedWorlds = new Map<string, WorldInstance>();

// # Functions

// # Classes
export default class WorldInstance {
  id = RandomString(10);
  rootInstance = new Instance("Folder");

  parts: Instance;
  objects: Instance;

  constructor(mapName: string) {
    const mapInstance = mapStorageFolder.FindFirstChild(mapName)?.Clone();
    assert(mapInstance && mapInstance.IsA("Folder"), `Unknown map ${mapName} or invalid instance classname.`);

    this.parts = mapInstance.WaitForChild("Parts");
    this.objects = mapInstance.WaitForChild("Objects");
    mapInstance.Parent = this.rootInstance;

    this.rootInstance.Name = `world_${this.id}`;
    // this.root_instance.Parent = workspace;

    spawnedWorlds.set(this.id, this);
  }

  destroy() {
    this.rootInstance.Destroy();
    spawnedWorlds.delete(this.id);
    table.clear(this);
  }
}

// # Execution
