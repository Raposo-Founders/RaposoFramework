import React from "@rbxts/react";
import { Tab, TabButton, TabContentFrame } from "./tabs";
import { uiPreferences } from "../default/values";
import { FetchServers } from "systems/sessionmngr";
import { ExecuteCommand } from "cmd";

// # Constants & variables
const GROUPID = "PlayMenu";

// # Functions
export function SessionButton(props: { SessionId: string }) {
  return <textbutton
    FontFace={new Font(
      "rbxasset://fonts/families/GothamSSm.json",
      Enum.FontWeight.Medium,
      Enum.FontStyle.Normal
    )}
    Text={props.SessionId}
    TextColor3={Color3.fromHex("#FFFFFF")}
    TextScaled={true}
    BackgroundColor3={Color3.fromHex("#000000")}
    BackgroundTransparency={0.5}
    BorderSizePixel={0}
    Size={UDim2.fromScale(1, uiPreferences.menuVerticalTabButtonsSize)}
    Event={{
      Activated: () => {
        ExecuteCommand(`connect ${props.SessionId}`);
        ExecuteCommand("mainmenu_close");
      }
    }}
    TextXAlignment={"Left"}
  >
    <uipadding PaddingBottom={new UDim(0, 3)} PaddingTop={new UDim(0, 3)} PaddingLeft={new UDim(0.05, 0)} PaddingRight={new UDim(0.05, 0)} />
  </textbutton>;
}

function SessionsList() {
  const sessionsList = FetchServers();
  const elements: React.Element[] = [];

  for (const sessionInfo of sessionsList) {
    elements.push(<SessionButton SessionId={sessionInfo.sessionId} />);
  }

  return <>{elements}</>;
}

export function PlayMenu() {
  return <Tab Group="Menu" Name="Play">
    <uilistlayout FillDirection={"Horizontal"} Padding={new UDim(0, uiPreferences.menuElementsPadding)} />

    <frame // Tabs
      BackgroundTransparency={1}
      Size={UDim2.fromScale(uiPreferences.menuVerticalTabListSize, 1)}
    >
      <uilistlayout FillDirection={"Vertical"} Padding={new UDim(0, uiPreferences.menuElementsPadding)} />

      <TabButton Group={GROUPID} Name="Join a session" Size={UDim2.fromScale(1, uiPreferences.menuVerticalTabButtonsSize)} SmallText={true} />
      <TabButton Group={GROUPID} Name="Create a session" Size={UDim2.fromScale(1, uiPreferences.menuVerticalTabButtonsSize)} SmallText={true} />
    </frame>

    <TabContentFrame>
      <Tab Group={GROUPID} Name="Join a session">
        {SessionsList()}
      </Tab>
      <Tab Group={GROUPID} Name="Create a session">
        <frame Position={UDim2.fromOffset(100, 100)} Size={UDim2.fromOffset(100, 100)} />
      </Tab>
    </TabContentFrame>
  </Tab>;
}