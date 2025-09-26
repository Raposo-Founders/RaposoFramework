import React from "@rbxts/react";
import { MarketplaceService } from "@rbxts/services";
import { uiPreferences } from "../default/values";
import { Tab, TabButton, TabsButtonList, TabContentFrame } from "./tabs";
import { PlayMenu } from "./playmenu";
import Signal from "shared/util/signal";
import { ConsoleFunctionCallback } from "shared/cmd/cvar";

// # Constants & variables
export const MAINMENU_VISIBILITY_CHANGED = new Signal<[boolean]>();

const MARKETPLACE_INFO = MarketplaceService.GetProductInfo(game.PlaceId);
const PLACE_NAME = MARKETPLACE_INFO.Name;

let isVisible = false;

// # Functions
function Master(props: React.PropsWithChildren) {
  const reference = React.createRef<Frame>();
  const [masterVisibleBinding, setMasterVisible] = React.createBinding(true);

  MAINMENU_VISIBILITY_CHANGED.Connect(visible => setMasterVisible(visible));

  return <frame
    AnchorPoint={new Vector2(0.5, 0.5)}
    Position={new UDim2(0.5, 0, 0.5, 0)}
    Size={new UDim2(0.75, 0, 0.75, 0)}
    BackgroundTransparency={1}
    Visible={masterVisibleBinding}
    ref={reference}
  >
    <uiaspectratioconstraint AspectRatio={1.778} /* 16:9 */ />
    <uipadding
      PaddingTop={new UDim(0, uiPreferences.menuElementsPadding)}
      PaddingBottom={new UDim(0, uiPreferences.menuElementsPadding)}
      PaddingLeft={new UDim(0, uiPreferences.menuElementsPadding)}
      PaddingRight={new UDim(0, uiPreferences.menuElementsPadding)}
    />
    <uilistlayout FillDirection={"Vertical"} Padding={new UDim(0, uiPreferences.menuElementsPadding)} />
    {props.children}
  </frame>;
}

function Header(props: React.PropsWithChildren) {
  return <frame
    AutomaticSize={"Y"}
    BackgroundTransparency={1}
    Size={UDim2.fromScale(1, 0)}
  >
    {props.children}
  </frame>;
}

function PlaceLabel() {
  return (
    <textlabel
      FontFace={new Font(
        "rbxasset://fonts/families/GothamSSm.json",
        Enum.FontWeight.SemiBold,
        Enum.FontStyle.Normal
      )}
      Text={PLACE_NAME}
      TextColor3={Color3.fromHex("#FFFFFF")}
      TextSize={24}
      AutomaticSize={"XY"}
      BackgroundTransparency={1}
    >
      <uistroke
        Transparency={0.75}
      />
    </textlabel>
  );
}

export function MainMenu() {
  return <Master>
    <Header>
      <PlaceLabel />
    </Header>

    <TabsButtonList>
      <TabButton Group="Menu" Name="Play" />
      <TabButton Group="Menu" Name="Settings" />
    </TabsButtonList>

    <TabContentFrame>
      <PlayMenu />

      <Tab Group="Menu" Name="Settings">
        <frame Position={UDim2.fromOffset(100, 0)} Size={new UDim2(0, 100, 0, 100)} />
      </Tab>

    </TabContentFrame>
  </Master>;
}

// # Bindings & misc
new ConsoleFunctionCallback(["mainmenu_open"], []).setCallback(() => MAINMENU_VISIBILITY_CHANGED.Fire(true));
new ConsoleFunctionCallback(["mainmenu_close"], []).setCallback(() => MAINMENU_VISIBILITY_CHANGED.Fire(false));
new ConsoleFunctionCallback(["mainmenu_toggle"], []).setCallback(() => {
  isVisible = !isVisible;
  MAINMENU_VISIBILITY_CHANGED.Fire(isVisible);
});

MAINMENU_VISIBILITY_CHANGED.Connect(vis => isVisible = vis);