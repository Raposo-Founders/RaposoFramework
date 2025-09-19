import { Players } from "@rbxts/services";
import { gameValues } from "shared/gamevalues";
import { BufferReader } from "shared/util/bufferreader";
import { writeBufferBool, writeBufferString, writeBufferU16, writeBufferU64, writeBufferU8, writeBufferVector } from "shared/util/bufferwriter";
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
export function getPlayerEntityFromController(environment: EntityManager, controller: string) {
  for (const ent of environment.getEntitiesThatIsA("PlayerEntity"))
    if (ent.controller === controller)
      return ent;
}

// # Class
export default class PlayerEntity extends HealthEntity {
  readonly classname: keyof GameEntities = "PlayerEntity";

  readonly spawned = new Signal<[origin: CFrame]>();
  health = 0;
  maxHealth = 100;

  pendingTeleport = false;
  origin = new CFrame();
  size = new Vector3(2, 5, 2);
  velocity = new Vector3();
  grounded = false;

  readonly teleportPlayermodelSignal = new Signal<[origin: CFrame]>();

  team = PlayerTeam.Spectators;

  stats = {
    kills: 0,
    deaths: 0,
    ping: 0,
    damage: 0,
  };

  constructor(public controller: string, public appearanceId = 1) {
    super();
    this.inheritanceList.add("PlayerEntity");
  }

  GetUserFromController() {
    for (const user of Players.GetPlayers()) {
      if (user.GetAttribute(gameValues.usersessionid) !== this.controller) continue;
      return user;
    }
  }

  WriteStateBuffer(): void {
    writeBufferString(this.id);
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
    writeBufferString(this.controller);
    writeBufferU64(this.appearanceId);
    writeBufferU16(this.stats.kills);
    writeBufferU16(this.stats.deaths);
    writeBufferU16(this.stats.ping);
    writeBufferU16(this.stats.damage);
  }

  ApplyStateBuffer(state: buffer): void {
    const isLocalPlayer = this.GetUserFromController() === Players.LocalPlayer;

    const reader = BufferReader(state);
    reader.string(); // Entity ID (obvious)

    const health = reader.u8();
    const maxHealth = reader.u8();

    const position = reader.vec();
    const rotation = reader.vec();
    const size = reader.vec();
    const velocity = reader.vec();
    const pendingTeleport = reader.bool();
    const grounded = reader.bool();

    const teamIndex = reader.u8();
    const controllerId = reader.string();
    const appearanceId = reader.u64();
    const kills = reader.u16();
    const deaths = reader.u16();
    const ping = reader.u16();
    const damage = reader.u16();

    const vectorPosition = new Vector3(position.x, position.y, position.z);
    const rotationCFrame = CFrame.Angles(math.rad(rotation.y), math.rad(rotation.x), math.rad(rotation.z));

    if (this.environment.isServer && !this.environment.isPlayback) {
      const requestedPosition = new Vector2(position.x, position.z);
      const currentPosition = new Vector2(this.origin.Position.X, this.origin.Position.Z);
      const differenceMagnitute = requestedPosition.sub(currentPosition).Magnitude;

      if (differenceMagnitute <= positionDifferenceThreshold) {
        this.origin = new CFrame(vectorPosition).mul(rotationCFrame);
        this.pendingTeleport = false;
      }
    }

    // Client - Update position
    if (!this.environment.isServer)
      if (this.environment.isPlayback || (isLocalPlayer && pendingTeleport) || !isLocalPlayer) {
        this.origin = new CFrame(vectorPosition).mul(rotationCFrame);
        this.teleportPlayermodelSignal.Fire(this.origin);
      }

    this.size = new Vector3(size.x, size.y, size.z);
    this.velocity = new Vector3(velocity.x, velocity.y, velocity.z);
    this.grounded = this.environment.isPlayback || (!this.environment.isServer && this.GetUserFromController() !== Players.LocalPlayer)
      ? grounded
      : this.grounded;

    if (this.environment.isPlayback || !this.environment.isServer) {
      if (this.health !== health) {
        if (this.health <= 0 && health > 0)
          this.spawned.Fire(this.origin);
      }

      this.health = health;
      this.maxHealth = maxHealth;

      this.stats.kills = kills;
      this.stats.deaths = deaths;
      this.stats.ping = ping;
      this.stats.damage = damage;

      this.team = teamIndex;
      this.controller = controllerId;
      this.appearanceId = appearanceId;
    }
  }

  Think(dt: number): void {
      
  }

  Spawn(origin?: CFrame) {

    // Get the target spawn for the current team
    if (!origin) {
      const availableSpawns: BasePart[] = [];

      for (const inst of this.environment.world.objects.GetChildren()) {
        if (!inst.IsA("BasePart") || inst.Name !== `info_player_${PlayerTeam[this.team].lower()}`) continue;
        availableSpawns.push(inst);
      }

      availableSpawns.sort((a, b) => {
        return (tonumber(a.GetAttribute("LastUsedTime")) || 0) < (tonumber(b.GetAttribute("LastUsedTime")) || 0);
      });

      origin = availableSpawns[0].CFrame;
      availableSpawns[0].SetAttribute("LastUsedTime", time());
    }

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
