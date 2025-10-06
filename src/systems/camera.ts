import { RaposoConsole } from "logging";
import { defaultEnvironments } from "defaultinsts";
import { BindFramerate } from "lifecycle";

export class PlayerCamera {
  readonly cameraInstance = new Instance("Camera");

  protected currentCFrame = new CFrame();
  protected targetEntity: string | undefined = undefined;

  protected connections: Callback[] = [];

  distance = 10;
  cameraMode: Enum.CameraMode = Enum.CameraMode.Classic;

  constructor() {
    this.cameraInstance.Name = "PlayerCamera";
    this.cameraInstance.CameraType = Enum.CameraType.Scriptable;
    this.cameraInstance.Parent = workspace;

    {
      let updateConnection: RBXScriptConnection | undefined;
      updateConnection = BindFramerate((dt) => {
        this.UpdateTrackingEntity();
      });

      this.connections.push(() => {
        updateConnection?.Disconnect();
        updateConnection = undefined;
      });
    }
  }

  protected UpdateTrackingEntity() {
    if (!this.targetEntity) return;

    const entity = defaultEnvironments.entity.entities.get(this.targetEntity);
    if (!entity?.IsA("WorldEntity")) {
      this.targetEntity = undefined;
      return;
    }

    if (this.cameraMode === Enum.CameraMode.LockFirstPerson) {
      this.currentCFrame = entity.origin;
    }
  }

  GetCFrame() {
    return this.cameraInstance.CFrame;
  }

  SetCFrame(cf: CFrame) {
    this.currentCFrame = cf;
  }

  TrackEntity(entityId: string) {
    this.targetEntity = undefined;

    const entity = defaultEnvironments.entity.entities.get(entityId);
    if (!entity) {
      RaposoConsole.Warn(`Invalid entity id: ${entityId}`);
      return;
    }

    if (!entity.IsA("WorldEntity")) {
      RaposoConsole.Warn(`Entity ${entityId} (${entity.classname}) is not an WorldEntity.`);
      return;
    }

    this.targetEntity = entityId;
  }
}