import { defaultEnvironments } from "defaultinsts";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";

// # Types
interface CommandContext {
  Reply: (message: string) => void;
  Warn: (message: string) => void;
  Error: (message: string) => void;

  getArgument: <T extends CONFUNC_TYPES>(name: string, expectedType: T) => CFunctionArgument<T>;
}

type CONFUNC_TYPES = "string" | "strings" | "number" | "team" | "player";
type CONFUNC_TYPES_Converted = string | string[] | number | keyof typeof PlayerTeam | PlayerEntity[];

type ___ConvertFuncType<T extends CONFUNC_TYPES> =
  T extends "string" ? string :
  T extends "number" ? number :
  T extends "strings" ? string[] :
  T extends "team" ? keyof typeof PlayerTeam :
  T extends "player" ? PlayerEntity[] : never;

interface CFunctionArgumentDefinition<T extends CONFUNC_TYPES> {
  name: string;
  description?: string;
  type: T;
}

interface CFunctionArgument<T extends CONFUNC_TYPES> {
  name: string;
  value: ___ConvertFuncType<T>;
}

// # Constants & variables
export enum cvarFlags {
  debug, // Only usable on studio
  hidden,
  readonly,
  server, // Can only be used from the server or by developers
}

export const createdCVars = new Map<string, CCVar<unknown>>();

// # Functions
export function convertConsoleArgumentType(argumenttype: CONFUNC_TYPES, values: string[]): CONFUNC_TYPES_Converted {
  if (argumenttype === "string")
    return tostring(values.shift());

  if (argumenttype === "number")
    return tonumber(tostring(values.shift())) || -1;

  if (argumenttype === "team") {

    const value = tostring(values.shift());
    let targetTeamId = PlayerTeam.Spectators;

    if (("defenders").match((value).lower())[0]) targetTeamId = PlayerTeam.Defenders;
    if (("raiders").match((value).lower())[0]) targetTeamId = PlayerTeam.Raiders;
    if (("spectators").match((value).lower())[0]) targetTeamId = PlayerTeam.Spectators;

    return PlayerTeam[targetTeamId];
  }

  if (argumenttype === "player") {
    const value = tostring(values.shift());
    const foundPlayers: PlayerEntity[] = [];

    for (const playerEntity of defaultEnvironments.entity.getEntitiesThatIsA("PlayerEntity")) {
      const controller = playerEntity.GetUserFromController();
      if (!controller) continue;
      if (controller.Name.sub(value.size()) !== value || playerEntity.id.sub(value.size()) !== value) continue;

      foundPlayers.push(playerEntity);
      break;
    }

    return foundPlayers;
  }

  // Returning the "values" table itself
  const clonedObj = table.clone(values);
  values.clear();
  return clonedObj;
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

export class ConsoleFunctionCallback {
  static list = new Array<ConsoleFunctionCallback>();

  private callback: Callback | undefined;
  description = "";

  constructor(
    public readonly names: string[],
    public readonly args: CFunctionArgumentDefinition<CONFUNC_TYPES>[],
  ) {
    ConsoleFunctionCallback.list.push(this);
  }

  setCallback(callback: (ctx: CommandContext) => void) {
    this.callback = callback;

    return this;
  }

  setDescription(description = "") {
    this.description = description;
    return this;
  }

  execute(args: string[]) {
    if (!this.callback) {
      warn(`No callback has been set for command ${this.names[0]}, ignoring call...`);
      return;
    }

    const convertedArguments = new Map<string, CFunctionArgument<never>>();

    for (let i = 0; i < this.args.size(); i++) {
      const element = this.args[i];
      convertedArguments.set(element.name, { name: element.name, value: convertConsoleArgumentType(element.type, args) as never });
    }

    const contextEnvironment: CommandContext = {
      Reply: (message) => {
        print(`<${this.names[0]}> ${message}`);
      },
      Warn: (message) => {
        warn(`<${this.names[0]}> ${message}`);
      },
      Error: (message) => {
        warn(`<${this.names[0]}> [error] ${message}`);
      },

      getArgument: (name, expectedType) => {
        const target = convertedArguments.get(name) as CFunctionArgument<typeof expectedType> | undefined;
        if (!target) throw `Invalid command argument: ${name}`;

        return target;
      },
    };

    this.callback(contextEnvironment);
  }
}

const test = new ConsoleFunctionCallback(["testyield", "ty"], [{ name: "time", type: "number" }]);
test.setCallback((ctx) => {
  const timeAmount = ctx.getArgument("time", "number");
  
});
