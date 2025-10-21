import * as Services from "@rbxts/services";
import { getLocalPlayerEntity } from "controllers/LocalEntityController";
import { defaultEnvironments } from "defaultinsts";
import { gameValues } from "gamevalues";
import { getPlayermodelFromEntity } from "providers/PlayermodelProvider";
import SessionInstance from "providers/SessionProvider";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferBool, writeBufferString, writeBufferU32, writeBufferU64, writeBufferU8 } from "util/bufferwriter";
import Signal from "util/signal";
import { DoesInstanceExist } from "util/utilfuncs";
import { registerEntityClass } from ".";
import HealthEntity from "./HealthEntity";
import PlayerEntity, { getPlayerEntityFromController } from "./PlayerEntity";

// # Types
declare global {
  interface GameEntities {
    SwordPlayerEntity: typeof SwordPlayerEntity;
  }
}

// # Constants & variables
export enum SwordState {
  Idle = 5,
  Swing = 10,
  Lunge = 30,
}

const NETWORK_ID = "sword_";

// # Functions

// # Class
export class SwordPlayerEntity extends PlayerEntity {
  classname: keyof GameEntities = "SwordPlayerEntity";

  hitDetectionEnabled = true;
  currentState = SwordState.Idle;
  hitboxTouched = new Signal<[target: HealthEntity, part: BasePart]>();
  stateChanged = new Signal<[newState: SwordState]>();

  private canAttack = true;
  private isEquipped = false;
  private lastActiveTime = 0;
  private activationCount = 0;

  constructor(public controller: string, public appearanceId = 1) {
    super(controller, appearanceId);

    this.inheritanceList.add("SwordPlayerEntity");

    task.defer(() => {
      if (this.environment.isServer) return;

      this.spawned.Connect(() => this.Equip());
      this.died.Connect(() => this.Unequip());
    });
  }

  WriteStateBuffer() {
    super.WriteStateBuffer();

    writeBufferBool(this.isEquipped);
    writeBufferU32(this.activationCount);
  }

  ApplyStateBuffer(state: buffer): void {
    const reader = BufferReader(state);
    super.ApplyStateBuffer(state);
  
    /* Skip the original content from the PlayerEntity class */
    reader.string();
    reader.u16();
    reader.u16();

    reader.vec();
    reader.vec();
    reader.vec();
    reader.vec();
    reader.bool();
    reader.bool();

    reader.u8();
    reader.string();
    reader.u64();
    reader.u16();
    reader.u16();
    reader.u16();
    reader.u16();
    reader.string();
    /* End-section */

    const isEquipped = reader.bool();
    const activationCount = reader.u32();

    if (this.environment.isServer || this.GetUserFromController() !== Services.Players.LocalPlayer)
      if (this.isEquipped !== isEquipped)
        if (isEquipped)
          this.Equip();
        else
          this.Unequip();

    if (this.environment.isPlayback) {
      if (this.activationCount !== activationCount)
        this.Attack1();

      this.activationCount = activationCount;
    }
  }

  Destroy(): void {
    this.hitboxTouched.Clear();
  }

  IsWeaponEquipped() {
    return this.isEquipped;
  }

  Equip() {
    if (this.isEquipped) return;

    this.isEquipped = true;
    getPlayermodelFromEntity(this.id)?.animator.PlayAnimation("toolnone", "Action", true);
  }

  Unequip() {
    if (!this.isEquipped) return;

    this.isEquipped = false;
    getPlayermodelFromEntity(this.id)?.animator.StopAnimation("toolnone");
  }

  async Attack1() {
    if (!this.environment.isServer && !this.environment.isPlayback) {
      startBufferCreation();
      defaultEnvironments.network.sendPacket(`${NETWORK_ID}c_activate`);

      return;
    }

    if (!this.isEquipped || !this.canAttack) return;
    this.canAttack = false;

    const currentTime = time();

    if (!this.environment.isPlayback)
      this.activationCount++;

    if (currentTime - this.lastActiveTime <= 0.2)
      this.Lunge().expect();
    else
      this.Swing().expect();

    this.lastActiveTime = currentTime;
    this.currentState = SwordState.Idle;
    this.canAttack = true;
  }

  async Lunge() {
    if (!this.isEquipped) return;
    getPlayermodelFromEntity(this.id)?.animator.PlayAnimation("toollunge", "Action3", true);
    getPlayermodelFromEntity(this.id)?.animator.StopAnimation("toolslash");

    this.currentState = SwordState.Lunge;
    this.stateChanged.Fire(this.currentState);

    task.wait(1);

    this.currentState = SwordState.Idle;
    this.stateChanged.Fire(this.currentState);
    getPlayermodelFromEntity(this.id)?.animator.StopAnimation("toollunge");
  }

  async Swing() {
    if (!this.isEquipped) return;
    getPlayermodelFromEntity(this.id)?.animator.StopAnimation("toollunge");
    getPlayermodelFromEntity(this.id)?.animator.PlayAnimation("toolslash", "Action2", true);

    this.currentState = SwordState.Swing;
    this.stateChanged.Fire(this.currentState);
  }
}

// # Bindings & misc
registerEntityClass("SwordPlayerEntity", SwordPlayerEntity);

SessionInstance.sessionCreated.Connect(server => {
  server.entity.entityCreated.Connect(entity => {
    if (!entity.IsA("SwordPlayerEntity")) return;

    // Listen for state changes
    entity.stateChanged.Connect(() => {
      startBufferCreation();
      writeBufferString(entity.id);
      writeBufferU8(entity.currentState);
      server.network.sendPacket(`${NETWORK_ID}changed`);
    });
  });

  // Activation requests
  server.network.listenPacket(`${NETWORK_ID}c_activate`, (packet) => {
    if (!packet.sender) return;

    const entity = getPlayerEntityFromController(server.entity, tostring(packet.sender.GetAttribute(gameValues.usersessionid)));
    if (!entity || !entity.IsA("SwordPlayerEntity")) return;

    entity.Attack1();
  });

  // Server players replication
  server.lifecycle.BindTickrate(() => {
    const entitiesList = server.entity.getEntitiesThatIsA("SwordPlayerEntity");

    startBufferCreation();
    writeBufferU8(entitiesList.size()); // Yes... I know this limits only up to 255 entities, dickhead.
    for (const ent of entitiesList) {
      writeBufferString(ent.id);
      writeBufferString(ent.controller);
      writeBufferU64(ent.appearanceId);
    }
    server.network.sendPacket(`${NETWORK_ID}entities_list`);

    for (const ent of entitiesList) {
      startBufferCreation();
      ent.WriteStateBuffer();
      server.network.sendPacket(`${NETWORK_ID}replication`, undefined, undefined);
    }
  });

  // Client state updating
  server.network.listenPacket(`${NETWORK_ID}c_stateupd`, (packet) => {
    if (!packet.sender) return;

    const reader = BufferReader(packet.content);
    const entityId = reader.string();

    const entity = server.entity.entities.get(entityId);
    if (!entity || !entity.IsA("SwordPlayerEntity") || entity.GetUserFromController() !== packet.sender) return;

    entity.ApplyStateBuffer(packet.content);
  });
});

if (Services.RunService.IsClient()) {
  const entitiesInQueue = new Set<EntityId>();

  // Creating entities
  defaultEnvironments.network.listenPacket(`${NETWORK_ID}entities_list`, (packet) => {
    const listedServerEntities = new Array<string>();

    const reader = BufferReader(packet.content);
    const amount = reader.u8();

    for (let i = 0; i < amount; i++) {
      const entityId = reader.string();
      const controllerId = reader.string();
      const appearanceId = reader.u64();

      listedServerEntities.push(entityId);
      if (entitiesInQueue.has(entityId)) continue;

      const entity = defaultEnvironments.entity.entities.get(entityId);
      if (entity) continue;

      entitiesInQueue.add(entityId);

      defaultEnvironments.entity.createEntity("SwordPlayerEntity", entityId, controllerId, appearanceId)
        .finally(() => {
          entitiesInQueue.delete(entityId);
        });
    }

    for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("SwordPlayerEntity")) {
      if (listedServerEntities.includes(ent.id) || entitiesInQueue.has(ent.id)) continue;
      defaultEnvironments.entity.killThisFucker(ent);
    }
  });

  // Replication update
  defaultEnvironments.network.listenPacket(`${NETWORK_ID}replication`, (packet) => {
    const reader = BufferReader(packet.content);
    const entityId = reader.string();

    if (entitiesInQueue.has(entityId)) return;

    const targetEntity = defaultEnvironments.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("SwordPlayerEntity")) return;

    targetEntity.ApplyStateBuffer(packet.content);
  });

  // Client state update
  defaultEnvironments.lifecycle.BindTickrate(() => {
    const entity = getLocalPlayerEntity();
    if (!entity || !entity.IsA("SwordPlayerEntity") || entity.health <= 0) return;

    startBufferCreation();
    entity.WriteStateBuffer();
    defaultEnvironments.network.sendPacket(`${NETWORK_ID}c_stateupd`, undefined, undefined);
  });

  // Sword / attack changes
  defaultEnvironments.network.listenPacket(`${NETWORK_ID}changed`, (packet) => {
    const reader = BufferReader(packet.content);

    const entityId = reader.string();
    const newState = reader.u8();

    const targetEntity = defaultEnvironments.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("SwordPlayerEntity")) return;
    if (targetEntity.currentState === newState) return;

    if (newState === SwordState.Lunge)
      targetEntity.Lunge();

    if (newState === SwordState.Swing)
      targetEntity.Swing();
  });
}

