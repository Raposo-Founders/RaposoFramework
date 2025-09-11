import { Players, UserInputService } from "@rbxts/services";
import { defaultEnvironments } from "shared/defaultinsts";

// # Constants & variables
let swordEquipped = false;

// # Functions
function getLocalPlayerEntity() {
  for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("PlayerEntity"))
    if (ent.userid === Players.LocalPlayer.UserId)
      return ent;
}

// # Execution
defaultEnvironments.lifecycle.BindUpdate(() => {
  const localEntity = getLocalPlayerEntity();
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