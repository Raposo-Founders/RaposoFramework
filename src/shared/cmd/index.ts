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

export function ExecuteCommand(content: string) {
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

  if (targetCallback) {
    conch.execute(content);
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
      ExecuteCommand(argument);
      task.wait();
      task.wait(); // Double trouble :)
    }
  });
}

// LogService.MessageOut.Connect((message, msgType) => {
//   conch.log("normal", `${msgType.Name.gsub("Message", "")[0]} - ${message}`);
// });