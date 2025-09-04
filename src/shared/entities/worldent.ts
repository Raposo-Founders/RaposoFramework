import BaseEntity from "./BaseEntity";

declare global {
  interface GameEntities {
    WorldEntity: typeof WorldEntity;
  }
}

abstract class WorldEntity extends BaseEntity {
  abstract origin: CFrame;
  abstract size: Vector3;
  abstract velocity: Vector3;

  constructor() {
    super();

    this._inheritance_list.add("WorldEntity");
  }
}

export = WorldEntity;
