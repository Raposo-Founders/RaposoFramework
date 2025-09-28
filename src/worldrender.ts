import { mapStorageFolder } from "./folders";
import Signal from "./util/signal";
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

  mapChanged = new Signal<[name: string, inst: Instance]>();
  private temporaryFolder = new Instance("Folder");

  constructor(public currentMap: string) {
    this.parts = this.temporaryFolder;
    this.objects = this.temporaryFolder;

    if (currentMap !== "void")
      this.loadMap(currentMap);

    spawnedWorlds.set(this.id, this);
  }

  loadMap(name: string) {
    const mapInstance = mapStorageFolder.FindFirstChild(name);
    assert(mapInstance && mapInstance.IsA("Folder"), `Unknown map ${name} or invalid instance classname.`);

    print(`Loading map "${name}..."`);

    this.rootInstance.Destroy();
    this.rootInstance = new Instance("Folder");
    this.rootInstance.Name = `world_${this.id}`;

    for (const inst of mapInstance.GetChildren())
      inst.Clone().Parent = this.rootInstance;

    this.parts = this.rootInstance.WaitForChild("Parts");
    this.objects = this.rootInstance.WaitForChild("Objects");
    this.currentMap = name;

    this.mapChanged.Fire(name, this.rootInstance);
  }
}

// # Execution
