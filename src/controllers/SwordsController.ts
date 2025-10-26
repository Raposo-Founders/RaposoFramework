import ColorUtils from "@rbxts/colour-utils";
import { Players, RunService, TweenService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import BaseEntity from "entities/BaseEntity";
import HealthEntity from "entities/HealthEntity";
import { getPlayerEntityFromController, PlayerTeam } from "entities/PlayerEntity";
import { SwordPlayerEntity, SwordState } from "entities/SwordPlayerEntity";
import { cacheFolder, modelsFolder } from "folders";
import { gameValues, getInstanceDefinedValue } from "gamevalues";
import { NetworkManager } from "network";
import { createPlayermodelForEntity } from "providers/PlayermodelProvider";
import SessionInstance from "providers/SessionProvider";
import WorldProvider, { ObjectsFolder } from "providers/WorldProvider";
import { CWorldSoundInstance } from "systems/sound";
import { colorTable } from "UI/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString, writeBufferU8 } from "util/bufferwriter";
import { DoesInstanceExist } from "util/utilfuncs";

// # Constants & variables
const NETWORK_ID = "swordcon_";
const SWORD_MODEL = modelsFolder.WaitForChild("Sword") as BasePart;

const forcetieEnabled = getInstanceDefinedValue("ForcetieEnabled", false);
const teamHealingEnabled = getInstanceDefinedValue("TeamHealingEnabled", false);

enum NetworkSwordHitIndex {
  LocalToOther,
  OtherToLocal,
}

// # Functions
function CheckPlayers<T extends BaseEntity>(entity1: SwordPlayerEntity, entity2: T) {
  if (entity1.id === entity2.id) return;
  if (!entity2.IsA("HealthEntity")) return;

  if (entity2.IsA("PlayerEntity"))
    if (entity1.team ===PlayerTeam.Spectators || entity2.team ===PlayerTeam.Spectators) return;

  if (entity1.health <= 0 || entity2.health <= 0) {
    if (!forcetieEnabled) return;

    const lastAttacker = entity2.attackersList[0];
    if (!lastAttacker || time() - lastAttacker.time > 0.25) return;
  }

  if (!teamHealingEnabled && entity2.IsA("PlayerEntity"))
    if (entity1.team === entity2.team) return;

  return true;
}

function ClientHandleHitboxTouched(attacker: SwordPlayerEntity, target: HealthEntity, part: BasePart, network: NetworkManager) {
  const spawnHitHighlight = (color: string) => {
    if (!part.Parent?.FindFirstChildWhichIsA("Humanoid")) return;

    const selectionBox = new Instance("SelectionBox");
    selectionBox.Parent = ObjectsFolder;
    selectionBox.SurfaceColor3 = Color3.fromHex(color);
    selectionBox.SurfaceTransparency = 0.5;
    selectionBox.Color3 = ColorUtils.Darken(Color3.fromHex(color), 0.75);
    selectionBox.Adornee = part;

    const tween = TweenService.Create(selectionBox, new TweenInfo(0.125, Enum.EasingStyle.Linear), { LineThickness: 0, SurfaceTransparency: 1 });
    tween.Completed.Once(() => {
      selectionBox.Destroy();
      tween.Destroy();
    });
    tween.Play();
  };

  let targetColor = colorTable.spectatorsColor;
  if (target.IsA("PlayerEntity") && target.team === PlayerTeam.Defenders) targetColor = colorTable.defendersColor;
  if (target.IsA("PlayerEntity") && target.team === PlayerTeam.Raiders) targetColor = colorTable.raidersColor;

  // If the attacker is another player
  if (attacker.GetUserFromController() !== Players.LocalPlayer) {
    if (!target.IsA("PlayerEntity") || target.GetUserFromController() !== Players.LocalPlayer) return;

    spawnHitHighlight(targetColor);

    startBufferCreation();
    writeBufferU8(NetworkSwordHitIndex.OtherToLocal);
    writeBufferString(attacker.id);
    network.sendPacket(`${NETWORK_ID}hit`);

    return;
  }

  // If we're the ones attacking
  if (attacker.GetUserFromController() === Players.LocalPlayer) {
    startBufferCreation();
    writeBufferU8(NetworkSwordHitIndex.LocalToOther);
    writeBufferString(target.id);
    network.sendPacket(`${NETWORK_ID}hit`);
  }

  if (target.IsA("PlayerEntity"))
    spawnHitHighlight(targetColor);
}

function CreateSwordForEntity() {

}

// # Bindings & misc
SessionInstance.sessionCreated.Connect(server => {
  // Listening for damage
  server.network.listenPacket(`${NETWORK_ID}hit`, (packet) => {
    if (!packet.sender) return;
  
    const reader = BufferReader(packet.content);
    const hitIndex = reader.u8();
    const entityId = reader.string();
  
    const entity = getPlayerEntityFromController(server.entity, tostring(packet.sender.GetAttribute(gameValues.usersessionid)));
    if (!entity || !entity.IsA("SwordPlayerEntity")) return;
  
    const targetEntity = server.entity.entities.get(entityId);
    if (!targetEntity?.IsA("HealthEntity")) return;
  
    if (!CheckPlayers(entity, targetEntity)) return;
  
    let totalDealingDamage = 0;
  
    if (hitIndex === NetworkSwordHitIndex.LocalToOther) {
      totalDealingDamage = entity.currentState;
  
      if (teamHealingEnabled && targetEntity.IsA("PlayerEntity"))
        if (targetEntity.team === entity.team)
          totalDealingDamage = -totalDealingDamage;
  
      targetEntity.takeDamage(totalDealingDamage, entity);
    }
  
    if (hitIndex === NetworkSwordHitIndex.OtherToLocal) {
      if (!targetEntity.IsA("SwordPlayerEntity")) return;
  
      totalDealingDamage = entity.currentState;
  
      if (teamHealingEnabled && targetEntity.team === entity.team)
        totalDealingDamage = -totalDealingDamage;
  
      entity.takeDamage(totalDealingDamage, targetEntity);
    }
  });
});

if (RunService.IsClient())
  defaultEnvironments.entity.entityCreated.Connect(ent => {
    if (!ent.IsA("SwordPlayerEntity")) return;

    const playermodel = createPlayermodelForEntity(ent);

    const getGripPosition = () => {
      let gripPosition = new CFrame();

      if (ent.currentState === SwordState.Lunge)
        gripPosition = new CFrame(-1.5, 0, -1.5).mul(CFrame.Angles(0, -math.rad(90), 0));
      
      return gripPosition;
    };

    const swordModel = SWORD_MODEL.Clone();
    swordModel.Parent = workspace;
    swordModel.Name = "Part";

    const swordMotor = new Instance("Motor6D");
    swordMotor.Parent = swordModel;
    swordMotor.Part0 = playermodel.rig["Right Arm"];
    swordMotor.Part1 = swordModel;
    swordMotor.C0 = new CFrame(0, -1, -1.5).mul(CFrame.Angles(0, math.rad(180), math.rad(-90)));

    const touchedConnection = swordModel.Touched.Connect(other => {
      if (defaultEnvironments.entity.isPlayback) return;
      if (!ent.IsWeaponEquipped()) return;
      if (!DoesInstanceExist(playermodel.rig)) return;
      if (other.IsDescendantOf(WorldProvider.MapFolder)) return;
      if (other.IsDescendantOf(playermodel.rig)) return; // Hitting ourselves, ignore...

      const relatedEntities = defaultEnvironments.entity.getEntitiesFromInstance(other);
      if (relatedEntities.size() <= 0) return;

      for (const entity of relatedEntities) {
        if (!entity.IsA("HealthEntity") || entity.id === ent.id) continue;
        ClientHandleHitboxTouched(ent, entity, other, defaultEnvironments.network);
      }
    });

    ent.stateChanged.Connect(state => {
      if (state === SwordState.Idle) return;

      let snd: CWorldSoundInstance;

      if (state === SwordState.Lunge)
        snd = new CWorldSoundInstance("Lunge", "rbxasset://sounds//swordlunge.wav");
      else
        snd = new CWorldSoundInstance("Slash", "rbxasset://sounds//swordslash.wav");

      snd.SetParent(swordModel);
      snd.Play().andThen(() => snd.Dispose());
    });

    const unbindLifecycleUpdate1 = defaultEnvironments.lifecycle.BindTickrate(() => {
      const isEquipped = ent.health > 0 && ent.IsWeaponEquipped();

      swordMotor.C1 = getGripPosition();
      swordModel.Transparency = isEquipped ? 0 : 1;
    });

    ent.OnDelete(() => {
      swordModel.Destroy();
      swordMotor.Destroy();
      touchedConnection.Disconnect();

      unbindLifecycleUpdate1();
    });

    print("Finished setting up", ent.classname, ent.id);
  });