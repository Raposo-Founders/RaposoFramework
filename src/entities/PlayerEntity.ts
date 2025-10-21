import { Players, RunService, TweenService } from "@rbxts/services";
import { gameValues } from "gamevalues";
import { BufferReader } from "util/bufferreader";
import { writeBufferBool, writeBufferString, writeBufferU16, writeBufferU64, writeBufferU8, writeBufferVector } from "util/bufferwriter";
import Signal from "util/signal";
import { EntityManager, registerEntityClass } from ".";
import HealthEntity from "./HealthEntity";
import { DoesInstanceExist, ErrorObject } from "util/utilfuncs";
import { modelsFolder } from "folders";
import { defaultEnvironments } from "defaultinsts";
import WorldProvider from "providers/WorldProvider";

// # Types
declare global {
  interface GameEntities {
    PlayerEntity: typeof PlayerEntity;
  }
}

interface PlayerEntityHumanoidModel extends Model {
  Humanoid: Humanoid;
  HumanoidRootPart: Part;
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
  anchored = false;

  humanoidModel: PlayerEntityHumanoidModel | undefined;

  team = PlayerTeam.Spectators;

  stats = {
    kills: 0,
    deaths: 0,
    ping: 0,
    damage: 0,
    country: "US",
  };

  constructor(public controller: string, public appearanceId = 1) {
    super();
    this.inheritanceList.add("PlayerEntity");

    if (RunService.IsClient())
      task.defer(() => {
        task.wait();
        if (this.environment.isServer) {
          this.humanoidModel = ErrorObject("humanoidModel is not available for the server.");
          return;
        }

        const humanoidModel = modelsFolder.WaitForChild("PlayerEntityHumanoidRig", 1)?.Clone() as PlayerEntityHumanoidModel | undefined;
        assert(humanoidModel, `No PlayerEntityHumanoidRig has been found on the models folder.`);

        humanoidModel.Name = this.id;
        humanoidModel.Parent = WorldProvider.ObjectsFolder;
        humanoidModel.Humanoid.SetStateEnabled("PlatformStanding", false);
        humanoidModel.Humanoid.SetStateEnabled("Ragdoll", false);
        humanoidModel.Humanoid.SetStateEnabled("Dead", false);
        humanoidModel.Humanoid.BreakJointsOnDeath = false;

        // Lerping positions
        let currentPlayingTween: Tween | undefined;

        const killCurrentTween = () => {
          let currentCFrame = new CFrame();

          if (DoesInstanceExist(humanoidModel))
            currentCFrame = humanoidModel.HumanoidRootPart.CFrame;

          currentPlayingTween?.Cancel();
          currentPlayingTween?.Destroy();
          currentPlayingTween = undefined;

          if (DoesInstanceExist(humanoidModel))
            humanoidModel.HumanoidRootPart.CFrame = currentCFrame;
        };

        const disconnectBinding = defaultEnvironments.lifecycle.BindTickrate(ctx => {
          if (!DoesInstanceExist(humanoidModel)) return;

          killCurrentTween();

          if (this.GetUserFromController() === Players.LocalPlayer) {
            humanoidModel.HumanoidRootPart.Anchored = this.health <= 0 || this.anchored;
            Players.LocalPlayer.Character = humanoidModel;
            return;
          }

          if (this.GetUserFromController() !== Players.LocalPlayer) {
            if (Players.LocalPlayer.Character === humanoidModel)
              Players.LocalPlayer.Character = undefined;
          }

          const currentCFrame = humanoidModel.HumanoidRootPart.CFrame;
          const direction = new CFrame(currentCFrame.Position, this.origin.Position).LookVector;
          const distance = currentCFrame.Position.sub(this.origin.Position).Magnitude;

          humanoidModel.HumanoidRootPart.Anchored = true;
          humanoidModel.HumanoidRootPart.AssemblyLinearVelocity = direction.mul(distance);

          if (distance >= 5) {
            humanoidModel.PivotTo(this.origin);
            return;
          }

          currentPlayingTween = TweenService.Create(humanoidModel.HumanoidRootPart, new TweenInfo(ctx.tickrate, Enum.EasingStyle.Linear), { CFrame: this.origin });
          currentPlayingTween.Play();
        });


        this.OnDelete(() => {
          disconnectBinding();
          killCurrentTween();

          humanoidModel.Destroy();
          rawset(this, "humanoidModel", undefined);
        });

        rawset(this, "humanoidModel", humanoidModel);

      });
  }

  GetUserFromController() {
    for (const user of Players.GetPlayers()) {
      if (user.GetAttribute(gameValues.usersessionid) !== this.controller) continue;
      return user;
    }
  }

  WriteStateBuffer(): void {
    writeBufferString(this.id);
    writeBufferU16(this.health);
    writeBufferU16(this.maxHealth);

    writeBufferVector(this.origin.Position.X, this.origin.Position.Y, this.origin.Position.Z);
    {
      const [rY, rX, rZ] = this.origin.ToOrientation();
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
    writeBufferString(this.stats.country);
  }

  ApplyStateBuffer(state: buffer): void {
    const isLocalPlayer = this.GetUserFromController() === Players.LocalPlayer;

    const reader = BufferReader(state);
    reader.string(); // Entity ID (obvious)

    const health = reader.u16();
    const maxHealth = reader.u16();

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
    const country = reader.string();

    let vectorPosition = new Vector3(position.x, position.y, position.z);
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
        if (!isLocalPlayer && this.team === PlayerTeam.Spectators)
          vectorPosition = new Vector3(0, -1000, 0);

        this.TeleportTo(new CFrame(vectorPosition).mul(rotationCFrame));
      }

    this.size = new Vector3(size.x, size.y, size.z);
    this.velocity = new Vector3(velocity.x, velocity.y, velocity.z);
    this.grounded = this.environment.isServer || this.environment.isPlayback || (!this.environment.isServer && this.GetUserFromController() !== Players.LocalPlayer)
      ? grounded
      : this.grounded;
    this.anchored = pendingTeleport;

    if (this.environment.isPlayback || !this.environment.isServer) {
      if (this.health !== health) {
        if (this.health <= 0 && health > 0)
          this.spawned.Fire(this.origin);

        if (this.health > 0 && health <= 0)
          this.died.Fire();
      }

      this.health = health;
      this.maxHealth = maxHealth;

      this.stats.kills = kills;
      this.stats.deaths = deaths;
      this.stats.ping = ping;
      this.stats.damage = damage;
      this.stats.country = country;

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

      for (const inst of WorldProvider.ObjectsFolder.GetChildren()) {
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

    this.canDealDamage = false;

    task.spawn(() => {
      task.wait(3);
      this.canDealDamage = true;
    });

    this.TeleportTo(origin);
    this.spawned.Fire(origin);
  }

  TeleportTo(origin: CFrame) {
    this.origin = origin;
    this.pendingTeleport = true;

    if (!this.environment.isServer && this.humanoidModel && this.GetUserFromController() === Players.LocalPlayer) {
      this.humanoidModel.PivotTo(this.origin);
      this.humanoidModel.HumanoidRootPart.AssemblyLinearVelocity = Vector3.zero;
    }
  }

  takeDamage(amount: number, attacker?: import("./WorldEntity")): void {
    if (this.health <= 0) return;

    super.takeDamage(amount, attacker);

    if (attacker?.IsA("PlayerEntity") && amount > 0)
      attacker.stats.damage += amount;

    if (this.health <= 0) {
      this.canDealDamage = false;
      this.stats.deaths++;

      if (attacker?.IsA("PlayerEntity"))
        attacker.stats.kills++;
    }
  }

  Destroy(): void { }
}

// # Misc
registerEntityClass("PlayerEntity", PlayerEntity);
