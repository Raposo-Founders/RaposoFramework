import { FinalizeBufferCreation, StartBufferCreation } from "shared/util/bufferwriter";
import { registerEntityClass } from ".";
import HealthEntity from "./HealthEntity";

declare global {
  interface GameEntities {
    PlayerEntity: typeof PlayerEntity;
  }
}

// # Constants & variables
export enum PlayerTeam {
  Defenders,
  Raiders,
  Spectators,
}

// # Class
export default class PlayerEntity extends HealthEntity {
  readonly classname: keyof GameEntities = "PlayerEntity";

  health = 100;
  maxHealth = 100;

  origin = new CFrame();
  size = new Vector3(2, 5, 2);
  velocity = new Vector3();

  team = PlayerTeam.Spectators;

  constructor() {
    super();

    this._inheritance_list.add("PlayerEntity");
  }

  GetStateBuffer(): buffer {
    StartBufferCreation();
    return FinalizeBufferCreation();
  }

  ApplyStateBuffer(state: buffer): void { }

  Think(dt: number): void {
      
  }

  Destroy(): void { }
}

// # Misc
registerEntityClass("PlayerEntity", PlayerEntity);
