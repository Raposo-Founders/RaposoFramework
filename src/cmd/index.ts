import { HttpService, RunService } from "@rbxts/services";
import { t } from "@rbxts/t";
import Signal from "util/signal";
import { ConsoleFunctionCallback, createdCVars, cvarFlags, CFUNC_REPLY_POST } from "./cvar";
import { RaposoConsole } from "logging";

// # Constants & variables
export const COMMAND_EXECUTED = new Signal<[name: string, args: string[]]>();

// # Functions
function FormatCommandString(text: string) {
  return text.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
}

export async function ExecuteCommand(content: string) {
  assert(RunService.IsClient(), "Function can only be called from the client.");

  const args = FormatCommandString(content).split(" ");
  if (args.size() <= 0) return;

  const name = args.shift() ?? "";
  const targetVariable = createdCVars.get(name);
  let targetCallback: ConsoleFunctionCallback | undefined;

  for (const consoleFunc of ConsoleFunctionCallback.list) {
    if (!consoleFunc.names.includes(name)) continue;
    targetCallback = consoleFunc;
    break;
  }

  if (targetVariable) {
    const value1 = args.shift();
    const numValue1 = tonumber(value1);

    if (!value1) {
      print(`${targetVariable.name}: ${tostring(targetVariable.Get())} [${targetVariable.type}]`);
    }

    if (targetVariable.flags.includes(cvarFlags.readonly)) {
      RaposoConsole.Error(`CVar ${name} is read only.`);
      return;
    }

    if (targetVariable.type === "number") {
      if (!numValue1) {
        RaposoConsole.Error(`Value must be a number, got string.`);
        return;
      }
      targetVariable.Set(numValue1);
    }

    if (targetVariable.type === "string")
      targetVariable.Set(value1);

    print(`${name} set to ${value1}`);
    return;
  }

  if (targetCallback) {
    COMMAND_EXECUTED.Fire(targetCallback.names[0], args);
    targetCallback.execute(args);
    return;
  }

  RaposoConsole.Warn(`Unknown command "${content}".`);
}

// # Bindings & misc
CFUNC_REPLY_POST.Connect((level, message) => {
  if (level === "info") RaposoConsole.Info(message);
  if (level === "warn") RaposoConsole.Warn(message);
  if (level === "error") RaposoConsole.Error(message);
});

for (const inst of script.WaitForChild("commands").GetChildren()) {
  if (inst.IsA("ModuleScript"))
    task.spawn(require, inst);
}
