import { RunService } from "@rbxts/services";
import Signal from "./util/signal";

export type T_LOGTYPE = "INFO" | "WARN" | "EXCEPTION";

export const MESSAGE_OUT_SIGNAL = new Signal<[T_LOGTYPE, string]>();

export function msg(logType: T_LOGTYPE, ...content: unknown[]) {
  const caller = debug.info(2, "s")[0];

  let finalString = "";

  for (const element of content)
    finalString = `${finalString}${tostring(element)} `;

  if (RunService.IsStudio())
    print(`[${caller}] ${logType} - ${finalString}`);

  MESSAGE_OUT_SIGNAL.Fire(logType, finalString);
}