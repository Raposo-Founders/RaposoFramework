import ReactRoblox from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import Vide from "@rbxts/vide";

export const defaultScreenGui = Vide.create("ScreenGui")({
  Parent: Players.LocalPlayer.WaitForChild("PlayerGui"),
  Enabled: true,
  ResetOnSpawn: false,
  IgnoreGuiInset: true,
  DisplayOrder: 99,
});

export const defaultRoot = ReactRoblox.createRoot(defaultScreenGui, { "hydrate": true });

export const colorTable = {
  primaryColor: "#55aa7f",

  windowBackground: "#000000",
  windowText: "#FFFFFF",
};

export const uiPreferences = {
  baseWindowBorderPadding: 0,

  menuElementsPadding: 5,
  menuVerticalTabListSize: 0.25,
  menuVerticalTabButtonsSize: 0.075,
};
