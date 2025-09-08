import { ErrorObject } from "shared/util/utilfuncs";

declare global {
  interface GameEntities {
    BaseEntity: typeof BaseEntity;
  }
}

abstract class BaseEntity {
  readonly id = ErrorObject<string>("Entity id cannot be accessed during contruction.");
  readonly environment = ErrorObject<T_EntityEnvironment>("Entity session cannot be accessed during construction.");

  abstract readonly classname: keyof GameEntities;
  protected inheritanceList = new Set<keyof GameEntities>();
  readonly deletionCallbacks = new Array<Callback>();
  readonly associatedInstances = new Set<Instance>();
  readonly attributesList = new Map<string, unknown>();

  constructor() {
    this.inheritanceList.add("BaseEntity");
  }

  IsA<C extends keyof GameEntities>(classname: C): this is EntityType<C> {
    return this.inheritanceList.has(classname) || this.classname === classname;
  }

  OnDelete(callback: (entity: this) => void) {
    this.deletionCallbacks.push(callback);
  }

  AssociateInstance(inst: Instance) {
    this.associatedInstances.add(inst);
  }
  UnassociateInstance(inst: Instance) {
    this.associatedInstances.delete(inst);
  }

  SetAttribute(name: string, value: unknown) {
    if (value === undefined) {
      this.attributesList.delete(name);
      return;
    }

    this.attributesList.set(name, value);
  }

  GetAttribute(name: string) {
    return this.attributesList.get(name);
  }

  abstract Destroy(): void;

  abstract WriteStateBuffer(): void;
  abstract ApplyStateBuffer(state: buffer): void;

  abstract Think(dt: number): void;
}

export = BaseEntity;
