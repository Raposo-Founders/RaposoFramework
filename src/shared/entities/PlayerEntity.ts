import { Players } from "@rbxts/services";
import { BufferReader } from "shared/util/bufferreader";
import { finalizeBufferCreation, startBufferCreation, writeBufferBool, writeBufferString, writeBufferU16, writeBufferU8, writeBufferVector } from "shared/util/bufferwriter";
import Signal from "shared/util/signal";
import { EntityManager, registerEntityClass } from ".";
import HealthEntity from "./HealthEntity";

declare global {
  interface GameEntities {
    PlayerEntity: typeof PlayerEntity;
  }
}

// # Constants & variables
export enum PlayerTeam {
  Defenders,
  Raiders,
  Spectators,
}

const positionDifferenceThreshold = 3;

// # Functions
export function getPlayerEntityFromUserId(environment: EntityManager, userid: number) {
  for (const ent of environment.getEntitiesThatIsA("PlayerEntity"))
    if (ent.userid === userid)
      return ent;
}

// # Class
export default class PlayerEntity extends HealthEntity {
  readonly classname: keyof GameEntities = "PlayerEntity";

  readonly spawned = new Signal<[origin: CFrame]>();
  health = 100;
  maxHealth = 100;

  pendingTeleport = false;
  origin = new CFrame();
  size = new Vector3(2, 5, 2);
  velocity = new Vector3();
  grounded = false;

  readonly teleportPlayermodelSignal = new Signal<[origin: CFrame]>();

  team = PlayerTeam.Spectators;
  userid = 0;

  stats = {
    kills: 0,
    deaths: 0,
    ping: 0,
    damage: 0,
  };

  constructor() {
    super();
    this.inheritanceList.add("PlayerEntity");
  }

  WriteStateBuffer(): void {
    writeBufferU8(this.health);
    writeBufferU8(this.maxHealth);

    writeBufferVector(this.origin.Position.X, this.origin.Position.Y, this.origin.Position.Z);
    {
      const [rX, rY, rZ] = this.origin.ToEulerAnglesXYZ();
      writeBufferVector(math.round(math.deg(rX)), math.round(math.deg(rY)), math.round(math.deg(rZ)));
    }
    writeBufferVector(this.size.X, this.size.Y, this.size.Z);
    writeBufferVector(this.velocity.X, this.velocity.Y, this.velocity.Z);
    writeBufferBool(this.pendingTeleport);
    writeBufferBool(this.grounded);

    writeBufferU8(this.team);
    writeBufferString(tostring(this.userid));
    writeBufferU16(this.stats.kills);
    writeBufferU16(this.stats.deaths);
    writeBufferU16(this.stats.ping);
    writeBufferU16(this.stats.damage);
  }

  ApplyStateBuffer(state: buffer): void {
    const reader = BufferReader(state);

    const health = reader.u8();
    const maxHealth = reader.u8();

    const position = reader.vec();
    const rotation = reader.vec();
    const size = reader.vec();
    const velocity = reader.vec();
    const pendingTeleport = reader.bool();
    const grounded = reader.bool();

    const teamIndex = reader.u8();
    const userId = tonumber(reader.string()) || 0;
    const kills = reader.u16();
    const deaths = reader.u16();
    const ping = reader.u16();
    const damage = reader.u16();

    const vectorPosition = new Vector3(position.x, position.y, position.z);
    const rotationCFrame = CFrame.Angles(math.rad(rotation.y), math.rad(rotation.x), math.rad(rotation.z));

    if (this.environment.isServer && !this.environment.isPlayback) {
      const fixedPosition = vectorPosition.mul(new Vector3(1, 0, 1));
      const differenceMagnitute = fixedPosition.sub(new Vector3(position.x, 0, position.z)).Magnitude;

      if (differenceMagnitute <= positionDifferenceThreshold)
        this.origin = new CFrame(vectorPosition).mul(rotationCFrame);
    }

    if (!this.environment.isServer)
      if (this.environment.isPlayback || (this.userid === Players.LocalPlayer.UserId && pendingTeleport)) {
        this.origin = new CFrame(vectorPosition).mul(rotationCFrame);
        this.teleportPlayermodelSignal.Fire(this.origin);
      }

    this.size = new Vector3(size.x, size.y, size.z);
    this.velocity = new Vector3(velocity.x, velocity.y, velocity.z);
    this.grounded = grounded;

    if (this.environment.isPlayback || !this.environment.isServer) {
      this.health = health;
      this.maxHealth = maxHealth;

      this.stats.kills = kills;
      this.stats.deaths = deaths;
      this.stats.ping = ping;
      this.stats.damage = damage;

      this.team = teamIndex;
      this.userid = userId;
    }
  }

  Think(dt: number): void {
      
  }

  Spawn(origin: CFrame) {
    this.maxHealth = 100;
    this.health = this.maxHealth;

    this.TeleportTo(origin);
    this.spawned.Fire(origin);
  }

  TeleportTo(origin: CFrame) {
    if (!this.environment.isServer)
      this.teleportPlayermodelSignal.Fire(origin);

    this.origin = origin;
    this.pendingTeleport = true;
  }

  takeDamage(amount: number, attacker?: import("./worldent")): void {
    super.takeDamage(amount, attacker);

    if (attacker?.IsA("PlayerEntity") && amount > 0)
      attacker.stats.damage += amount;
  }

  Destroy(): void { }
}

// # Misc
registerEntityClass("PlayerEntity", PlayerEntity);
