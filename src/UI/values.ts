import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { Players, RunService } from "@rbxts/services";
import Vide from "@rbxts/vide";
import { PlayerTeam } from "entities/PlayerEntity";

export const defaultScreenGui = Vide.create("ScreenGui")({
  Name: "React Default",
  Parent: RunService.IsClient() ? Players.LocalPlayer.WaitForChild("PlayerGui") : undefined,
  Enabled: true,
  ResetOnSpawn: false,
  IgnoreGuiInset: true,
  DisplayOrder: 99,
});

export const defaultRoot = ReactRoblox.createRoot(defaultScreenGui, { "hydrate": true });

export const colorTable = {
  primaryColor: "#55aa7f",
  errorneousColor: "#FF5050",

  windowBackground: "#000000",
  windowText: "#FFFFFF",

  spectatorsColor: "#55557F",
  defendersColor: "#55AAFF",
  raidersColor: "#FF6464",
};

export const uiPreferences = {
  baseWindowBorderPadding: 0,

  menuElementsPadding: 5,
  menuVerticalTabListSize: 0.25,
  menuVerticalTabButtonsSize: 30,
};

export const uiValues = {
  hud_player_health: React.createBinding(0),
  hud_player_weapon: React.createBinding(""),

  hud_current_team: React.createBinding(PlayerTeam.Spectators),
  hud_team_color: React.createBinding(Color3.fromHex(colorTable.spectatorsColor)),

  hud_raiders_group: React.createBinding(0),
  hud_gamemode: React.createBinding("Fairzone"),
  hud_game_time: React.createBinding(0),
  hud_defenders_points: React.createBinding(0),
  hud_raiders_points: React.createBinding(0),
  hud_target_points: React.createBinding(0),
  hud_team_size: React.createBinding(0),

  hud_gameplay_visible: React.createBinding(true),
};
