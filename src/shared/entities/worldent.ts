import { CBaseRecordableEntity } from "./BaseRecordableEntity";

declare global {
  interface GameEntities {
    WorldEntity: typeof CWorldEntity;
  }
}

abstract class CWorldEntity extends CBaseRecordableEntity {
  abstract origin: CFrame;
  abstract size: Vector3;
  abstract velocity: Vector3;

  constructor() {
    super();

    this._inheritance_list.add("WorldEntity");
  }
}

export = CWorldEntity;
