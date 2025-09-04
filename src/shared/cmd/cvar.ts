import { MESSAGE_OUT_SIGNAL } from "shared/logger";

// # Types
type T_VALID_TYPES = "string" | "number";

interface I_CommandArgument<N extends true | false> {
  name: string,
  number?: N,
}

interface I_CommandContext {
  Reply: (message: string) => void;
  Warn: (message: string) => void;
  Error: (message: string) => void;
}

// # Constants & variables
export enum CVAR_FLAGS {
  debug, // Only usable on studio
  hidden,
  readonly,
  server, // Can only be used from the server or by developers
}

export const createdCVars = new Map<string, CCVar<unknown>>();
export const registeredCallbacks = new Set<string>();
export const registeredCallbackArgs = new Map<string, I_CommandArgument<true | false>[]>();

const builtCallbacks = new Map<string, Callback>();

// # Functions
export function RegisterConsoleCallback< // Abandon all hope below, this is cursed 💀
  T extends I_CommandArgument<true | false>[],
  A extends { [K in keyof T]: T[K] extends I_CommandArgument<infer N> ? (N extends true ? number : string) : never},
  C extends (ctx: I_CommandContext, ...args: A) => (string | undefined | void)
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

export function ExecuteConsoleCallback(name: string, ...args: unknown[]) {
  const contextEnvironment: I_CommandContext = {
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
  private _currentValue: T;

  readonly type: T_VALID_TYPES;

  constructor(readonly name: string, private _defaultValue: T, readonly flags: CVAR_FLAGS[]) {
    assert(!createdCVars.has(name), `Duplicate CVar ${name}.`);
    assert(typeIs(_defaultValue, "string") || typeIs(_defaultValue, "number"), `Only strings and numbers are supported on CVars, got ${typeOf(_defaultValue)}.`);

    this._currentValue = _defaultValue;
    this.type = typeIs(_defaultValue, "string") ? "string" : "number";

    table.freeze(flags);
    createdCVars.set(name, this);
  }

  Set(newValue: T) {
    if (this.flags.includes(CVAR_FLAGS.readonly)) return;
    this._currentValue = newValue;
  }

  Get() {
    return this._currentValue;
  }

  Reset() {
    this._currentValue = this._defaultValue;
  }
}
