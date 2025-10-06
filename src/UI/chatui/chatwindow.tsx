import React, { useEffect } from "@rbxts/react";
import { Players, TextChatService } from "@rbxts/services";
import { BlankWindow } from "UI/blocks/window";
import { uiValues } from "UI/values";

// # Types
interface ChatMessageConfig {
  sender: number;
  additionalTags: string[];
}

// # Constants & variables
let currentReference: Instance | undefined;

// # Functions
export function RenderChatMessage(text: string, config?: Partial<ChatMessageConfig>) {
  if (config) {
    if (config.sender !== undefined && config.sender !== 0) {
      const player = Players.GetPlayerByUserId(config.sender);
      if (player)
        text = `<${player.Name}> ${text}`;
    }
  }

  const textLabel = new Instance("TextLabel");
  textLabel.FontFace = new Font(
    "rbxasset://fonts/families/GothamSSm.json",
    Enum.FontWeight.SemiBold,
    Enum.FontStyle.Normal
  );
  textLabel.RichText = true;
  textLabel.Text = text;
  textLabel.TextColor3 = Color3.fromHex("#FFFFFF");
  textLabel.TextSize = 16;
  textLabel.TextWrapped = true;
  textLabel.TextXAlignment = Enum.TextXAlignment.Left;
  textLabel.TextYAlignment = Enum.TextYAlignment.Top;
  textLabel.AutomaticSize = Enum.AutomaticSize.Y;
  textLabel.BackgroundTransparency = 1;
  textLabel.Size = UDim2.fromScale(1, 0);

  const uIStroke = new Instance("UIStroke");
  uIStroke.Thickness = 0.75;
  uIStroke.Parent = textLabel;

  if (currentReference) {
    textLabel.Parent = currentReference;
    textLabel.LayoutOrder = -currentReference.GetChildren().size();
  }
}

export function ChatWindow() {
  const parentFrameRef = React.createRef<ScrollingFrame>();

  useEffect(() => {
    currentReference = parentFrameRef.current;
  });

  return (
    <BlankWindow
      AnchorPoint={new Vector2(0, 1)}
      BackgroundColor={uiValues.hud_team_color[0]}
      BackgroundTransparency={0.75}
      Position={React.createBinding(new UDim2(0, 16, 1, -16))[0]}
      Size={new UDim2(0.3, 0, 0.4, 0)}
    >
      <scrollingframe
        AutomaticCanvasSize={"Y"}
        CanvasSize={new UDim2()}
        ScrollBarThickness={0}
        Active={true}
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 1)}
        ref={parentFrameRef}
      >
        <uilistlayout
          SortOrder={"LayoutOrder"}
        />
        <uipadding
          PaddingBottom={new UDim(0, 10)}
          PaddingLeft={new UDim(0, 8)}
          PaddingRight={new UDim(0, 10)}
          PaddingTop={new UDim(0, 4)}
        />
      </scrollingframe>
    </BlankWindow>
  );
}

// # Execution