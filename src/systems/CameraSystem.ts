import { RunService, TweenService, UserInputService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import { BindFramerate } from "lifecycle";
import { RaposoConsole } from "logging";
import CTracelineParameter from "util/traceparam";

// # Constants & variables
const UserGameSettings = UserSettings().GetService("UserGameSettings");

// Camera rotation
const PITCH_LIMIT = 89;
// const ROTATION_SPEED_MOUSE = new Vector2(1, 0.77).mul(math.rad(0.5)); // (rad/s)
const ROTATION_SPEED_MOUSE = new Vector2(1, 0.77).mul(0.5); // (rad/s)
const ROTATION_SPEED_TOUCH = new Vector2(1, 0.66).mul(math.rad(1)); // (rad/s)
const ROTATION_SPEED_GAMEPAD = new Vector2(1, 0.77).mul(math.rad(4)); // (rad/s)

let cameraRotation = new Vector2(0, 0);

const CAMERA_INST = new Instance("Camera");

// Camera zoom
const ZOOM_TWEENTIME = 0.25;
const ZOOM_MAXDIST = 60;
const ZOOM_MINDIST = 5;
let targetZoomDistance = 20;
let currZoomDistance = targetZoomDistance;
let lastZoomDistance = targetZoomDistance;
let lastZoomDistanceChangedTime = 0;

// Shift lock
const SHIFTLOCK_OFFSET = new CFrame(2.75, 0, 0);
const SHIFTLOCK_KEYS: Enum.KeyCode["Name"][] = ["LeftShift", "RightShift"];
const SHIFTLOCK_TWEEN_TIME = 0.125;

let shiftlockEnabled = false;
let currShiftlockOffset = new CFrame();
let passedShiftlockTime = 0;

// Other

// # Namespace
export namespace CameraSystem {
  let trackingEntityId: string | undefined;

  export function getInputDirection() {
    const inversionFactor = new Vector2(1, UserGameSettings.GetCameraYInvertValue());

    let delta = Vector2.zero;

    // Mouse delta
    {
      const rawMouseDelta = UserInputService.GetMouseDelta();
      const mouseDeltaSens = UserInputService.MouseDeltaSensitivity || 1;

      const scaledRawDelta = rawMouseDelta.mul(mouseDeltaSens);
      const sensMultipliedDelta = new Vector2(scaledRawDelta.X * ROTATION_SPEED_MOUSE.X, scaledRawDelta.Y * ROTATION_SPEED_MOUSE.Y);

      delta = delta.add(sensMultipliedDelta);
    }

    return delta.mul(inversionFactor);
  }

  export function setTrackingEntity(entityId: string) {
    trackingEntityId = undefined;

    const entity = defaultEnvironments.entity.entities.get(entityId);
    if (!entity) {
      RaposoConsole.Warn(`Invalid entity id: ${entityId}`);
      return;
    }

    if (!entity.IsA("WorldEntity")) {
      RaposoConsole.Warn(`Entity ${entityId} (${entity.classname}) is not an WorldEntity.`);
      return;
    }

    trackingEntityId = entityId;
  }

  export function getTrackingEntity() {
    const entity = defaultEnvironments.entity.entities.get(trackingEntityId ?? "");
    if (!entity?.IsA("WorldEntity")) return;

    return entity;
  }

  export function setDistance(distance: number) {
    lastZoomDistance = currZoomDistance;
    targetZoomDistance = math.clamp(distance, ZOOM_MINDIST, ZOOM_MAXDIST);
    lastZoomDistanceChangedTime = time();
  }

  export function setRotation(rotation: Vector2) {
    cameraRotation = rotation;
  }

  export function setShiftLock(enabled: boolean) {
    shiftlockEnabled = enabled;
  }

  export function isShiftlockEnabled() {
    return shiftlockEnabled;
  }

  export function getOrigin() {
    return CAMERA_INST.CFrame;
  }
}

// # Functions
function updateMouseLock() {
  const mouseButtonDown = UserInputService.IsMouseButtonPressed("MouseButton2");

  const inputMovingCamera = mouseButtonDown;

  if (inputMovingCamera || shiftlockEnabled)
    UserInputService.MouseBehavior = shiftlockEnabled ? Enum.MouseBehavior.LockCenter : Enum.MouseBehavior.LockCurrentPosition;

  if (!inputMovingCamera && !shiftlockEnabled)
    UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
}

function updateCameraZoom() {
  const passedTime = time() - lastZoomDistanceChangedTime;
  const alpha = math.clamp(passedTime / ZOOM_TWEENTIME, 0, 1);

  const lerp = math.lerp(lastZoomDistance, targetZoomDistance, TweenService.GetValue(alpha, "Quad", "Out"));

  currZoomDistance = lerp;
}

function updateShiftlockTween(dt: number) {
  const addition = dt * (shiftlockEnabled ? 1 : -1);
  passedShiftlockTime = math.clamp(passedShiftlockTime + addition, 0, SHIFTLOCK_TWEEN_TIME);

  const alpha = math.clamp(passedShiftlockTime / SHIFTLOCK_TWEEN_TIME, 0, 1);
  currShiftlockOffset = new CFrame().Lerp(SHIFTLOCK_OFFSET, TweenService.GetValue(alpha, "Quad", "InOut"));
}

function UpdateCamera(dt: number) {
  if (CAMERA_INST.CameraType.Name !== "Scriptable")
    return;

  const entity = CameraSystem.getTrackingEntity();
  if (!entity) return;

  const inputDirection = CameraSystem.getInputDirection();
  let focusPoint = new Vector3();

  if (entity.IsA("PlayerEntity") && entity.humanoidModel) {
    focusPoint = entity.humanoidModel.GetPivot().add(new Vector3(0, 1.5, 0)).Position;
  }

  // Camera rotation input
  cameraRotation = new Vector2(
    cameraRotation.X - inputDirection.X,
    math.clamp(cameraRotation.Y - inputDirection.Y, -PITCH_LIMIT, PITCH_LIMIT),
  );

  let targetCFrame = new CFrame(focusPoint)
    .mul(CFrame.Angles(0, math.rad(cameraRotation.X), 0))
    .mul(currShiftlockOffset)
    .mul(CFrame.Angles(math.rad(cameraRotation.Y), 0, 0))
    .mul(new CFrame(0, 0, currZoomDistance));

  // Wall detection
  {
    const targetPosition = targetCFrame.Position;
    const direction = targetPosition.sub(focusPoint);
    const rotation = targetCFrame.Rotation;

    const raycast = workspace.Spherecast(
      focusPoint,
      1,
      direction,
      new CTracelineParameter(["World"], [], "Blacklist", false).GenerateTraceParams(defaultEnvironments.entity, false),
    );

    if (raycast)
      targetCFrame = new CFrame(focusPoint.add(direction.Unit.mul(raycast.Distance))).mul(rotation);
  }

  CAMERA_INST.CFrame = targetCFrame;
  CAMERA_INST.Focus = new CFrame(focusPoint);
}

// # Bindings
if (RunService.IsClient())
  UserInputService.InputBegan.Connect((input, busy) => {
    if (busy) return;

    if (SHIFTLOCK_KEYS.includes(input.KeyCode.Name))
      CameraSystem.setShiftLock(!shiftlockEnabled);
  });

if (RunService.IsClient())
  UserInputService.InputChanged.Connect((input, busy) => {
    if (input.UserInputType === Enum.UserInputType.MouseWheel)
      CameraSystem.setDistance(targetZoomDistance + (5 * -input.Position.Z));
  });

if (RunService.IsClient())
  BindFramerate(dt => {
    CAMERA_INST.CameraType = UserInputService.TouchEnabled ? Enum.CameraType.Custom : Enum.CameraType.Scriptable;

    updateMouseLock();
    updateCameraZoom();
    updateShiftlockTween(dt);
    UpdateCamera(dt); 
  });

// # Logic
if (RunService.IsClient()) {
  CAMERA_INST.Name = "PlayerCamera";
  CAMERA_INST.CameraType = Enum.CameraType.Scriptable;
  CAMERA_INST.Parent = workspace;

  workspace.CurrentCamera = CAMERA_INST;
}