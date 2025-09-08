import { t } from "@rbxts/t";
import BaseEntity from "shared/entities/BaseEntity";

/* -------------------------------------------------------------------------- */
/*                                  Functions                                 */
/* -------------------------------------------------------------------------- */
function IsEntityIncluded(entity: BaseEntity, searchList: (keyof GameEntities)[]) {
  for (const key of rawget(entity, "setIsA") as Set<keyof GameEntities>) {
    if (!searchList.includes(key)) continue;

    return true;
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/*                                    Class                                   */
/* -------------------------------------------------------------------------- */
class CTracelineParameter {
  constructor(
    private FilterContents: ("World" | "Entities")[],
    private FilterEntities: (keyof GameEntities)[],
    private EntitiesFilterType: "Whitelist" | "Blacklist",
    private RespectCanCollide: boolean,
  ) { }

  GenerateTraceParams<B extends boolean, T extends B extends true ? OverlapParams : RaycastParams>(entityEnvironment: T_EntityEnvironment, bIsOverlap: B): T {
    const rgSearchContent: Instance[] = [];

    if (this.FilterContents.includes("World")) {
      rgSearchContent.push(entityEnvironment.world.parts);
    }
    if (this.FilterContents.includes("Entities")) {
      for (const entity of entityEnvironment.getEntitiesThatIsA("BaseEntity")) {
        if (
          (this.EntitiesFilterType === "Blacklist" && IsEntityIncluded(entity, this.FilterEntities)) ||
          (this.EntitiesFilterType === "Whitelist" && !IsEntityIncluded(entity, this.FilterEntities))
        )
          continue;

        for (const inst of entity.associatedInstances) {
          if (!inst.IsDescendantOf(entityEnvironment.world.objects))
            continue;
          rgSearchContent.push(inst);
        }
      }
      for (const inst of entityEnvironment.world.objects.GetChildren()) {
        rgSearchContent.push(inst);
      }
    }

    const raycastparams = bIsOverlap ? new OverlapParams() : new RaycastParams();
    raycastparams.FilterType = Enum.RaycastFilterType.Include;
    raycastparams.RespectCanCollide = this.RespectCanCollide;
    if (t.RaycastParams(raycastparams)) raycastparams.IgnoreWater = true;
    raycastparams.FilterDescendantsInstances = rgSearchContent;

    return raycastparams as T;
  }
}

export = CTracelineParameter;
