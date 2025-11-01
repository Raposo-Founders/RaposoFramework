import * as Services from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import { RaposoConsole } from "logging";
import { createHealthBarForEntity } from "./healthbar";
import { PlayermodelRig } from "./rig";
import { colorTable } from "UI/values";
import { getLocalPlayerEntity } from "controllers/LocalEntityController";
import { DoesInstanceExist } from "util/utilfuncs";

// # Constants & variables
const entityPlayermodels = new Map<EntityId, PlayermodelRig>();

const humanoidFetchDescriptionMaxAttempts = 5;

// # Functions
export async function fetchHumanoidDescription(userid: number) {
  userid = math.max(userid, 1);

  let description: HumanoidDescription | undefined;
  let totalAttempts = 0;

  while (description === undefined) {
    totalAttempts++;
    if (totalAttempts >= humanoidFetchDescriptionMaxAttempts) {
      RaposoConsole.Warn(`Failed to fetch HumanoidDescription ${userid} after ${humanoidFetchDescriptionMaxAttempts} attempts.`);
      break;
    }

    const [success, obj] = pcall(() => Services.Players.GetHumanoidDescriptionFromUserId(math.max(userid, 1)));
    if (!success) {
      RaposoConsole.Warn(`Failed to fetch HumanoidDescription, retrying in 5 seconds...\n${obj}`);
      task.wait(5);
      continue;
    }

    description = obj;
    break;
  }

  return description;
}

export function refreshPlayermodelAppearance(playermodel: PlayermodelRig, controller?: number) {
  if (!controller) {
    playermodel.SetDescription();
    return;
  }

  fetchHumanoidDescription(controller).andThen(description => playermodel.SetDescription(description));
}

export function getPlayermodelFromEntity(entityId: EntityId) {
  return entityPlayermodels.get(entityId);
}

export function createPlayermodelForEntity(entity: PlayerEntity) {
  const playermodel = new PlayermodelRig();
  // refreshPlayermodelAppearance(playermodel, entity.GetUserFromController()?.UserId);

  entity.spawned.Connect(() => {
    playermodel.SetMaterial();
    playermodel.SetTransparency();
    playermodel.SetJointsEnabled(true);

    for (const inst of playermodel.rig.GetChildren()) {
      if (!inst.IsA("BasePart")) continue;

      inst.AssemblyLinearVelocity = new Vector3();
      inst.AssemblyAngularVelocity = new Vector3();
    }

    refreshPlayermodelAppearance(playermodel, entity.GetUserFromController()?.UserId);
  });

  entity.died.Connect(() => {
    playermodel.SetMaterial();
    playermodel.SetTransparency();
    playermodel.SetJointsEnabled(false);

    for (const inst of playermodel.rig.GetChildren()) {
      if (!inst.IsA("BasePart")) continue;

      inst.AssemblyLinearVelocity = new Vector3(
        math.random(-50, 50),
        50,
        math.random(-50, 50),
      );
      inst.AssemblyAngularVelocity = new Vector3(
        math.random(-45, 45),
        math.random(-45, 45),
        math.random(-45, 45),
      );
    }
  });

  for (const inst of playermodel.rig.GetChildren()) {
    if (!inst.IsA("BasePart")) continue;
    entity.AssociateInstance(inst);
  }

  const unbindConnection1 = defaultEnvironments.lifecycle.BindLateUpdate(() => {
    const entityPart = entity.humanoidModel?.HumanoidRootPart;
    const playermodelPart = playermodel.rig.PrimaryPart;

    if (playermodelPart && entityPart && entity.health > 0) {
      // playermodelPart.Anchored = true;

      if (entity.GetUserFromController() === Services.Players.LocalPlayer)
        playermodelPart.CFrame = entityPart.CFrame;
      playermodelPart.AssemblyLinearVelocity = entityPart.AssemblyLinearVelocity;
    }

    playermodel.animator.velocity = entity.humanoidModel?.HumanoidRootPart.AssemblyLinearVelocity || Vector3.zero;
    playermodel.animator.is_grounded = entity.grounded;
    playermodel.animator.Update();

    // Update highlight
    let fillColor = colorTable.spectatorsColor;
    if (entity.team === PlayerTeam.Defenders) fillColor = colorTable.defendersColor;
    if (entity.team === PlayerTeam.Raiders) fillColor = colorTable.raidersColor;

    playermodel.highlight.Enabled = entity.GetUserFromController() !== Services.Players.LocalPlayer;
    playermodel.highlight.OutlineColor = Color3.fromHex(fillColor);

    {
      const localEntity = getLocalPlayerEntity();
      if (localEntity && entity !== localEntity)
        playermodel.highlight.DepthMode = localEntity.team === entity.team ? Enum.HighlightDepthMode.AlwaysOnTop : Enum.HighlightDepthMode.Occluded;
    }
  });

  // Playermodel position update
  let currentTween: Tween | undefined;
  const unbindConnection2 = defaultEnvironments.lifecycle.BindTickrate(ctx => {
    const entityPart = entity.humanoidModel?.HumanoidRootPart;
    const playermodelPart = playermodel.rig.PrimaryPart;
    if (entity.health <= 0 || !DoesInstanceExist(entityPart) || !DoesInstanceExist(playermodelPart)) return;

    if (currentTween) {
      const currentPosition = playermodelPart.CFrame;

      currentTween.Cancel();
      currentTween.Destroy();

      playermodelPart.CFrame = currentPosition;
    }

    currentTween = Services.TweenService.Create(playermodelPart, new TweenInfo(ctx.tickrate, Enum.EasingStyle.Linear), { CFrame: entity.origin });
    currentTween.Completed.Once(() => {
      currentTween?.Destroy();
      currentTween = undefined;
    });
    currentTween.Play();
  });

  entity.OnDelete(() => {
    unbindConnection1();
    unbindConnection2();
    playermodel.Destroy();

    entityPlayermodels.delete(entity.id);
  });

  entityPlayermodels.set(entity.id, playermodel);
  // refreshPlayermodelAppearance(playermodel, entity.GetUserFromController()?.UserId);

  task.spawn(() => createHealthBarForEntity(entity));

  return playermodel;
}

// # Bindings & misc
//
