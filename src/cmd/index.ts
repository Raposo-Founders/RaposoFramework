import { HttpService, Players, RunService, TextChatService } from "@rbxts/services";
import { gameValues } from "gamevalues";
import { ConsoleFunctionCallback, createdCVars, cvarFlags } from "./cvar";
import Signal from "util/signal";
import { t } from "@rbxts/t";

// # Constants & variables
export const CONSOLE_OUT = new Signal<[Level: "warn" | "error" | "info", message: string]>();

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
    targetCallback.execute(args);
    return;
  }

  warn(`Unknown command "${content}".`);
}

function concatString(content: unknown[]) {
  let finalString = "";

  for (const element of content)
    if (t.table(element))
      finalString += `${HttpService.JSONEncode(element)} `;
    else
      finalString += `${tostring(element)} `;

  return finalString;
}

// # Namespace
export namespace RaposoConsole {
  export function info(...content: string[]) {
    CONSOLE_OUT.Fire("info", concatString(content));
  }
  export function warn(...content: string[]) {
    CONSOLE_OUT.Fire("warn", concatString(content));
  }
  export function err(...content: string[]) {
    CONSOLE_OUT.Fire("error", concatString(content));
  }
}

// # Bindings & misc
