import { RunService, UserInputService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import { InputSystem } from "systems/InputSystem";
import { getLocalPlayerEntity } from "./LocalEntityController";

// # Variables

// # Functions
export function getLocalGunsEntity() {
  const localEntity = getLocalPlayerEntity();
  if (!localEntity?.IsA("GunPlayerEntity")) return;
  return localEntity;
}

export function setAttack(value: boolean) {
  const localEntity = getLocalGunsEntity();
  if (!localEntity) return;

  localEntity.buttons.attack1 = value;
}

export function updateMousePosition() {
  const localEntity = getLocalGunsEntity();
  if (!localEntity) return;

  const camera = workspace.CurrentCamera!;
  const mousepos = UserInputService.GetMouseLocation();
  const viewportsize = camera.ViewportSize;

  localEntity.buttons.mousepos = mousepos.div(viewportsize);
}

// # Execution
InputSystem.RegisterAction("tps_attack", () => setAttack(true), () => setAttack(false));
InputSystem.RegisterAction("tps_reload", () => {
  const localEntity = getLocalGunsEntity();
  if (!localEntity) return;

  localEntity.Reload();
});

InputSystem.BindKeyToAction("MouseButton1", "tps_attack");

if (RunService.IsClient())
  defaultEnvironments.lifecycle.BindUpdate(() => {
    updateMousePosition();
  });
