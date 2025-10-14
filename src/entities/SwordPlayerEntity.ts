import * as Services from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import { cacheFolder, modelsFolder } from "folders";
import { gameValues, getInstanceDefinedValue } from "gamevalues";
import { NetworkManager } from "network";
import { createPlayermodelForEntity, getPlayermodelFromEntity } from "providers/PlayermodelProvider";
import ServerInstance from "serverinst";
import { getLocalPlayerEntity, getLocalPlayermodel } from "systems/localent";
import { CWorldSoundInstance } from "systems/sound";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferBool, writeBufferString, writeBufferU32, writeBufferU64, writeBufferU8 } from "util/bufferwriter";
import Signal from "util/signal";
import { DoesInstanceExist } from "util/utilfuncs";
import { registerEntityClass } from ".";
import BaseEntity from "./BaseEntity";
import HealthEntity from "./HealthEntity";
import PlayerEntity, { getPlayerEntityFromController, PlayerTeam } from "./PlayerEntity";

// # Types
declare global {
  interface GameEntities {
    SwordPlayerEntity: typeof SwordPlayerEntity;
  }
}

// # Constants & variables
enum SwordState {
  Idle = 5,
  Swing = 10,
  Lunge = 30,
}

enum NetworkSwordHitIndex {
  LocalToOther,
  OtherToLocal,
}

const forcetieEnabled = getInstanceDefinedValue("ForcetieEnabled", false);
const teamHealingEnabled = getInstanceDefinedValue("TeamHealingEnabled", false);

const NETWORK_ID = "sword_";
const SWORD_MODEL = modelsFolder.WaitForChild("Sword") as BasePart;

// # Functions
function CheckPlayers<T extends BaseEntity>(entity1: SwordPlayerEntity, entity2: T) {
  if (entity1.id === entity2.id) return;
  if (!entity2.IsA("HealthEntity")) return;

  if (entity2.IsA("PlayerEntity"))
    if (entity1.team === PlayerTeam.Spectators || entity2.team === PlayerTeam.Spectators) return;

  if (entity1.health <= 0 || entity2.health <= 0) {
    if (!forcetieEnabled) return;

    const lastAttacker = entity2.attackersList[0];
    if (!lastAttacker || time() - lastAttacker.time > 0.25) return;
  }

  if (!teamHealingEnabled && entity2.IsA("PlayerEntity"))
    if (entity1.team === entity2.team) return;

  return true;
}

function ClientHandleHitboxTouched(attacker: SwordPlayerEntity, target: HealthEntity, part: BasePart, network: NetworkManager) {
  task.spawn(() => {
    const highlight = new Instance("Highlight");
    highlight.FillTransparency = 0;
    highlight.OutlineTransparency = 1;
    highlight.Adornee = part;
    highlight.Parent = cacheFolder;
    highlight.FillColor = new Color3(1, 0, 0);
    highlight.DepthMode = Enum.HighlightDepthMode.Occluded;

    const tween = Services.TweenService.Create(highlight, new TweenInfo(0.25, Enum.EasingStyle.Linear), { FillTransparency: 1 });
    tween.Completed.Once(() => {
      highlight.Destroy();
      tween.Destroy();
    });
    tween.Play();
  });

  // If the attacker is another player
  if (attacker.GetUserFromController() !== Services.Players.LocalPlayer) {
    if (!target.IsA("PlayerEntity") || target.GetUserFromController() !== Services.Players.LocalPlayer) return;

    startBufferCreation();
    writeBufferU8(NetworkSwordHitIndex.OtherToLocal);
    writeBufferString(attacker.id);
    network.sendPacket(`${NETWORK_ID}hit`);

    return;
  }

  // If we're the ones attacking
  if (attacker.GetUserFromController() === Services.Players.LocalPlayer) {
    startBufferCreation();
    writeBufferU8(NetworkSwordHitIndex.LocalToOther);
    writeBufferString(target.id);
    network.sendPacket(`${NETWORK_ID}hit`);
  }
}

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
  private instancesList: Instance[] = [];
  private connectionsList: RBXScriptConnection[] = [];
  private gripPosition = new CFrame();
  private activationCount = 0;

  constructor(public controller: string, public appearanceId = 1) {
    super(controller, appearanceId);

    this.inheritanceList.add("SwordPlayerEntity");

    task.defer(() => {
      if (this.environment.isServer) return;

      this.spawned.Connect(() => this.Equip());
      this.died.Connect(() => this.Unequip());

      createPlayermodelForEntity(this).andThen(playermodel => {
        const hitboxPart = SWORD_MODEL.Clone();
        hitboxPart.Parent = this.environment.world.objects;
        hitboxPart.Name = "Part";

        const hitboxMotor = new Instance("Motor6D");
        hitboxMotor.Parent = cacheFolder;
        hitboxMotor.Part0 = playermodel.rig["Right Arm"];
        hitboxMotor.Part1 = hitboxPart;
        hitboxMotor.C0 = new CFrame(0, -1, -1.5).mul(CFrame.Angles(0, math.rad(180), math.rad(-90)));

        this.connectionsList.push(hitboxPart.Touched.Connect(other => {
          if (this.environment.isPlayback) return;
          if (!this.isEquipped) return;
          if (!DoesInstanceExist(playermodel.rig)) return;
          if (other.IsDescendantOf(this.environment.world.parts)) return;
          if (other.IsDescendantOf(playermodel.rig)) return; // Hitting ourselves, ignore...

          const relatedEntities = this.environment.getEntitiesFromInstance(other);
          if (relatedEntities.size() <= 0) return;

          for (const ent of relatedEntities) {
            if (!ent.IsA("HealthEntity") || ent.id === this.id) continue;
            this.hitboxTouched.Fire(ent, other);
          }
        }));

        this.instancesList.push(hitboxPart, hitboxMotor);

        const unbindLifecycleUpdate = defaultEnvironments.lifecycle.BindTickrate(() => {
          hitboxMotor.C1 = this.gripPosition;
          hitboxPart.Transparency = this.isEquipped ? 0 : 1;
        });

        this.OnDelete(() => unbindLifecycleUpdate());
      });
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

    for (const connection of this.connectionsList)
      connection.Disconnect();
    this.connectionsList.clear();

    for (const inst of this.instancesList) {
      inst.Destroy();
    }
    this.instancesList.clear();
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

    if (!this.environment.isServer) {
      const snd = new CWorldSoundInstance("Lunge", "rbxasset://sounds//swordlunge.wav");
      if (this.instancesList.size() > 0)
        snd.SetParent(this.instancesList[0] as BasePart);
      snd.Play().andThen(() => snd.Dispose());
    }

    this.currentState = SwordState.Lunge;
    this.stateChanged.Fire(this.currentState);

    task.wait(0.25);
    this._SetSwordGripPosition(true);
    task.wait(0.75);
    this._SetSwordGripPosition(false);

    this.currentState = SwordState.Idle;
    this.stateChanged.Fire(this.currentState);
    getPlayermodelFromEntity(this.id)?.animator.StopAnimation("toollunge");
  }

  async Swing() {
    if (!this.isEquipped) return;
    getPlayermodelFromEntity(this.id)?.animator.StopAnimation("toollunge");
    getPlayermodelFromEntity(this.id)?.animator.PlayAnimation("toolslash", "Action2", true);

    if (!this.environment.isServer) {
      const snd = new CWorldSoundInstance("Slash", "rbxasset://sounds//swordslash.wav");
      if (this.instancesList.size() > 0)
        snd.SetParent(this.instancesList[0] as BasePart);
      snd.Play().andThen(() => snd.Dispose());
    }

    this.currentState = SwordState.Swing;
    this.stateChanged.Fire(this.currentState);
    this._SetSwordGripPosition(false);
  }

  private _SetSwordGripPosition(value: boolean) {
    if (value)
      this.gripPosition = new CFrame(-1.5, 0, -1.5).mul(CFrame.Angles(0, -math.rad(90), 0));
    else
      this.gripPosition = new CFrame();
  }
}

// # Bindings & misc
registerEntityClass("SwordPlayerEntity", SwordPlayerEntity);

ServerInstance.serverCreated.Connect(server => {
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

  // Listening for damage
  server.network.listenPacket(`${NETWORK_ID}hit`, (packet) => {
    if (!packet.sender) return;

    const reader = BufferReader(packet.content);
    const hitIndex = reader.u8();
    const entityId = reader.string();

    const entity = getPlayerEntityFromController(server.entity, tostring(packet.sender.GetAttribute(gameValues.usersessionid)));
    if (!entity || !entity.IsA("SwordPlayerEntity")) return;

    const targetEntity = server.entity.entities.get(entityId);
    if (!targetEntity?.IsA("HealthEntity")) return;

    if (!CheckPlayers(entity, targetEntity)) return;

    let totalDealingDamage = 0;

    if (hitIndex === NetworkSwordHitIndex.LocalToOther) {
      totalDealingDamage = entity.currentState;

      if (teamHealingEnabled && targetEntity.IsA("PlayerEntity"))
        if (targetEntity.team === entity.team)
          totalDealingDamage = -totalDealingDamage;

      targetEntity.takeDamage(totalDealingDamage, entity);
    }

    if (hitIndex === NetworkSwordHitIndex.OtherToLocal) {
      if (!targetEntity.IsA("SwordPlayerEntity")) return;

      totalDealingDamage = entity.currentState;

      if (teamHealingEnabled && targetEntity.team === entity.team)
        totalDealingDamage = -totalDealingDamage;

      entity.takeDamage(totalDealingDamage, targetEntity);
    }
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
      server.network.sendPacket(`${NETWORK_ID}replication`, undefined, undefined, true);
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
        .andThen(ent => {
          ent.hitboxTouched.Connect((target, part) => ClientHandleHitboxTouched(ent, target, part, defaultEnvironments.network));
        }).finally(() => {
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
    const playermodel = getLocalPlayermodel();
    if (!entity || !entity.IsA("SwordPlayerEntity") || !playermodel || !DoesInstanceExist(playermodel.rig)) return;
    if (entity.health <= 0) return;

    startBufferCreation();
    entity.WriteStateBuffer();
    defaultEnvironments.network.sendPacket(`${NETWORK_ID}c_stateupd`, undefined, undefined, true);
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

