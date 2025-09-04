import { RunService } from "@rbxts/services";

// # Types
type T_GameFlags = "_debug";

// # Constants
const availableFlags = new Map<T_GameFlags, boolean>([
  ["_debug", RunService.IsStudio()],
  // ["_debug", false],
]);

const threadFlagsList = new Map<thread, Set<string>>();

// # Functions
export function SetFlagEnabled(name: T_GameFlags, value: boolean) {
  assert(availableFlags.has(name), "Unknown flag: " + name);

  availableFlags.set(name, value);
}

export function GetFlag(name: T_GameFlags) {
  if (!availableFlags.has(name)) warn("Attempt to fetch unknown flag:", name);
  return availableFlags.get(name) || false;
}
