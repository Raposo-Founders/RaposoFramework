import * as Services from "@rbxts/services";
import { animFolder, cacheFolder } from "shared/folders";
import WorldInstance from "shared/worldrender";

// # Types
declare global {
  interface CharacterModel extends BaseCharacterModelInfo {
    Humanoid: Humanoid & {
      Animator: Animator;
    };
  }
}

interface BaseCharacterModelInfo extends Model {
  Head: Part;
  Torso: Part;
  Highlight: Highlight;
  ["Right Arm"]: Part;
  ["Left Arm"]: Part;
  HumanoidRootPart: Part;
  ["Right Leg"]: Part;
  ["Left Leg"]: Part;
}

// # Constants
const defaultAnimationList = new Map<string, { animid: string, weight: number }>();
const defaultCollisionValues = new Map<string, boolean>([
  ["Right Arm", false],
  ["Left Arm", false],
  ["Head", true],
  ["Torso", true],
  ["Left Leg", false],
  ["Right Leg", false],
]);

const defaultDescription = new Instance("HumanoidDescription");

// # Variables

// # Functions

// # Class
export class Playermodel {
  readonly rig: CharacterModel;
  animator: CharacterAnimationManager;

  constructor(readonly world: WorldInstance) {
    assert(Services.RunService.IsClient(), "Class can only be used on the client.");

    this.rig = Services.Players.CreateHumanoidModelFromDescription(defaultDescription, "R6") as CharacterModel;

    // Make sure that everything fucking exists
    this.rig.WaitForChild("HumanoidRootPart");
    this.rig.WaitForChild("Humanoid");

    this.rig.Humanoid.ApplyDescriptionFinished.Connect(() => {
      for (const inst of this.rig.GetDescendants()) {
        if (!inst.IsA("BasePart")) continue;

        inst.SetAttribute("OG_MATERIAL", inst.Material.Name);
      }
    });

    this.rig.Name = "Playermodel";
    this.rig.Parent = world.objects;
    this.rig.PrimaryPart = this.rig.HumanoidRootPart;
    this.rig.Humanoid.SetStateEnabled("Dead", false);
    this.rig.Humanoid.BreakJointsOnDeath = false;
    this.rig.PivotTo(new CFrame(0, 100, 0));
    this.SetCollisionGroup("Players");

    this.animator = new CharacterAnimationManager(this.rig);

    const highlight = new Instance("Highlight");
    highlight.Parent = this.rig;
    highlight.FillTransparency = 1;
    highlight.DepthMode = Enum.HighlightDepthMode.Occluded;

    // const animatorModule = vendorFolder.WaitForChild("PlayerHumanoidAnimator").Clone() as ModuleScript;
    // animatorModule.Parent = this._rigmodel;
    // task.spawn(() => require(animatorModule));

    for (const inst of this.rig.GetChildren())
      if (inst.IsA("BasePart"))
        inst.CanCollide = defaultCollisionValues.get(inst.Name) ?? inst.CanCollide;
  }

  GetPivot() {
    return this.rig.PrimaryPart!.GetPivot();
  }

  SetRigJointsEnabled(value = true) {
    for (const inst of this.rig.GetDescendants()) {
      if (!inst.IsA("Motor6D")) continue;

      inst.Enabled = value;
    }
  }

  EnableRigCollisionParts(value?: boolean) {
    for (const inst of this.rig.GetChildren()) {
      if (!inst.IsA("BasePart")) continue;
      if (inst.Name === "HumanoidRootPart") continue;

      const existingCollisionPart = inst.FindFirstChild("__BODYPART_RIG_COLLISION");
      if (existingCollisionPart) {
        existingCollisionPart.Destroy();
      }

      if (!value) continue;

      const collisionPart = new Instance("Part");
      collisionPart.Parent = inst;
      collisionPart.Name = "__BODYPART_RIG_COLLISION";
      collisionPart.Size = inst.Size;
      collisionPart.CFrame = inst.CFrame;
      collisionPart.Transparency = 1;
      collisionPart.CollisionGroup = inst.CollisionGroup; // And this is why it needs to be called after "SetCollisionGroup" :P

      const weld = new Instance("WeldConstraint");
      weld.Parent = collisionPart;
      weld.Part0 = inst;
      weld.Part1 = collisionPart;

      const noCollisionConstraint = new Instance("NoCollisionConstraint");
      noCollisionConstraint.Parent = collisionPart;
      noCollisionConstraint.Part0 = inst;
      noCollisionConstraint.Part1 = collisionPart;
    }
  }

  PivotTo(origin: CFrame) {
    this.rig.PivotTo(origin);
  }

  SetMaterial(material: Enum.Material = Enum.Material.Plastic) {
    for (const inst of this.rig.GetDescendants()) {
      if (!inst.IsA("BasePart")) continue;
      if (inst.Name === "HumanoidRootPart") continue;

      inst.Material = material;
    }
  }

  SetCollisionGroup(group = "Default") {
    for (const inst of this.rig.GetDescendants()) {
      if (!inst.IsA("BasePart")) continue;

      inst.CollisionGroup = group;
    }
  }

  SetTransparency(amount = 0) {
    for (const inst of this.rig.GetDescendants()) {
      if (!inst.IsA("BasePart") && !inst.IsA("Decal")) continue;
      if (inst.Name === "HumanoidRootPart") continue;

      inst.Transparency = amount;
    }
  }

  SetOulineColor(color: Color3) {
    this.rig.Highlight.OutlineColor = color;
  }

  SetOutlineTransparency(value: number) {
    this.rig.Highlight.OutlineTransparency = value;
  }

  async SetDescription(desc = defaultDescription) {
    this.rig.Humanoid.ApplyDescription(desc);
  }

  Destroy() {
    this.rig?.Destroy();
    rawset(this, "rigmodel", undefined);
  }
}

class CharacterAnimationManager {
  private _instances_list = new Array<Instance>();
  private _connections_list = new Array<RBXScriptConnection>();
  private _loaded_anims = new Map<string, AnimationTrack>();

  private readonly _animatorinst: Animator;
  is_grounded = true;

  constructor(readonly character: CharacterModel) {
    this._animatorinst = character.Humanoid.WaitForChild("Animator") as Animator;

    // Default animation list
    for (const [name, content] of defaultAnimationList) {
      const inst = new Instance("Animation");
      inst.Name = name;
      inst.AnimationId = content.animid;
      inst.Parent = cacheFolder;

      const track = this._animatorinst.LoadAnimation(inst);
      track.AdjustWeight(content.weight);

      this._instances_list.push(inst, track);
      this._loaded_anims.set(name, track);
    }

    // Load game animations
    for (const inst of animFolder.GetDescendants()) {
      if (!inst.IsA("Animation")) continue;

      const track = this._animatorinst.LoadAnimation(inst);
      this._instances_list.push(track);
      this._loaded_anims.set(inst.Name, track);
    }

    // Connections
    // character.Humanoid.Died.Once(() => this.Destroy());
    character.Destroying.Once(() => this.Destroy());
  }

  PlayAnimation(name: string, priority: Enum.AnimationPriority["Name"] = "Action", force = false, speed = 1) {
    const targetanim = this._loaded_anims.get(name);
    if (!targetanim) {
      warn(`Unknown animation: ${name}`);
      return;
    }

    targetanim.Priority = Enum.AnimationPriority[priority];
    targetanim.AdjustSpeed(speed);

    if (force) {
      targetanim.Stop(0);
      targetanim.TimePosition = 0;
    }

    if (!targetanim.IsPlaying) {
      targetanim.Play();
    }
  }

  StopAnimation(name: string) {
    const targetanim = this._loaded_anims.get(name);
    if (!targetanim) {
      warn(`Unknown animation: ${name}`);
      return;
    }

    targetanim.Stop(0.1);
  }

  StopAllAnimations() {
    for (const [_, animation] of this._loaded_anims) {
      animation.Stop(0.1);
    }
  }

  Destroy() {
    this.StopAllAnimations();
    this._loaded_anims.clear();

    for (const inst of this._instances_list)
      inst.Destroy();
    this._instances_list.clear();

    for (const conn of this._connections_list)
      conn.Disconnect();
    this._connections_list.clear();

    table.clear(this);
  }

  Update() {
    const primaryPart = this.character.PrimaryPart;
    if (!primaryPart) return;

    const walkspeed = this.character.Humanoid.WalkSpeed;
    const velocity = primaryPart.AssemblyLinearVelocity;

    if (velocity.Magnitude > 0.05 && this.is_grounded)
      this.PlayAnimation("run", "Core", false, walkspeed / 14.5); // the (old) default run speed was this one
    else
      this.StopAnimation("run");

    // if (humanoid.Jump && humanoid.FloorMaterial.Name !== "Air")
    //   this.PlayAnimation("jump", "Core");
    // else
    //   this.StopAnimation("jump");

    // if (!humanoid.Jump && humanoid.FloorMaterial.Name === "Air")
    //   this.PlayAnimation("fall", "Core");
    // else
    //   this.StopAnimation("fall");

    if (!this.is_grounded)
      this.PlayAnimation("fall", "Core");
    else
      this.StopAnimation("fall");
  }
}

// # Bindings & misc
defaultDescription.HeadColor = new Color3(127, 127, 127);
defaultDescription.TorsoColor = new Color3(127, 127, 127);
defaultDescription.RightArmColor = new Color3(127, 127, 127);
defaultDescription.LeftArmColor = new Color3(127, 127, 127);
defaultDescription.LeftLegColor = new Color3(127, 127, 127);
defaultDescription.RightLegColor = new Color3(127, 127, 127);

defaultAnimationList.set("idle", { animid: "http://www.roblox.com/asset/?id=180435571", weight: 9 });
defaultAnimationList.set("walk", { animid: "http://www.roblox.com/asset/?id=180426354", weight: 10 });
defaultAnimationList.set("run", { animid: "http://www.roblox.com/asset/?id=180426354", weight: 10 });
defaultAnimationList.set("jump", { animid: "http://www.roblox.com/asset/?id=125750702", weight: 10 });
defaultAnimationList.set("fall", { animid: "http://www.roblox.com/asset/?id=180436148", weight: 10 });
defaultAnimationList.set("climb", { animid: "http://www.roblox.com/asset/?id=180436334", weight: 10 });
defaultAnimationList.set("sit", { animid: "http://www.roblox.com/asset/?id=178130996", weight: 10 });
defaultAnimationList.set("toolnone", { animid: "http://www.roblox.com/asset/?id=182393478", weight: 10 });
defaultAnimationList.set("toolslash", { animid: "http://www.roblox.com/asset/?id=129967390", weight: 10 });
defaultAnimationList.set("toollunge", { animid: "http://www.roblox.com/asset/?id=129967478", weight: 10 });
