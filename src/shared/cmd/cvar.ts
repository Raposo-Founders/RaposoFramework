import { MESSAGE_OUT_SIGNAL } from "shared/logger";

// # Types
type ValidValueTypes = "string" | "number";

interface CommandArgument<N extends true | false> {
  name: string,
  number?: N,
}

interface CommandContext {
  Reply: (message: string) => void;
  Warn: (message: string) => void;
  Error: (message: string) => void;
}

// # Constants & variables
export enum cvarFlags {
  debug, // Only usable on studio
  hidden,
  readonly,
  server, // Can only be used from the server or by developers
}

export const createdCVars = new Map<string, CCVar<unknown>>();
export const registeredCallbacks = new Set<string>();
export const registeredCallbackArgs = new Map<string, CommandArgument<true | false>[]>();

const builtCallbacks = new Map<string, Callback>();

// # Functions
export function registerConsoleFunction< // Abandon all hope below, this is cursed 💀
  T extends CommandArgument<true | false>[],
  A extends { [K in keyof T]: T[K] extends CommandArgument<infer N> ? (N extends true ? number : string) : never},
  C extends (ctx: CommandContext, ...args: A) => (string | undefined | void)
  >(name: string[], ...checkTypes: T) {
  for (const element of name)
    registeredCallbackArgs.set(element, checkTypes);

  return (callback: C) => {
    for (const element of name) {
      builtCallbacks.set(element, callback);
      registeredCallbacks.add(element);
    }
  };
}

export function executeConsoleFunction(name: string, ...args: unknown[]) {
  const contextEnvironment: CommandContext = {
    Reply: (message) => {
      MESSAGE_OUT_SIGNAL.Fire("INFO", `[${name}]: ${message}`);
    },
    Warn: (message) => {
      MESSAGE_OUT_SIGNAL.Fire("WARN", `[${name}]: ${message}`);
    },
    Error: (message) => {
      MESSAGE_OUT_SIGNAL.Fire("EXCEPTION", `[${name}]: ${message}`);
    },
  };

  builtCallbacks.get(name)?.(contextEnvironment, ...args);
}

// # Classes
export class CCVar<T> {
  private currentValue: T;

  readonly type: ValidValueTypes;

  constructor(readonly name: string, private defaultValue: T, readonly flags: cvarFlags[]) {
    assert(!createdCVars.has(name), `Duplicate CVar ${name}.`);
    assert(typeIs(defaultValue, "string") || typeIs(defaultValue, "number"), `Only strings and numbers are supported on CVars, got ${typeOf(defaultValue)}.`);

    this.currentValue = defaultValue;
    this.type = typeIs(defaultValue, "string") ? "string" : "number";

    table.freeze(flags);
    createdCVars.set(name, this);
  }

  Set(newValue: T) {
    if (this.flags.includes(cvarFlags.readonly)) return;
    this.currentValue = newValue;
  }

  Get() {
    return this.currentValue;
  }

  Reset() {
    this.currentValue = this.defaultValue;
  }
}
