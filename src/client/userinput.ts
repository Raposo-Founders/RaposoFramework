import { Players, UserInputService } from "@rbxts/services";
import { defaultEnvironments } from "shared/defaultinsts";
import { getLocalPlayerEntity } from "shared/util/localent";

// # Constants & variables
let swordEquipped = false;

// # Functions

// # Execution
defaultEnvironments.lifecycle.BindUpdate(() => {
  const localEntity = getLocalPlayerEntity(defaultEnvironments.entity);
  if (!localEntity) return;

  if (localEntity.IsA("SwordPlayerEntity")) {
    if (swordEquipped)
      localEntity.Equip();
    else
      localEntity.Unequip();
  }
});

UserInputService.InputBegan.Connect((input, busy) => {
  if (busy) return;

  if (input.KeyCode.Name === "One")
    swordEquipped = !swordEquipped;
});