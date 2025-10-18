import { UserInputService, ContextActionService, RunService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import { getLocalPlayerEntity } from "./LocalEntityController";

// # Variables
let autoAttackEnabled = false;

// # Functions
function setAutoAttack(state: Enum.UserInputState, enabled: boolean) {
  if (state.Name !== "End") return;
  autoAttackEnabled = enabled;
}

function swordsAttack() {
  const entity = getLocalPlayerEntity();
  if (!entity?.IsA("SwordPlayerEntity") || entity.health <= 0) return;

  entity.Attack1();
}

function swordsEquipToggle(state: Enum.UserInputState) {
  if (state.Name !== "End") return;

  const entity = getLocalPlayerEntity();
  if (!entity?.IsA("SwordPlayerEntity") || entity.health <= 0) return;

  if (entity.IsWeaponEquipped())
    entity.Unequip();
  else
    entity.Equip();
}

function stylizeButton(actionName: string, anchorPoint: Vector2, position: UDim2, size: UDim2) {
  const btn = ContextActionService.GetButton(actionName);
  if (!btn) return;

  btn.AnchorPoint = anchorPoint;
  btn.Position = position;
  btn.Size = size;

  const aspectRatio = new Instance("UIAspectRatioConstraint");
  aspectRatio.AspectRatio = 1;
  aspectRatio.Parent = btn;
}

// # Execution

if (RunService.IsClient()) {
  UserInputService.InputBegan.Connect((input, busy) => {
    if (busy) return;

    if (input.UserInputType.Name === "MouseButton1" || input.UserInputType.Name === "Touch")
      swordsAttack();
  });
}

// Setup mobile inputs
if (RunService.IsClient()) {
  ContextActionService.BindAction("swords_equipToggle", (_, state) => swordsEquipToggle(state), true, Enum.KeyCode.One);
  ContextActionService.BindAction("swords_autoAttack", (_, state) => setAutoAttack(state, !autoAttackEnabled), true, Enum.KeyCode.R);

  ContextActionService.SetTitle("swords_equipToggle", "Equip");
  ContextActionService.SetTitle("swords_autoAttack", "AC");

  stylizeButton(
    "swords_equipToggle",
    new Vector2(0, 0.5),
    new UDim2(0, 0, 0.5, 0),
    UDim2.fromScale(0.3, 0.3),
  );

  stylizeButton(
    "swords_autoAttack",
    new Vector2(0, 1),
    new UDim2(0, 0, 1, 0),
    UDim2.fromScale(0.25, 0.25),
  );
}

if (RunService.IsClient())
  defaultEnvironments.lifecycle.BindTickrate(() => {
    const entity = getLocalPlayerEntity();
    if (!entity || entity.health <= 0) return;

    if (autoAttackEnabled && entity.IsA("SwordPlayerEntity"))
      entity.Attack1();
  });