import React from "@rbxts/react";
import { defaultEnvironments } from "defaultinsts";
import CapturePointEntity from "entities/CapturePointEntity";
import { PlayerTeam } from "entities/PlayerEntity";
import { colorTable } from "UI/values";

const ICON_ID = "rbxassetid://103434352040367";

export function CapturePointMeter(props: { entityId: string }) {
  const [captureProgress, setCaptureProgress] = React.createBinding(0);

  let entity: CapturePointEntity | undefined;
  let disconnectCallback: Callback | undefined;

  disconnectCallback = defaultEnvironments.lifecycle.BindTickrate((ctx) => {
    if (entity && !defaultEnvironments.entity.isEntityOnMemoryOrImSchizo(entity)) {
      entity = undefined;
      disconnectCallback?.();
      disconnectCallback = undefined;
      return;
    }

    if (!entity) {
      const searchEntity = defaultEnvironments.entity.entities.get(props.entityId);
      if (!searchEntity || !searchEntity.IsA("CapturePointEntity")) return;

      entity = searchEntity;
    }
    if (!entity) return;

    setCaptureProgress(math.lerp(0.5, 1, -entity.capture_progress));
  });

  return (
    <imagelabel
      Image={ICON_ID}
      ImageColor3={Color3.fromHex(colorTable.defendersColor)}
      ScaleType={"Fit"}
      BackgroundTransparency={1}
      Size={UDim2.fromOffset(60, 60)}
    >
      <frame // Mask frame
        AnchorPoint={new Vector2(1, 0)}
        BackgroundTransparency={1}
        ClipsDescendants={true}
        Position={UDim2.fromScale(1, 0)}
        Size={captureProgress.map(val => UDim2.fromScale(val, 1))}
      >
        <imagelabel
          Image={ICON_ID}
          ImageColor3={Color3.fromHex(colorTable.raidersColor)}
          ScaleType={"Fit"}
          AnchorPoint={new Vector2(1, 0)}
          BackgroundTransparency={1}
          Position={UDim2.fromScale(1, 0)}
          Size={UDim2.fromOffset(60, 60)}
        />
      </frame>
    </imagelabel>
  );
}