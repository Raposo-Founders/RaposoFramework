import React from "@rbxts/react";
import CBindableSignal from "./util/signal";
import { mapStorageFolder } from "./folders";
import ReactRoblox from "@rbxts/react-roblox";

// # Types

// # Constants & variables
export const MAP_LOADED = new CBindableSignal();

// # Functions

// # Class
export class CWorld {
  reference: React.Ref<WorldModel>;

  constructor(name: string) {
    const targetMap = mapStorageFolder.FindFirstChild(name);
    assert(targetMap, `Unknown map ${name}.`);
    assert(targetMap.IsA("Folder"), `Map instance must be a Folder, got ${targetMap.ClassName}!`);

    // Build the element
    const worldRef = React.createRef<WorldModel>();
    const root = ReactRoblox.createRoot(workspace);

    React.useEffect(() => {
      targetMap.Clone().Parent = worldRef.current;
    });

    root.render(<worldmodel ref={worldRef} />);
  }
}

// # Bindings & logic

