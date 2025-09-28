import React from "@rbxts/react";
import { Players } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import { cacheFolder } from "folders";
import { Playermodel } from "playermodel/rig";
import { values } from "UI/default/values";
import { getLocalPlayerEntity } from "util/localent";
import WorldInstance from "worldrender";

const defaultDescription = new Instance("HumanoidDescription");

export function HudPlayerPanel() {
  const viewportReference = React.createRef<ViewportFrame>();
  const cameraReference = React.createRef<Camera>();
  const worldReference = React.createRef<WorldModel>();

  const worldInstance = new WorldInstance("void");

  let description = new Instance("HumanoidDescription");
  
  const updateDescription = async () => {
    description?.Destroy();
    description = new Instance("HumanoidDescription");

    const [success, actualDescription] = pcall(() => Players.GetHumanoidDescriptionFromUserId(Players.LocalPlayer.UserId));
    if (success && actualDescription) {
      description?.Destroy();
      description = actualDescription;
    }

    description.Parent = cacheFolder;

    return description;
  };

  React.useEffect(() => {
    if (!worldReference.current) return;
    if (!cameraReference.current) return;
    if (!viewportReference.current) return;

    let currentEntity = "";
    let currentModel: Playermodel | undefined;

    worldInstance.rootInstance.Parent = worldReference.current;
    viewportReference.current.CurrentCamera = cameraReference.current;

    defaultEnvironments.lifecycle.BindTickrate(() => {
      let playerEntity = defaultEnvironments.entity.entities.get(currentEntity);
      if (!playerEntity || !playerEntity.IsA("PlayerEntity")) {
        playerEntity = getLocalPlayerEntity(defaultEnvironments.entity);
        if (!playerEntity || !playerEntity.IsA("PlayerEntity")) return;
      }

      // Means that this is the first time that it gets set
      if (currentEntity !== playerEntity.id) {
        currentEntity = playerEntity.id;
        playerEntity.OnDelete(() => currentEntity = "");

        playerEntity.died.Connect(() => {
          currentModel?.SetDescription(defaultDescription);
        });
        playerEntity.spawned.Connect(() => {
          updateDescription().andThen(val => currentModel?.SetDescription(val));
        });

        currentModel?.Destroy();
        currentModel = undefined;

        currentModel = new Playermodel(worldInstance);
        currentModel.rig.Parent = worldReference.current;
        currentModel.PivotTo(new CFrame());
        currentModel.animator.is_grounded = true;
        currentModel.SetDescription(defaultDescription);

        task.spawn(() => {
          task.wait(5);
          updateDescription().andThen(val => currentModel?.SetDescription(val));
        });
      }
    });
  });

  return (
    <frame
      AnchorPoint={new Vector2(0, 1)}
      BackgroundColor3={Color3.fromHex("#FFFFFF")}
      BackgroundTransparency={1}
      BorderColor3={Color3.fromHex("#000000")}
      BorderSizePixel={0}
      Position={UDim2.fromScale(0.125, 0.9)}
      Size={UDim2.fromScale(0.25, 0.25)}
    >
      <uiaspectratioconstraint AspectRatio={2} />
      <imagelabel
        Image={"rbxassetid://101883834047596"}
        ImageColor3={values.hud_team_color[0]}
        ScaleType={"Fit"}
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 1)}
      >
        <uiaspectratioconstraint
          AspectRatio={2}
        />
      </imagelabel>

      <viewportframe
        Ambient={Color3.fromHex("#999999")}
        LightColor={Color3.fromHex("#FFFFFF")}
        LightDirection={new Vector3(0, -1, 1)}
        AnchorPoint={new Vector2(0.5, 1)}
        BackgroundTransparency={1}
        Position={UDim2.fromScale(0.3, 0.7)}
        Size={UDim2.fromScale(1, 1)}
        ZIndex={2}
        ref={viewportReference}
      >
        <uiaspectratioconstraint />
        <worldmodel
          ref={worldReference}
        />
        <camera
          CFrame={new CFrame(7.5, 2, -7.5).mul(CFrame.Angles(0, math.rad(135), 0))}
          FieldOfView={40}
          ref={cameraReference}
        />
      </viewportframe>

      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={values.hud_player_health[0].map(val => `${val}%`)}
        TextColor3={Color3.fromHex("#ABABFF")}
        TextScaled={true}
        TextSize={40}
        TextWrapped={true}
        AnchorPoint={new Vector2(0.5, 0.5)}
        BackgroundColor3={Color3.fromHex("#FFFFFF")}
        BackgroundTransparency={1}
        BorderColor3={Color3.fromHex("#000000")}
        BorderSizePixel={0}
        Position={UDim2.fromScale(0.7, 0.5)}
        Size={UDim2.fromScale(1, 0.3)}
      />
    </frame>
  );
}