import { LogService, Players, RunService, TextChatService } from "@rbxts/services";
import { createdCVars, registeredCallbacks, cvarFlags, executeConsoleFunction } from "./cvar";
import { gameValues } from "shared/gamevalues";
import conch from "shared/conch_pkg";

// # Constants & variables

// # Functions
export function GetCVarFromName(name: string) {
  const target = createdCVars.get(name);

  if (!target) {
    warn(`Attempt to get unknown CVar ${name}`);
  }

  return target;
}

function FormatCommandString(text: string) {
  return text.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
}

export async function ExecuteCommand(content: string) {
  assert(RunService.IsClient(), "Function can only be called from the client.");

  const args = FormatCommandString(content).split(" ");
  if (args.size() <= 0) return;

  const name = args.shift() ?? "";
  const targetVariable = createdCVars.get(name);
  const targetCallback = registeredCallbacks.get(name);

  if (targetVariable) {
    const value1 = args.shift();
    const numValue1 = tonumber(value1);

    if (!value1) {
      print(`${targetVariable.name}: ${tostring(targetVariable.Get())} [${targetVariable.type}]`);
    }

    if (targetVariable.flags.includes(cvarFlags.readonly)) {
      warn(`CVar ${name} is read only.`);
      return;
    }

    if (targetVariable.type === "number") {
      if (!numValue1) {
        warn(`Value must be a number, got string.`);
        return;
      }
      targetVariable.Set(numValue1);
    }

    if (targetVariable.type === "string")
      targetVariable.Set(value1);

    print(`${name} set to ${value1}`);
    return;
  }

  if (registeredCallbacks.has(name)) {
    if (targetCallback) {
      const passingArguments: unknown[] = [];

      for (let index = 0; index < targetCallback.args.size(); index++) {
        const stringArgument = args[index];
        if (!stringArgument) break;

        const targetArgumentInfo = targetCallback.args[index];
        if (!targetArgumentInfo) break;

        passingArguments[index] = targetArgumentInfo.convert(stringArgument);
      }

      if (passingArguments.size() < targetCallback.args.size()) {
        const missingArgumentsAmount = targetCallback.args.size() - passingArguments.size();
        return `Missing command arguments, got: ${missingArgumentsAmount}, required: ${targetCallback.args.size()}.`;
      }

      print("Executing command:", name, "...");
      executeConsoleFunction(name, ...passingArguments);
      return;
    }

    print("Executing command:", name, "...");
    executeConsoleFunction(name, ...args);
    return;
  }

  warn(`Unknown command "${content}".`);
}

// # Bindings & misc
if (RunService.IsClient()) {
  TextChatService.SendingMessage.Connect((message) => {
    if (message.TextSource?.UserId !== Players.LocalPlayer.UserId) return; // WHAT?

    const content = message.Text;
    if (content.sub(1, 1) !== gameValues.cmdprefix) return;

    const split = content.split(gameValues.cmdprefix);
    for (const argument of split) {
      ExecuteCommand(argument).expect();
      task.wait();
      task.wait(); // Double trouble :)
    }
  });
}

LogService.MessageOut.Connect((message, msgType) => {
  conch.log("normal", `${msgType.Name.gsub("Message", "")[0]} - ${message}`);
});