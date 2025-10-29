import * as Services from "@rbxts/services";
import { getLocalPlayerEntity } from "controllers/LocalEntityController";
import { defaultEnvironments } from "defaultinsts";
import { RaposoConsole } from "logging";
import { createPlayermodelForEntity } from "providers/PlayermodelProvider";
import { PlayermodelRig } from "providers/PlayermodelProvider/rig";
import SessionInstance from "providers/SessionProvider";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferF32, writeBufferU8 } from "util/bufferwriter";
import { UTIL_TraceLine } from "util/traceline";
import { registerEntityClass } from ".";
import PlayerEntity from "./PlayerEntity";
import { MapContent, ObjectsFolder } from "providers/WorldProvider";
import { generateTracelineParameters } from "util/traceparam";

// # Types
declare global {
  interface GameEntities {
    GunPlayerEntity: typeof GunPlayerEntity;
  }
}

// # Constants & variables
const NETWORK_ID = "tps_";

const VIEWPORT_RAY_DISTANCE = 500;

const geometryTraceParams = generateTracelineParameters(false, [MapContent.Parts], [], defaultEnvironments.entity, [], [], true);
const playersTracelineParams = generateTracelineParameters(false, [MapContent.Parts], [], defaultEnvironments.entity, ["PlayerEntity"], [], true);

// # Functions

// # Class
export class GunPlayerEntity extends PlayerEntity {
  classname: keyof GameEntities = "GunPlayerEntity";

  readonly buttons = {
    mousepos: new Vector2(0.5, 0.5),
    attack1: false,
    attack2: false,
    reload: false,
  };

  private lastShotTime = 0;
  private weaponDelay = -1;

  private playermodel: PlayermodelRig | undefined;

  constructor(public controller: string, public appearanceId = 1) {
    super(controller, appearanceId);

    this.inheritanceList.add("GunPlayerEntity");

    this.OnSetupFinished(() => {
      if (this.environment.isServer) return;

      this.playermodel = createPlayermodelForEntity(this);

      const shootAttachment = new Instance("Attachment");
      shootAttachment.Parent = this.playermodel.rig["Right Arm"];
      shootAttachment.Name = "WEP_SHOOT_ATTACH";
    });
  }

  WriteStateBuffer() {
    super.WriteStateBuffer();

    writeBufferF32(this.lastShotTime);
  }

  ApplyStateBuffer(reader: ReturnType<typeof BufferReader>): void {
    super.ApplyStateBuffer(reader);
  }

  Destroy(): void { }

  Reload(): void { }

  Shoot(target: CFrame) {
    if (!this.playermodel || this.health <= 0) return;

    const currentTime = time();
    if (currentTime - this.lastShotTime < this.weaponDelay) return;
    this.lastShotTime = currentTime;

    const headPoint = this.playermodel.rig.FindFirstChild("Head", true);
    const weaponShootAttachment = this.playermodel.rig.FindFirstChild("WEP_SHOOT_ATTACH", true);

    if (!headPoint || !headPoint.IsA("BasePart")) return;
    if (!weaponShootAttachment || !weaponShootAttachment.IsA("Attachment")) return;

    const headtrace = UTIL_TraceLine(workspace, headPoint.CFrame.Position, target.Position, geometryTraceParams);
    const weptrace = UTIL_TraceLine(workspace, weaponShootAttachment.WorldCFrame.Position, headtrace.hitVec ?? headtrace.target, playersTracelineParams);

    {
      const part = new Instance("Part");
      part.Parent = ObjectsFolder;
      part.Size = new Vector3(0.1, 0.1, headtrace.distance);
      part.Anchored = true;
      part.CanCollide = false;
      part.CanQuery = false;
      part.CanTouch = false;
      part.Color = new Color3(0, 1, 0);
      part.Transparency = 0.5;
      part.CastShadow = false;
      part.CFrame = new CFrame(headtrace.origin, headtrace.hitVec ?? headtrace.target).mul(new CFrame(0, 0, -headtrace.distance * 0.5));

      Services.Debris.AddItem(part, 0.1);
    }

    {
      const part = new Instance("Part");
      part.Parent = ObjectsFolder;
      part.Size = new Vector3(0.1, 0.1, weptrace.distance);
      part.Anchored = true;
      part.CanCollide = false;
      part.CanQuery = false;
      part.CanTouch = false;
      part.Color = new Color3(1, 0, 0);
      part.Transparency = 0.5;
      part.CastShadow = false;
      part.CFrame = new CFrame(weptrace.origin, weptrace.hitVec ?? weptrace.target).mul(new CFrame(0, 0, -weptrace.distance * 0.5));

      Services.Debris.AddItem(part, 0.1);
    }

    if (weptrace.hitVec && weptrace.instance) {
      const entities = this.environment.getEntitiesFromInstance(weptrace.instance);

      for (const ent of entities)
        RaposoConsole.Info("WEAPON HIT ENTITY:", ent.id, ent.classname);
    }
  }

  Think(dt: number): void {
    if (this.environment.isPlayback) return;

    if (!this.environment.isServer) {
      if (this.GetUserFromController() !== Services.Players.LocalPlayer) return;

      const mouseLocation = Services.UserInputService.GetMouseLocation();
      const screenSize = workspace.CurrentCamera!.ViewportSize;

      const viewportRay = workspace.CurrentCamera!.ViewportPointToRay(mouseLocation.X, mouseLocation.Y);
      const trace = UTIL_TraceLine(workspace, viewportRay.Origin, viewportRay.Origin.add(viewportRay.Direction.mul(VIEWPORT_RAY_DISTANCE)), geometryTraceParams);

      this.buttons.mousepos = new Vector2(
        math.clamp(mouseLocation.X / screenSize.X, 0, 1),
        math.clamp(mouseLocation.Y / screenSize.Y, 0, 1),
      );

      if (this.buttons.attack1)
        this.Shoot(new CFrame(trace.hitVec || trace.target));

      return;
    }
  }
}

// # Bindings & misc
registerEntityClass("GunPlayerEntity", GunPlayerEntity);

SessionInstance.sessionCreated.Connect(server => {
  server.entity.entityCreated.Connect(entity => {
    if (!entity.IsA("GunPlayerEntity")) return;
  });

  // Replicating entities
  server.lifecycle.BindTickrate(() => {
    const entitiesList = server.entity.getEntitiesThatIsA("GunPlayerEntity");

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
    if (!entity || !entity.IsA("GunPlayerEntity") || entity.GetUserFromController() !== packet.sender) {
      RaposoConsole.Warn(`Invalid ${GunPlayerEntity} state update from ${packet.sender}.`);
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

        entity = defaultEnvironments.entity.createEntity("GunPlayerEntity", entityId, "", 1).expect();
        hasEntityInQueue = false;
      }

      listedServerEntities.add(entityId);
      entity.ApplyStateBuffer(reader);
    }

    // Deleting non-listed entities
    for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("GunPlayerEntity")) {
      if (listedServerEntities.has(ent.id)) continue;
      defaultEnvironments.entity.killThisFucker(ent);
    }
  });

  // Client state update
  defaultEnvironments.lifecycle.BindTickrate(() => {
    const entity = getLocalPlayerEntity();
    if (!entity || !entity.IsA("GunPlayerEntity") || entity.health <= 0) return;

    startBufferCreation();
    entity.WriteStateBuffer();
    defaultEnvironments.network.sendPacket(`${NETWORK_ID}c_stateupd`, undefined, undefined);
  });
}
