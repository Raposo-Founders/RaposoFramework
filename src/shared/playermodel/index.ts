import * as Services from "@rbxts/services";
import PlayerEntity from "shared/entities/PlayerEntity";
import { msg } from "shared/logger";
import { Playermodel } from "./rig";
import { defaultEnvironments } from "shared/defaultinsts";


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
      msg("EXCEPTION", `Failed to fetch HumanoidDescription ${userid} after ${humanoidFetchDescriptionMaxAttempts} attempts.`);
      break;
    }

    const [success, obj] = pcall(() => Services.Players.GetHumanoidDescriptionFromUserId(math.max(userid, 1)));
    if (!success) {
      msg("WARN", `Failed to fetch HumanoidDescription, retrying in 5 seconds...\n${obj}`);
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
  print("Creating character rig for entity:", entity.classname, entity.id);

  const targetPlayer = Services.Players.GetPlayerByUserId(entity.userid);

  const playermodel = new Playermodel(entity.environment.world);
  playermodel.SetMaterial();
  playermodel.SetTransparency();
  playermodel.SetCollisionGroup("Players");

  playermodel.rig.Humanoid.DisplayName = targetPlayer !== Services.Players.LocalPlayer ? `${targetPlayer?.Name || "BOT"}` : " ";
  playermodel.rig.Humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.Viewer;
  playermodel.rig.Humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.DisplayWhenDamaged;
  playermodel.rig.Humanoid.SetStateEnabled("Dead", false);
  playermodel.rig.HumanoidRootPart.Anchored = targetPlayer !== Services.Players.LocalPlayer && targetPlayer !== undefined;

  for (const inst of playermodel.rig.GetChildren()) {
    if (!inst.IsA("BasePart")) continue;
    entity.AssociateInstance(inst);
  }

  entity.spawned.Connect(() => {
    print("Entity", entity.id, "spawned!");

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

    refreshPlayermodelAppearance(playermodel, entity.userid);
  });

  entity.died.Connect(() => {
    print("Entity", entity.id, "died.");

    playermodel.SetCollisionGroup("DeadPlayers");
    playermodel.SetMaterial(Enum.Material.ForceField);
    playermodel.SetTransparency(0.5);

    if (entity.userid !== Services.Players.LocalPlayer.UserId) {
      playermodel.SetMaterial();
      playermodel.SetTransparency();
      playermodel.SetRigJointsEnabled(false);
      playermodel.SetCollisionGroup("DeadPlayermodels");
      playermodel.EnableRigCollisionParts(true); // This needs to be below "SetCollisionGroup" LOL

      for (const inst of playermodel.rig.GetChildren()) {
        if (!inst.IsA("BasePart")) continue;

        inst.AssemblyLinearVelocity = new Vector3(
          // math.random(-20, 20),
          0,
          50,
          0
          // math.random(-20, 20),
        );
        inst.AssemblyAngularVelocity = new Vector3(
          math.random(-45, 45),
          math.random(-45, 45),
          math.random(-45, 45),
        );
      }
    }
  });

  const unbindConnection = defaultEnvironments.lifecycle.BindLateUpdate(() => {
    playermodel.rig.Humanoid.Health = entity.health;
    playermodel.rig.Humanoid.MaxHealth = entity.maxHealth;

    if (playermodel.rig.PrimaryPart)
      playermodel.rig.PrimaryPart.Anchored = entity.userid !== Services.Players.LocalPlayer.UserId;

    playermodel.animator.is_grounded = entity.grounded;
    playermodel.animator.Update();
    playermodel.rig.Parent = entity.attributesList.has("INVISIBLE") ? Services.ReplicatedStorage : entity.environment.world.objects;
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

  return playermodel;
}

// # Bindings & misc
//
