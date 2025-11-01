import ColorUtils from "@rbxts/colour-utils";
import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { Players, RunService } from "@rbxts/services";
import { BlankWindow } from "UI/blocks/window";
import { colorTable } from "UI/values";
import Signal from "util/signal";

// # Constants & variables
const [visibleBinding, setVisible] = React.createBinding(false);

export const loadingScreenGui = new Instance("ScreenGui")
loadingScreenGui.Name = "LoadingScreen";
loadingScreenGui.Parent = RunService.IsClient() ? Players.LocalPlayer.WaitForChild("PlayerGui") : undefined;
loadingScreenGui.Enabled = true;
loadingScreenGui.ResetOnSpawn = false;
loadingScreenGui.IgnoreGuiInset = true;
loadingScreenGui.DisplayOrder = 999;
loadingScreenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;

const DISPLAYING_LOADING_SCREEN = new Set<string>();

// # Functions
export function DisplayLoadingScreen(key: string) {
  if (!RunService.IsClient()) return;
  DISPLAYING_LOADING_SCREEN.add(key);
  setVisible(!DISPLAYING_LOADING_SCREEN.isEmpty());
}

export function HideLoadingScreen(key: string) {
  if (!RunService.IsClient()) return;
  DISPLAYING_LOADING_SCREEN.delete(key);
  setVisible(!DISPLAYING_LOADING_SCREEN.isEmpty());
}

function LoadingScreen() {

  return (
    <>
      <BlankWindow
        AnchorPoint={new Vector2(0.5, 0.5)}
        BackgroundColor={Color3.fromHex(colorTable.windowBackground)}
        Position={React.createBinding(new UDim2(0.5, 0, 0.5, 0))[0]}
        Size={new UDim2(0, 400, 0, 250)}
        Visible={visibleBinding}
      >
        <textlabel
          FontFace={new Font(
            "rbxasset://fonts/families/GothamSSm.json",
            Enum.FontWeight.SemiBold,
            Enum.FontStyle.Normal
          )}
          Text={"Loading..."}
          TextColor3={ColorUtils.Darken(Color3.fromHex(colorTable.windowBackground), 0.75)}
          TextSize={34}
          TextWrapped={true}
          AnchorPoint={new Vector2(0.5, 0.5)}
          AutomaticSize={"XY"}
          BackgroundTransparency={1}
          Position={UDim2.fromScale(0.5, 0.5)}
        >
          <uistroke
            Transparency={0.75}
          />
        </textlabel>
      </BlankWindow>
    </>
  );
}

// # Execution
const root = ReactRoblox.createRoot(loadingScreenGui);
root.render(<LoadingScreen />)
