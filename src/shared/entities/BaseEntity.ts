import { ErrorObject, RandomString } from "shared/util/utilfuncs";

declare global {
  interface GameEntities {
    BaseEntity: typeof CBaseEntity;
  }
}

abstract class CBaseEntity {
  readonly id = ErrorObject<string>("Entity id cannot be accessed during contruction.")
  readonly environment = ErrorObject<T_EntityEnvironment>("Entity session cannot be accessed during construction.");

  abstract readonly classname: keyof GameEntities;
  protected _inheritance_list = new Set<keyof GameEntities>();
  readonly deletion_callbacks = new Array<Callback>();
  readonly associated_instances = new Set<Instance>();
  readonly attributes_list = new Map<string, unknown>();
  readonly entity_think_list = new Array<(dt: number) => void>();

  constructor() {
    this._inheritance_list.add("BaseEntity");
  }

  IsA<C extends keyof GameEntities>(classname: C): this is EntityType<C> {
    return this._inheritance_list.has(classname) || this.classname === classname;
  }

  OnDelete(callback: (entity: this) => void) {
    this.deletion_callbacks.push(callback);
  }

  AssociateInstance(inst: Instance) {
    this.associated_instances.add(inst);
  }
  UnassociateInstance(inst: Instance) {
    this.associated_instances.delete(inst);
  }

  SetAttribute(name: string, value: unknown) {
    if (value === undefined) {
      this.attributes_list.delete(name);
      return;
    }

    this.attributes_list.set(name, value);
  }

  GetAttribute(name: string) {
    return this.attributes_list.get(name);
  }

  BindThinkCallback(callback: (dt: number) => void) {
    this.entity_think_list.push(callback);

    return callback;
  }

  abstract Destroy(): void;
}

export = CBaseEntity;
