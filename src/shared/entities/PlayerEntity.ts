import HealthEntity from "./HealthEntity";
import { FinalizeBufferCreation, StartBufferCreation } from "shared/util/bufferwriter";

declare global {
  interface GameEntities {
    PlayerEntity: typeof PlayerEntity;
  }
}

class PlayerEntity extends HealthEntity {
  readonly classname: keyof GameEntities = "PlayerEntity";
  controller: number | undefined;

  health = 100;
  maxHealth = 100;

  origin = new CFrame();
  size = new Vector3(2, 5, 2);
  velocity = new Vector3();

  constructor() {
    super();

    this._inheritance_list.add("PlayerEntity");
  }

  GetStateBuffer(): buffer {
    StartBufferCreation();
    return FinalizeBufferCreation();
  }

  ApplyStateBuffer(state: buffer): void {
    
  }

  Destroy(): void { }
}

export = PlayerEntity;
