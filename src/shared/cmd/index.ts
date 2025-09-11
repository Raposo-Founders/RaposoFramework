import { Players, RunService, TextChatService } from "@rbxts/services";
import { createdCVars, registeredCallbacks, cvarFlags, registeredCallbackArgs, executeConsoleFunction } from "./cvar";
import { gameValues } from "shared/gamevalues";

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
  const targetCallbackArgs = registeredCallbackArgs.get(name);

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
    if (targetCallbackArgs) {
      const passingArguments = new Array<string | number>();

      for (let index = 0; index < targetCallbackArgs.size(); index++) {
        const stringArgument = args[index];
        if (!stringArgument) break;

        const targetArgumentInfo = targetCallbackArgs[index];
        if (!targetArgumentInfo) break;

        if (targetArgumentInfo.number) {
          const toNumber = tonumber(stringArgument);
          if (!toNumber) break;

          passingArguments.push(toNumber);
          continue;
        }

        passingArguments.push(stringArgument);
      }

      if (passingArguments.size() < targetCallbackArgs.size()) {
        const missingArgumentsAmount = targetCallbackArgs.size() - passingArguments.size();
        return `Missing command arguments, got: ${missingArgumentsAmount}, required: ${targetCallbackArgs.size()}.`;
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