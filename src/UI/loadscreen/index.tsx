import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { Players, RunService, TweenService } from "@rbxts/services";
import { cacheFolder } from "folders";
import Signal from "util/signal";

// # Constants & variables
export const loadingScreenGui = new Instance("ScreenGui")
loadingScreenGui.Name = "LoadingScreen";
loadingScreenGui.Parent = RunService.IsClient() ? Players.LocalPlayer.WaitForChild("PlayerGui") : undefined;
loadingScreenGui.Enabled = true;
loadingScreenGui.ResetOnSpawn = false;
loadingScreenGui.IgnoreGuiInset = true;
loadingScreenGui.DisplayOrder = 999;
loadingScreenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;

const DISPLAYING_LOADING_SCREEN = new Set<string>();
const LOADING_SCREEN_UPDATE = new Signal();

// # Functions
export function DisplayLoadingScreen(key: string) {
  if (!RunService.IsClient()) return;
  DISPLAYING_LOADING_SCREEN.add(key);
  LOADING_SCREEN_UPDATE.Fire();
}

export function HideLoadingScreen(key: string) {
  if (!RunService.IsClient()) return;
  DISPLAYING_LOADING_SCREEN.delete(key);
  LOADING_SCREEN_UPDATE.Fire();
}

function LoadingScreen() {
  const [transparencyBinding, setTransparency] = React.createBinding(1);

  const valueInstance = new Instance("NumberValue");
  valueInstance.Parent = cacheFolder;
  valueInstance.Value = 1

  let currentTween: Tween | undefined;
  let isVisible = false;

  LOADING_SCREEN_UPDATE.Connect(() => {
    const shouldDisplay = !DISPLAYING_LOADING_SCREEN.isEmpty();
    if (isVisible === shouldDisplay) return;
    isVisible = shouldDisplay

    if (currentTween) {
      currentTween.Cancel();
      currentTween.Destroy();
      currentTween = undefined;
    }

    currentTween = TweenService.Create(valueInstance, new TweenInfo(0.25, Enum.EasingStyle.Linear), { Value: shouldDisplay ? 0 : 1 })
    currentTween.Completed.Once((state) => {
      currentTween?.Destroy();
      currentTween = undefined;
    });
    currentTween.Play();
  });

  valueInstance.Changed.Connect(val => setTransparency(val))

  return (
    <>
      <canvasgroup
        AnchorPoint={new Vector2(0.5, 0.5)}
        BackgroundColor3={Color3.fromHex("#000000")}
        BorderColor3={Color3.fromHex("#000000")}
        BorderSizePixel={0}
        Position={UDim2.fromScale(0.5, 0.5)}
        Size={UDim2.fromScale(1, 1)}
        GroupTransparency={transparencyBinding.map(val => math.lerp(1, 0.5, 1 - transparencyBinding.getValue()))}
        ZIndex={999}
      >
        <videoframe
          Video={"rbxassetid://5670826209"}
          Looped={true}
          Playing={transparencyBinding.map(val => val < 1)}
          BackgroundColor3={Color3.fromHex("#FFFFFF")}
          BackgroundTransparency={1}
          BorderColor3={Color3.fromHex("#000000")}
          BorderSizePixel={0}
          Size={UDim2.fromScale(1, 1)}
        />

        <uiaspectratioconstraint
          AspectRatio={1.78}
        />
      </canvasgroup>

      <frame
        BackgroundColor3={Color3.fromHex("#000000")}
        BackgroundTransparency={transparencyBinding}
        BorderColor3={Color3.fromHex("#000000")}
        BorderSizePixel={0}
        Size={UDim2.fromScale(1, 1)}
        ZIndex={998}
      />
    </>
  );
}

// # Execution
const root = ReactRoblox.createRoot(loadingScreenGui);
root.render(<LoadingScreen />)
