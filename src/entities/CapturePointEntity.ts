import { BufferReader } from "util/bufferreader";
import { writeBufferBool, writeBufferF32, writeBufferString, writeBufferU8, writeBufferVector } from "util/bufferwriter";
import { registerEntityClass } from ".";
import PlayerEntity, { PlayerTeam } from "./PlayerEntity";
import WorldEntity from "./WorldEntity";

declare global {
  interface GameEntities {
    CapturePointEntity: typeof CapturePointEntity;
  }
}

// # Constants & variables

// # Functions
function IsPointInZone(point: Vector3, cf: CFrame, size: Vector3) {
  {
    const extremeLeft = cf.Position.X - size.X * 0.5;
    const extremeRight = cf.Position.X + size.X * 0.5;
    if (point.X < extremeLeft || point.X > extremeRight) return false;
  }
  {
    const extremeTop = cf.Position.Y - size.Y * 0.5;
    const extremeBottom = cf.Position.Y + size.Y * 0.5;
    if (point.Y < extremeTop || point.Y > extremeBottom) return false;
  }
  {
    const extremeFront = cf.Position.Z - size.Z * 0.5;
    const extremeBack = cf.Position.Z + size.Z * 0.5;
    if (point.Z < extremeFront || point.Z > extremeBack) return false;
  }

  return true;
}

// # Class
export default class CapturePointEntity extends WorldEntity {
  readonly classname: keyof GameEntities = "CapturePointEntity";

  velocity = new Vector3();

  current_team = PlayerTeam.Spectators;
  capture_progress = 0; // (float) -1(raiders) to 1(defenders).
  capture_speed = 2.5;
  is_instant_cap = false;

  constructor(public origin: CFrame, public size: Vector3) {
    super();
    this.inheritanceList.add("CapturePointEntity");
  }

  WriteStateBuffer(): void {
    writeBufferString(this.id);

    // These must be at the top for quick entity creation
    writeBufferVector(this.origin.Position.X, this.origin.Position.Y, this.origin.Position.Z);
    writeBufferVector(this.origin.ToOrientation()[1], this.origin.ToOrientation()[0], this.origin.ToOrientation()[2]);
    writeBufferVector(this.size.X, this.size.Y, this.size.Z);

    writeBufferF32(this.capture_progress);
    writeBufferU8(this.capture_speed);
    writeBufferU8(this.current_team);
    writeBufferBool(this.is_instant_cap);
  }

  ApplyStateBuffer(state: buffer): void {
    if (this.environment.isServer && this.environment.isPlayback) return;

    const reader = BufferReader(state);
    reader.string(); // Entity ID (o/bvious)

    const pos = reader.vec();
    const rot = reader.vec();
    const size = reader.vec();

    const captureProgress = reader.f32();
    const captureSpeed = reader.u8();
    const currentTeam = reader.u8();
    const instantCap = reader.bool();

    this.origin = new CFrame(pos.x, pos.y, pos.z)
      .mul(CFrame.Angles(math.rad(rot.x), math.rad(rot.y), math.rad(rot.z)));
    this.size = new Vector3(size.x, size.y, size.z);

    this.capture_progress = captureProgress;
    this.capture_speed = captureSpeed;
    this.current_team = currentTeam;
    this.is_instant_cap = instantCap;
  }

  Think(dt: number): void {
    
  }
  
  UpdateCaptureProgress(dt: number) {
    let total_capture_multiplier = 0;

    for (const ent of this.GetPlayersOnHitbox()) {
      total_capture_multiplier += ent.team === PlayerTeam.Defenders ? 1 : -1;
    }

    this.capture_progress = math.clamp(this.capture_progress + ((this.capture_speed * total_capture_multiplier) * dt), -1, 1);

    if (this.is_instant_cap)
      this.capture_progress = math.sign(total_capture_multiplier);

    if (this.capture_progress > 0)
      this.current_team = PlayerTeam.Defenders;

    if (this.capture_progress < 0)
      this.current_team = PlayerTeam.Raiders;
  }

  GetPlayersOnHitbox() {
    const playersList: PlayerEntity[] = [];

    for (const ent of this.environment.getEntitiesThatIsA("PlayerEntity")) {
      if (!ent.GetUserFromController()) continue;
      if (ent.health <= 0 || ent.team === PlayerTeam.Spectators) continue;
      if (!IsPointInZone(ent.origin.Position, this.origin, this.size)) continue;

      playersList.push(ent);
    }

    return playersList;
  }

  Destroy(): void { }
}

// # Misc
registerEntityClass("CapturePointEntity", CapturePointEntity);
