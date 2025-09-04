import { RunService } from "@rbxts/services";
import CBindableSignal from "./util/signal";

export type T_LOGTYPE = "INFO" | "WARN" | "EXCEPTION";

export const messageOut = new CBindableSignal<[T_LOGTYPE, string]>();

export function LogMessage(logType: T_LOGTYPE, ...content: unknown[]) {
  let finalString = "";

  for (const element of content)
    finalString = `${finalString}${tostring(element)} `;

  if (RunService.IsStudio())
    print(`[${logType}] ${finalString}`);

  messageOut.Fire(logType, finalString);
}