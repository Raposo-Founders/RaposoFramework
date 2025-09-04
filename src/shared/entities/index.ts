import { t } from "@rbxts/t";
import CBaseEntity from "./BaseEntity";
import CBindableSignal from "shared/util/signal";
import { RunService } from "@rbxts/services";
import { RandomString } from "shared/util/utilfuncs";
import CWorldInstance from "shared/worldrender";

// # Types
declare global {
  type EntityType<T extends keyof GameEntities> = GameEntities[T]["prototype"];
  type EntityId = typeof CBaseEntity["prototype"]["id"];
  type T_EntityEnvironment = CEntityEnvironment;
}

// # Constants

// # Functions

// # Class
export class CEntityEnvironment {
  static entity_build_list = new Map<string, new (...args: never[]) => CBaseEntity>();

  readonly game_entities = new Map<EntityId, CBaseEntity>();
  readonly entity_created = new CBindableSignal<[Entity: CBaseEntity]>();
  readonly entity_deleting = new CBindableSignal<[Entity: CBaseEntity]>();

  is_server = RunService.IsServer();
  is_playback = false;

  constructor(readonly world: CWorldInstance) { }

  async CreateEntityByName<
    K extends keyof GameEntities,
    E extends GameEntities[K],
    C extends E extends new (...args: infer A) => CBaseEntity ? A : never[],
  >(classname: K, entityId = RandomString(10), ...args: C): Promise<EntityType<K>> {
    const entity_constructor = CEntityEnvironment.entity_build_list.get(classname);
    assert(entity_constructor, `Attempt to create unknown entity: "${classname}"`);

    print(`Spawning entity ${classname}...`);

    const entity = new entity_constructor(...(args as never[]));
    rawset(entity, "environment", this);
    rawset(entity, "id", entityId);

    this.game_entities.set(entity.id, entity);
    this.entity_created.Fire(entity);

    return entity as unknown as EntityType<K>;
  }

  ChangeEntityId(entity: CBaseEntity, newId: EntityId) {
    assert(this.IsEntityOnMemoryOrImSchizo(entity), "Entity is not on memory.");

    this.game_entities.delete(entity.id);
    this.game_entities.set(newId, entity);

    rawset(entity, "id", newId); // Fuckass hack :)
  }

  KillThisMafaker(entity: CBaseEntity) {
    if (!this.IsEntityOnMemoryOrImSchizo(entity)) return;
    if (!t.table(entity) || !t.string(rawget(entity, "id") as EntityId))
      throw `This s### is an invalid entity. ${entity.classname} ${entity.id}`;

    print(`Killing entity ${entity.classname} ${entity.id}`);

    this.game_entities.delete(entity.id);
    this.entity_deleting.Fire(entity);

    task.defer(() => {
      for (const callback of entity.deletion_callbacks)
        task.spawn(() => callback(entity));
      table.clear(entity.deletion_callbacks);

      entity.Destroy();

      table.clear(entity.associated_instances);
      table.clear(entity.attributes_list);
      table.clear(entity.entity_think_list);

      task.wait();
      task.wait();

      for (const [key, value] of entity as unknown as Map<string, unknown>) {
        if (t.table(value) && rawget(value, "_classname") === tostring(CBindableSignal)) {
          print("Clearing entity signal content:", key);
          (value as CBindableSignal<unknown[]>).Clear();
        }

        rawset(entity, key, undefined);
      }

      setmetatable(entity, undefined);
    });
  }

  IsEntityOnMemoryOrImSchizo(entity: CBaseEntity | EntityId | undefined): boolean {

    // If an nil value is given.
    if (!t.any(entity)) {
      return false;
    }

    // If an number value is given.
    if (t.string(entity)) {
      return this.game_entities.has(entity);
    }

    // If the object is not an table.
    if (!t.table(entity)) return false;

    // Try to get the "id" variable from the object
    const id = rawget(entity, "id") as EntityId;
    if (!t.string(id)) return false;

    // Search it up
    const ent = this.game_entities.get(id);
    return ent !== undefined;

    // Why the fuck did you have to comment each and every step of this?
    // Fucking retarded people man I swear to god.
  }

  GetEntityFromId(entid: EntityId) {
    return this.game_entities.get(entid);
  }

  GetEntitiesThatIsA<K extends keyof GameEntities, E extends GameEntities[K]>(classname: K): E["prototype"][] {
    const entities = new Array<E["prototype"]>();

    // Check if the classname is actually valid
    if (!CEntityEnvironment.entity_build_list.has(classname))
      throw `Invalid entity classname: ${classname}`;

    for (const [, ent] of this.game_entities) {
      if (!ent.IsA(classname)) continue;
      entities.push(ent as unknown as EntityType<K>);
    }

    return entities;
  }

  GetEntitiesOfClass<K extends keyof GameEntities, E extends GameEntities[K]>(classname: K): E["prototype"][] {
    const entities = new Array<E["prototype"]>();

    // Check if the classname is actually valid
    if (!CEntityEnvironment.entity_build_list.has(classname))
      throw `Invalid entity classname: ${classname}`;

    for (const [, ent] of this.game_entities) {
      if (ent.classname !== classname) continue;
      entities.push(ent as unknown as EntityType<K>);
    }

    return entities;
  }

  GetEntitiesFromInstance(inst: Instance) {
    const rgEntities = new Array<CBaseEntity>();

    for (const [, ent] of this.game_entities) {
      if (!ent.associated_instances.has(inst))
        continue;

      rgEntities.push(ent);
    }

    return rgEntities;
  }

  KillAllThoseBitchAsses() {
    for (const [entid, info] of this.game_entities) {
      this.KillThisMafaker(info);
    }
  }

  static LinkEntityBuilderToClass(builder: new (...args: never[]) => CBaseEntity, classname: keyof GameEntities) {
    if (this.entity_build_list.has(classname))
      throw `Entity constructor ${classname} already exists.`;

    this.entity_build_list.set(classname, builder);
  }
}

// # Bindings & other shit
CEntityEnvironment.LinkEntityBuilderToClass({} as unknown as new () => CBaseEntity, "BaseEntity"); // Fuckass hack :)
