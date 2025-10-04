import React from "@rbxts/react";
import { uiValues } from "UI/values";

export function FairzoneTopDisplay(props: React.PropsWithChildren) {
  return (
    <frame
      AnchorPoint={new Vector2(0.5, 0)}
      BackgroundTransparency={1}
      Position={UDim2.fromScale(0.5, 0)}
      Size={new UDim2(1, 0, 0, 50)}
      Visible={uiValues.hud_gamemode[0].map(val => val === "Fairzone")}
    >
      <uilistlayout
        Padding={new UDim(0, 5)}
        FillDirection={"Horizontal"}
        HorizontalAlignment={"Center"}
        SortOrder={"LayoutOrder"}
      />
      {props.children}
    </frame>
  );
}