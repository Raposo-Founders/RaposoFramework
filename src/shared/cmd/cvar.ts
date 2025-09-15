import conch from "shared/conch_pkg";
import { args, Type } from "shared/conch_pkg/conch";

// # Types
interface CommandContext {
  Reply: (message: string) => void;
  Warn: (message: string) => void;
  Error: (message: string) => void;
}

interface RegisteredCommandInfo {
  name: string;
  description: string;
  args: Type[];
  callback: Callback;
}

// # Constants & variables
export enum cvarFlags {
  debug, // Only usable on studio
  hidden,
  readonly,
  server, // Can only be used from the server or by developers
}

export const createdCVars = new Map<string, CCVar<unknown>>();
export const registeredCallbacks = new Map<string, RegisteredCommandInfo>();

// # Functions
export function registerConsoleFunction< // Abandon all hope below, this is cursed 💀
  T extends Type[],
  A extends { [K in keyof T]: T[K] extends Type<infer N> ? N : never},
  C extends (ctx: CommandContext, ...args: A) => (string | undefined | void)
  >(name: string[], checkTypes: T, description = "") {
  return (callback: C) => {
    for (const element of name) {
      registeredCallbacks.set(element, {
        name: element,
        description: description,
        args: checkTypes,
        callback: callback,
      });

      conch.register(element, {
        permissions: [],
        description: description,
        arguments: () => $tuple(...checkTypes),
        callback: (...args) => executeConsoleFunction(element, ...args),
      });
    }
  };
}

export function executeConsoleFunction(name: string, ...args: unknown[]) {
  const contextEnvironment: CommandContext = {
    Reply: (message) => {
      print(`[${name}]: ${message}`);
    },
    Warn: (message) => {
      warn(`[${name}]: ${message}`);
    },
    Error: (message) => {
      warn("Error", `[${name}]: ${message}`);
    },
  };

  registeredCallbacks.get(name)?.callback(contextEnvironment, ...args);
}

// # Classes
export class CCVar<T> {
  private currentValue: T;

  readonly type: "string" | "number";

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
