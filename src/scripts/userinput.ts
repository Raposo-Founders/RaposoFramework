import { RunService, UserInputService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import { getLocalPlayerEntity } from "util/localent";

// # Constants & variables
let swordEquipped = false;
let autoclickerEnabled = false;

// # Functions

// # Execution
if (RunService.IsClient())
  defaultEnvironments.lifecycle.BindTickrate(() => {
    const localEntity = getLocalPlayerEntity(defaultEnvironments.entity);
    if (!localEntity) return;

    if (localEntity.IsA("SwordPlayerEntity")) {
      if (swordEquipped)
        localEntity.Equip();
      else
        localEntity.Unequip();

      if (autoclickerEnabled)
        localEntity.Attack1();
    }
  });

if (RunService.IsClient())
  UserInputService.InputBegan.Connect((input, busy) => {
    if (busy) return;

    const localEntity = getLocalPlayerEntity(defaultEnvironments.entity);
    if (!localEntity) return;

    if (input.KeyCode.Name === "One")
      swordEquipped = !swordEquipped;

    if (input.KeyCode.Name === "R")
      autoclickerEnabled = !autoclickerEnabled;

    if ((input.UserInputType.Name === "MouseButton1" || input.UserInputType.Name === "Touch") && localEntity.IsA("SwordPlayerEntity"))
      localEntity.Attack1();
  });