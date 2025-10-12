import * as Services from "@rbxts/services";
import PlayerEntity from "entities/PlayerEntity";
import { Playermodel } from "./rig";
import { defaultEnvironments } from "defaultinsts";
import { TICKRATE } from "lifecycle";
import { createHealthBarForEntity } from "./healthbar";
import { RaposoConsole } from "logging";

// # Constants & variables
const entityPlayermodels = new Map<EntityId, Playermodel>();
const tweeningPlayermodels = new Map<EntityId, Tween>();

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

export function refreshPlayermodelAppearance(playermodel: Playermodel, controller?: number) {
  if (!controller) {
    playermodel.SetDescription();
    return;
  }

  fetchHumanoidDescription(controller).andThen(description => playermodel.SetDescription(description));
}

export function getPlayermodelFromEntity(entityId: EntityId) {
  return entityPlayermodels.get(entityId);
}

export async function createPlayermodelForEntity(entity: PlayerEntity) {
  const playermodel = new Playermodel(entity.environment.world);
  playermodel.SetMaterial();
  playermodel.SetTransparency();
  playermodel.SetCollisionGroup("Players");

  playermodel.rig.Humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
  playermodel.rig.Humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff;
  playermodel.rig.Humanoid.SetStateEnabled("Dead", false);
  playermodel.rig.HumanoidRootPart.Anchored = true;

  for (const inst of playermodel.rig.GetChildren()) {
    if (!inst.IsA("BasePart")) continue;
    entity.AssociateInstance(inst);
  }

  entity.spawned.Connect(() => {
    playermodel.SetMaterial();
    playermodel.SetTransparency();
    playermodel.SetCollisionGroup("Players");
    playermodel.SetRigJointsEnabled(true);
    playermodel.EnableRigCollisionParts();

    for (const inst of playermodel.rig.GetChildren()) {
      if (!inst.IsA("BasePart")) continue;

      inst.AssemblyLinearVelocity = new Vector3();
      inst.AssemblyAngularVelocity = new Vector3();
    }

    refreshPlayermodelAppearance(playermodel, entity.GetUserFromController()?.UserId);
  });

  entity.died.Connect(() => {
    if (entity.GetUserFromController() !== Services.Players.LocalPlayer) {
      playermodel.SetCollisionGroup("DeadPlayers");
      playermodel.SetMaterial(Enum.Material.ForceField);
      playermodel.SetTransparency(1);
    }

    if (entity.GetUserFromController() === Services.Players.LocalPlayer) {
      playermodel.SetMaterial();
      playermodel.SetTransparency();
      playermodel.SetRigJointsEnabled(false);
      playermodel.SetCollisionGroup("DeadPlayermodels");
      playermodel.EnableRigCollisionParts(true); // This needs to be below "SetCollisionGroup" LOL

      for (const inst of playermodel.rig.GetChildren()) {
        if (!inst.IsA("BasePart")) continue;

        inst.AssemblyLinearVelocity = new Vector3(0, 50, 0);
        inst.AssemblyAngularVelocity = new Vector3(
          math.random(-45, 45),
          math.random(-45, 45),
          math.random(-45, 45),
        );
      }
    }
  });

  entity.teleportPlayermodelSignal.Connect(origin => {
    const currentTween = tweeningPlayermodels.get(entity.id);
    if (currentTween) {
      const currentPivot = playermodel.GetPivot();

      currentTween.Cancel();
      currentTween.Destroy();
      tweeningPlayermodels.delete(entity.id);

      playermodel.PivotTo(currentPivot);
    }

    const newTween = Services.TweenService.Create(
      playermodel.rig.PrimaryPart!,
      new TweenInfo(TICKRATE, Enum.EasingStyle.Linear),
      { CFrame: origin }
    );

    tweeningPlayermodels.set(entity.id, newTween);
    newTween.Completed.Once(() => tweeningPlayermodels.delete(entity.id));
    newTween.Play();
  });

  const unbindConnection = defaultEnvironments.lifecycle.BindLateUpdate(() => {
    playermodel.rig.Humanoid.Health = entity.health;
    playermodel.rig.Humanoid.MaxHealth = entity.maxHealth;

    const primaryPart = playermodel.rig.PrimaryPart;
    if (primaryPart) {
      primaryPart.Anchored = entity.GetUserFromController() !== Services.Players.LocalPlayer;
      primaryPart.AssemblyLinearVelocity = entity.GetUserFromController() !== Services.Players.LocalPlayer
        ? entity.velocity
        : primaryPart.AssemblyLinearVelocity;
    }

    playermodel.animator.is_grounded = entity.grounded;
    playermodel.animator.Update();

    if (entity.GetUserFromController() !== Services.Players.LocalPlayer)
      playermodel.rig.Parent = entity.health <= 0 ? Services.ReplicatedStorage : entity.environment.world.objects;
  });

  entity.OnDelete(() => {
    unbindConnection();
    playermodel.Destroy();

    entityPlayermodels.delete(entity.id);

    tweeningPlayermodels.get(entity.id)?.Cancel();
    tweeningPlayermodels.get(entity.id)?.Destroy();
    tweeningPlayermodels.delete(entity.id);
  });

  entityPlayermodels.set(entity.id, playermodel);

  task.spawn(() => createHealthBarForEntity(entity));

  return playermodel;
}

// # Bindings & misc
//
