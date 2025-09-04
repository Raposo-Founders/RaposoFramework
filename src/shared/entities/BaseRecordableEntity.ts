import { CEntityEnvironment } from ".";
import CBaseEntity from "./BaseEntity";

// # Types
declare global {
  interface GameEntities {
    RecordableEntity: typeof CBaseRecordableEntity;
  }
}

// # Class
export abstract class CBaseRecordableEntity extends CBaseEntity {
  constructor() {
    super();

    this._inheritance_list.add("RecordableEntity");
  }

  abstract GetStateBuffer(): buffer;
  abstract ApplyStateBuffer(state: buffer): void;
}

// # Bindings & misc
CEntityEnvironment.LinkEntityBuilderToClass({} as unknown as new () => CBaseEntity, "RecordableEntity");
