import ColorUtils from "@rbxts/colour-utils";
import React, { useEffect } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { defaultEnvironments } from "defaultinsts";
import { PlayerTeam } from "entities/PlayerEntity";
import { getPlayersFromTeam } from "systems/playermngr";
import { BlankWindow } from "UI/blocks/window";
import countryFlags from "UI/countries";
import { uiValues } from "UI/values";
import { GetCreatorGroupInfo, GetGroupInfo, IsPlayerInGroup } from "util/groupsutil";

// # Constants & variables

// # Functions
function formatUserImageLabel(userId: number) {
  return string.format("rbxthumb://type=AvatarBust&id=%i&w=100&h=100", userId);
}

function SpectatorEntry(props: { entityId: string }) {
  const [usernameBinding, SetUsername] = React.createBinding(props.entityId);
  const [userImageBinding, SetUserImage] = React.createBinding("");
  const [groupImageBinding, SetGroupImage] = React.createBinding("");
  const [userFlagBinding, SetUserFlag] = React.createBinding("");

  {
    const entity = defaultEnvironments.entity.entities.get(props.entityId);

    if (entity?.IsA("PlayerEntity")) {
      const controller = entity.GetUserFromController();
      const creatorGroupInfo = GetCreatorGroupInfo();

      const raidersGroupId = uiValues.hud_raiders_group[0].getValue();
      let targetGroupImage = "";

      if (controller) {
        if (raidersGroupId !== 0 && IsPlayerInGroup(controller, raidersGroupId)) targetGroupImage = GetGroupInfo(raidersGroupId).EmblemUrl;
        if (creatorGroupInfo && IsPlayerInGroup(controller, creatorGroupInfo.groupInfo.Id)) targetGroupImage = creatorGroupInfo.groupInfo.EmblemUrl;
      }

      SetUsername(controller ? controller.Name : entity.id);
      SetUserFlag(controller ? (countryFlags.get(entity.stats.country)?.Decal ?? "") : "");
      SetUserImage(controller ? formatUserImageLabel(controller.UserId) : formatUserImageLabel(1));
      SetGroupImage(targetGroupImage);
    }
  }

  return (
    <frame
      BackgroundTransparency={1}
      Size={new UDim2(1, 0, 0, 30)}
    >
      <uipadding
        PaddingLeft={new UDim(0, 6)}
        PaddingRight={new UDim(0, 6)}
      />

      <frame // Ordered content
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 1)}
      >
        <textlabel // Username
          FontFace={new Font(
            "rbxasset://fonts/families/GothamSSm.json",
            Enum.FontWeight.SemiBold,
            Enum.FontStyle.Normal
          )}
          Text={usernameBinding}
          TextColor3={Color3.fromHex("#FFFFFF")}
          TextSize={20}
          TextTransparency={0.25}
          TextXAlignment={"Left"}
          AutomaticSize={"X"}
          BackgroundTransparency={1}
          LayoutOrder={999999}
          Size={UDim2.fromScale(0, 1)}
        />

        <imagelabel // Group image
          Image={groupImageBinding}
          BackgroundTransparency={1}
          LayoutOrder={1}
          Size={UDim2.fromScale(1, 1)}
        >
          <uiaspectratioconstraint />
        </imagelabel>

        <imagelabel // User image
          Image={userImageBinding}
          BackgroundTransparency={1}
          Size={UDim2.fromScale(1, 1)}
        >
          <uiaspectratioconstraint />
        </imagelabel>

        <uilistlayout
          Padding={new UDim(0, 6)}
          FillDirection={"Horizontal"}
          SortOrder={"LayoutOrder"}
        />
      </frame>

      <canvasgroup // Flag
        GroupTransparency={0.5}
        AnchorPoint={new Vector2(1, 0.5)}
        BackgroundTransparency={1}
        Position={UDim2.fromScale(1, 0.5)}
        Size={UDim2.fromScale(1, 1)}
      >
        <imagelabel
          Image={userFlagBinding}
          AnchorPoint={new Vector2(1, 0.5)}
          BackgroundTransparency={1}
          Position={UDim2.fromScale(1, 0.5)}
          Size={UDim2.fromScale(1, 1)}
        />
        <uicorner />
        <uigradient
          Transparency={new NumberSequence([
            new NumberSequenceKeypoint(0, 1),
            new NumberSequenceKeypoint(0.25, 1),
            new NumberSequenceKeypoint(1, 0),
          ])}
        />
        <uiaspectratioconstraint
          AspectRatio={1.78}
        />
      </canvasgroup>
    </frame>
  );
}

export function SpectatorsList() {
  const parentReference = React.createRef<ScrollingFrame>();
  let root: ReactRoblox.Root | undefined;

  const thread = task.spawn(() => {
    while (game) {
      if (!root) {
        task.wait();
        continue;
      }

      const foundEntities = getPlayersFromTeam(defaultEnvironments.entity, PlayerTeam.Spectators);
      const mountElements: React.Element[] = [];

      for (const ent of foundEntities)
        mountElements.push(<SpectatorEntry entityId={ent.id} />);

      root.unmount();
      root.render(<>{mountElements}</>);

      defaultEnvironments.lifecycle.YieldForTicks(40);
    }
  });

  useEffect(() => {
    if (!parentReference.current) return;

    root = ReactRoblox.createRoot(parentReference.current, { hydrate: true });

    return () => {
      task.cancel(thread);
    };
  });

  return <BlankWindow
    AnchorPoint={new Vector2(1, 0)}
    Position={React.createBinding(UDim2.fromScale(1, 0))[0]}
    BackgroundColor={uiValues.hud_team_color[0].map(val => ColorUtils.Darken(val, 0.5))}
    Size={new UDim2(0, 400, 0, 300)}
  >
    <textlabel
      FontFace={new Font(
        "rbxasset://fonts/families/GothamSSm.json",
        Enum.FontWeight.SemiBold,
        Enum.FontStyle.Normal
      )}
      Text={"SPECTATORS"}
      TextColor3={Color3.fromHex("#FFFFFF")}
      TextSize={30}
      TextTransparency={0.5}
      BackgroundTransparency={1}
      Size={new UDim2(1, 0, 0, 30)}
    />

    <scrollingframe
      AutomaticCanvasSize={"Y"}
      CanvasSize={new UDim2()}
      ScrollBarThickness={0}
      Active={true}
      AnchorPoint={new Vector2(0, 1)}
      BackgroundTransparency={1}
      Position={UDim2.fromScale(0, 1)}
      Size={new UDim2(1, 0, 1, -40)}
      ref={parentReference}
    >
      <uilistlayout
        Padding={new UDim(0, 6)}
        SortOrder={"LayoutOrder"}
      />
    </scrollingframe>

    <frame // Separation line
      AnchorPoint={new Vector2(0.5, 0)}
      BackgroundColor3={Color3.fromHex("#FFFFFF")}
      BackgroundTransparency={0.5}
      BorderSizePixel={0}
      Position={new UDim2(0.5, 0, 0, 33)}
      Size={new UDim2(1, -32, 0, 2)}
    />
  </BlankWindow>;
}