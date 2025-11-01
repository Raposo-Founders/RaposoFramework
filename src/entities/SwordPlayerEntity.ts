import * as Services from "@rbxts/services";
import { getLocalPlayerEntity } from "controllers/LocalEntityController";
import { defaultEnvironments } from "defaultinsts";
import { gameValues } from "gamevalues";
import { RaposoConsole } from "logging";
import { getPlayermodelFromEntity } from "providers/PlayermodelProvider";
import SessionInstance from "providers/SessionProvider";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferBool, writeBufferString, writeBufferU32, writeBufferU8 } from "util/bufferwriter";
import Signal from "util/signal";
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

  ApplyStateBuffer(reader: ReturnType<typeof BufferReader>): void {
    super.ApplyStateBuffer(reader);

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

  // Replicating entities
  server.lifecycle.BindTickrate(() => {
    const entitiesList = server.entity.getEntitiesThatIsA("SwordPlayerEntity");

    startBufferCreation();
    writeBufferU8(math.min(entitiesList.size(), 255)); // Yes... I know this limits only up to 255 entities, dickhead.
    for (const ent of entitiesList)
      ent.WriteStateBuffer();
    server.network.sendPacket(`${NETWORK_ID}replication`);
  });

  // Client state updating
  server.network.listenPacket(`${NETWORK_ID}c_stateupd`, (packet) => {
    if (!packet.sender) return;

    const reader = BufferReader(packet.content);
    const entityId = reader.string(); // Entity ID can be read from here due to PlayerEntity writing it first

    const entity = server.entity.entities.get(entityId);
    if (!entity?.IsA("SwordPlayerEntity")) return;
    if (entity.GetUserFromController() !== packet.sender && entity.GetUserFromNetworkOwner() !== packet.sender) {
      RaposoConsole.Warn(`Invalid ${SwordPlayerEntity} state update from ${packet.sender}.`);
      return;
    }

    entity.ApplyStateBuffer(reader);
  });
});

if (Services.RunService.IsClient()) {
  let hasEntityInQueue = false;

  // Entity replication
  defaultEnvironments.network.listenPacket(`${NETWORK_ID}replication`, (packet) => {
    if (hasEntityInQueue) return; // Skip if entities are currently being created.
    // ! MIGHT RESULT IN THE GAME HANGING FROM TIME TO TIME !

    const listedServerEntities = new Set<EntityId>();

    const reader = BufferReader(packet.content);
    const amount = reader.u8();

    for (let i = 0; i < amount; i++) {
      const entityId = reader.string(); // Entity ID can be read from here due to PlayerEntity writing it first

      let entity = defaultEnvironments.entity.entities.get(entityId);
      if (!entity) {
        hasEntityInQueue = true;

        entity = defaultEnvironments.entity.createEntity("SwordPlayerEntity", entityId, "", 1).expect();
        hasEntityInQueue = false;
      }

      listedServerEntities.add(entityId);
      entity.ApplyStateBuffer(reader);
    }

    // Deleting non-listed entities
    for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("SwordPlayerEntity")) {
      if (listedServerEntities.has(ent.id)) continue;
      defaultEnvironments.entity.killThisFucker(ent);
    }
  });

  // Client state update
  defaultEnvironments.lifecycle.BindTickrate(() => {
    const entity = getLocalPlayerEntity();
    if (!entity || !entity.IsA("SwordPlayerEntity") || entity.health <= 0) return;

    startBufferCreation();
    entity.WriteStateBuffer();
    defaultEnvironments.network.sendPacket(`${NETWORK_ID}c_stateupd`, undefined, undefined);

    // Update bot entities
    for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("SwordPlayerEntity")) {
      if (ent.GetUserFromNetworkOwner() !== Services.Players.LocalPlayer) continue;

      startBufferCreation();
      ent.WriteStateBuffer();
      defaultEnvironments.network.sendPacket(`${NETWORK_ID}c_stateupd`, undefined, undefined);
    }
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

