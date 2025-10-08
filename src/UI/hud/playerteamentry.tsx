import React, { useEffect } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { defaultEnvironments } from "defaultinsts";
import { PlayerTeam } from "entities/PlayerEntity";
import { getPlayersFromTeam } from "systems/playermngr";
import { colorTable, uiValues } from "UI/values";

// # Constants & variables
const DEAD_ICON = "rbxassetid://16682879119";
const DISCONNECTED_ICON = "rbxassetid://73914583608410";
const DEFAULT_USER_IMAGE = "rbxassetid://76527276016929";

// # Functions

function formatUserImageLabel(userId: number) {
  return string.format("rbxthumb://type=AvatarBust&id=%i&w=100&h=100", userId);
}

function PlayerExpandedTopEntryInfo(props: { entityId: React.Binding<string> }) {
  const [killsBind, SetKills] = React.createBinding(99);
  const [deathsBind, SetDeaths] = React.createBinding(99);
  const [pingBind, SetPing] = React.createBinding(99);
  const [flagBind, SetFlag] = React.createBinding("");
  const [accentColor, SetAccentColor] = React.createBinding(Color3.fromHex(colorTable.spectatorsColor));

  const DisplayLabel = (props: { Text: React.Binding<string>, LayoutOrder: number }) => {
    return <textlabel // Kills
      FontFace={new Font(
        "rbxasset://fonts/families/GothamSSm.json",
        Enum.FontWeight.SemiBold,
        Enum.FontStyle.Normal
      )}
      Text={props.Text}
      TextColor3={Color3.fromHex("#FFFFFF")}
      TextSize={14}
      TextTruncate={"AtEnd"}
      TextWrapped={true}
      TextXAlignment={"Left"}
      BackgroundTransparency={1}
      LayoutOrder={props.LayoutOrder}
      Size={new UDim2(1, 0, 0, 14)}
    />;
  };

  return (
    <frame
      AnchorPoint={new Vector2(0.5, 0)}
      BackgroundColor3={accentColor}
      BackgroundTransparency={0.5}
      BorderSizePixel={0}
      Position={new UDim2(0.5, 0, 1, 40)}
      Size={UDim2.fromOffset(150, 150)}
    >
      <uicorner
        CornerRadius={new UDim(0, 12)}
      />

      <frame // Content
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 1)}
      >
        <textlabel
          FontFace={new Font(
            "rbxasset://fonts/families/GothamSSm.json",
            Enum.FontWeight.SemiBold,
            Enum.FontStyle.Normal
          )}
          Text={"OnlyTwentyCharacters"}
          TextColor3={Color3.fromHex("#FFFFFF")}
          TextSize={14}
          TextTruncate={"AtEnd"}
          TextWrapped={true}
          BackgroundTransparency={1}
          Size={new UDim2(1, 0, 0, 14)}
        />

        <frame // Stats display
          BackgroundTransparency={1}
          Position={UDim2.fromOffset(0, 16)}
          Size={new UDim2(1, 0, 1, -16)}
        >
          <uilistlayout
            SortOrder={"LayoutOrder"}
          />

          <DisplayLabel Text={killsBind.map(val => `Kills: ${val}`)} LayoutOrder={1} />
          <DisplayLabel Text={deathsBind.map(val => `Deaths: ${val}`)} LayoutOrder={2} />
          <DisplayLabel Text={pingBind.map(val => `Ping: ${val}`)} LayoutOrder={3} />
        </frame>

        <uipadding
          PaddingBottom={new UDim(0, 6)}
          PaddingLeft={new UDim(0, 6)}
          PaddingRight={new UDim(0, 6)}
          PaddingTop={new UDim(0, 6)}
        />
      </frame>

      <imagelabel // User flag
        Image={flagBind}
        ScaleType={"Fit"}
        AnchorPoint={new Vector2(0.5, 0.5)}
        BackgroundTransparency={1}
        Position={UDim2.fromScale(0.9, 0.9)}
        Rotation={10}
        Size={UDim2.fromOffset(40, 40)}
        ZIndex={2}
      />

      <imagelabel // Caret
        Image={"rbxasset://textures/ui/InGameChat/Caret.png"}
        ImageColor3={accentColor}
        ImageTransparency={0.5}
        AnchorPoint={new Vector2(0.5, 1)}
        BackgroundTransparency={1}
        LayoutOrder={2}
        Position={UDim2.fromScale(0.5, 0)}
        Rotation={180}
        Size={UDim2.fromOffset(18, 18)}
      >
        <uiaspectratioconstraint
          AspectRatio={1.33}
        />
      </imagelabel>
    </frame>
  );
}

function PlayerTopTeamEntry(props: { entityId: React.Binding<EntityId>, layoutOrder: React.Binding<number> }) {
  const [statsText, SetStatsText] = React.createBinding("0 / 0");
  const [userImage, SetUserImage] = React.createBinding(formatUserImageLabel(1));
  const [teamColorBinding, SetTeamColor] = React.createBinding(Color3.fromHex(colorTable.spectatorsColor));

  const [userDeadBinding, SetUserDead] = React.createBinding(false);
  const [userDisconnected, SetUserDisconnected] = React.createBinding(false);

  const binding1 = defaultEnvironments.lifecycle.BindTickrate(() => {
    const entity = defaultEnvironments.entity.entities.get(props.entityId.getValue());
    if (!entity?.IsA("PlayerEntity")) {
      SetUserDead(true);
      SetUserDisconnected(true);
      SetUserImage(DEFAULT_USER_IMAGE);
      return;
    }

    SetUserDisconnected(false);
    SetUserDead(entity.health <= 0);
    SetStatsText(`${entity.stats.kills} / ${entity.stats.deaths}`);

    {
      let teamColor = colorTable.spectatorsColor;
      if (props.entityId.getValue() !== "" && entity.team === PlayerTeam.Defenders) teamColor = colorTable.defendersColor;
      if (props.entityId.getValue() !== "" && entity.team === PlayerTeam.Raiders) teamColor = colorTable.raidersColor;

      SetTeamColor(Color3.fromHex(teamColor));
    }

    SetUserImage(formatUserImageLabel(entity.GetUserFromController()?.UserId ?? 1));
  });

  useEffect(() => {
    return () => {
      binding1();
    };
  });

  return (
    <frame
      BackgroundTransparency={1}
      Size={UDim2.fromOffset(50, 50)}
      LayoutOrder={props.layoutOrder}
    >
      <frame // Masked content
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 1)}
      >
        <canvasgroup // Background
          GroupColor3={teamColorBinding}
          GroupTransparency={0.5}
          BackgroundTransparency={1}
          Size={UDim2.fromScale(1, 1)}
        >
          <frame // Bottom circle
            BackgroundColor3={Color3.fromHex("#FFFFFF")}
            BorderSizePixel={0}
            Size={UDim2.fromScale(1, 1)}
          >
            <uicorner
              CornerRadius={new UDim(1, 0)}
            />
          </frame>

          <frame
            BackgroundColor3={Color3.fromHex("#FFFFFF")}
            BorderSizePixel={0}
            Size={UDim2.fromScale(1, 0.5)}
          />
        </canvasgroup>

        <imagelabel // Rounded user image
          Image={userImage}
          BackgroundTransparency={1}
          Size={UDim2.fromOffset(50, 50)}
          ZIndex={2}
        >
          <uicorner
            CornerRadius={new UDim(1, 0)}
          />
        </imagelabel>

        <frame // Half-top user image
          BackgroundTransparency={1}
          ClipsDescendants={true}
          Size={UDim2.fromOffset(50, 25)}
          ZIndex={3}
        >
          <imagelabel
            Image={userImage}
            BackgroundTransparency={1}
            Size={UDim2.fromOffset(50, 50)}
          />
        </frame>
      </frame>

      <textlabel // Stats text
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={statsText}
        TextColor3={Color3.fromHex("#FFFFFF")}
        TextSize={14}
        TextTransparency={0.5}
        TextTruncate={"AtEnd"}
        AnchorPoint={new Vector2(0.5, 0)}
        AutomaticSize={"Y"}
        BackgroundTransparency={1}
        Position={new UDim2(0.5, 0, 1, 5)}
        Size={UDim2.fromScale(1, 0)}
      />

      <frame // Dark overlay
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 1)}
        ZIndex={5}
        Visible={userDeadBinding}
      >
        <canvasgroup // Background
          GroupColor3={Color3.fromHex("#000000")}
          GroupTransparency={0.5}
          BackgroundTransparency={1}
          Size={UDim2.fromScale(1, 1)}
        >
          <frame
            BackgroundColor3={Color3.fromHex("#FFFFFF")}
            BorderSizePixel={0}
            Size={UDim2.fromScale(1, 1)}
          >
            <uicorner
              CornerRadius={new UDim(1, 0)}
            />
          </frame>
          <frame
            BackgroundColor3={Color3.fromHex("#FFFFFF")}
            BorderSizePixel={0}
            Size={UDim2.fromScale(1, 0.5)}
          />
        </canvasgroup>

        <imagelabel // Icon
          Image={userDisconnected.map(val => val ? DISCONNECTED_ICON : DEAD_ICON)}
          ImageColor3={userDisconnected.map(val => val ? new Color3(1, 0.4, 0.4) : new Color3(1, 1, 1))}
          AnchorPoint={new Vector2(0.5, 0.5)}
          BackgroundTransparency={1}
          Position={UDim2.fromScale(0.5, 0.5)}
          Size={UDim2.fromScale(0.75, 0.75)}
        />
      </frame>
    </frame>
  );
}

export function PlayersTopListing(props: { team: keyof typeof PlayerTeam }) {
  interface MountedPlayerInfo {
    unmount: Callback;
    setEntityId: (id: EntityId) => void;
    setLayoutOrder: (order: number) => void;
  }

  const referenceFrame = React.createRef<Frame>();
  const mountedEntries: MountedPlayerInfo[] = [];

  const thread1 = task.spawn(() => {
    while (game) {
      if (!referenceFrame.current) {
        task.wait();
        continue;
      }

      const entitiesList = getPlayersFromTeam(defaultEnvironments.entity, PlayerTeam[props.team]);

      entitiesList.sort((a, b) => {
        return a.stats.kills > b.stats.kills;
      });

      // Unmount the entire thing if it isn't equal to the current team size
      if (mountedEntries.size() !== uiValues.hud_team_size[0].getValue()) {
        for (const entry of mountedEntries)
          entry.unmount();
        mountedEntries.clear();
      }

      for (let i = 0; i < uiValues.hud_team_size[0].getValue(); i++) {
        let uiEntryInfo = mountedEntries[i];
        const targetPlayer = entitiesList[i];

        if (!uiEntryInfo) {
          const [entityIdBinding, SetEntityId] = React.createBinding<EntityId>("");
          const [layoutOrderBinding, SetLayoutOrder] = React.createBinding(999999);

          const root = ReactRoblox.createRoot(referenceFrame.current, { "hydrate": true });
          root.render(<PlayerTopTeamEntry entityId={entityIdBinding} layoutOrder={layoutOrderBinding} />);

          uiEntryInfo = {
            setLayoutOrder: order => SetLayoutOrder(order),
            setEntityId: id => SetEntityId(id),
            unmount: () => root.unmount(),
          };
          mountedEntries[i] = uiEntryInfo;
        }

        if (!targetPlayer) {
          uiEntryInfo.setEntityId("");
          uiEntryInfo.setLayoutOrder(999 * (props.team === "Defenders" ? -1 : 1));

          continue;
        }


        uiEntryInfo.setEntityId(targetPlayer.id);
        uiEntryInfo.setLayoutOrder(math.max(targetPlayer.stats.kills, 1) * (props.team === "Defenders" ? -1 : 1));
      }
      defaultEnvironments.lifecycle.YieldForTicks(2);
    }
  });

  useEffect(() => {
    return () => {
      task.cancel(thread1);

      for (const info of mountedEntries)
        info.unmount();
      mountedEntries.clear();
    };
  });

  return (
    <frame
      BackgroundTransparency={1}
      LayoutOrder={props.team === "Defenders" ? 1 : 3}
      Size={UDim2.fromScale(1, 1)}
      ref={referenceFrame}
    >
      <uilistlayout
        Padding={new UDim(0, 5)}
        FillDirection={"Horizontal"}
        HorizontalAlignment={props.team === "Defenders" ? "Right" : "Left"}
        SortOrder={"LayoutOrder"}
      />
      <uiflexitem
        FlexMode={"Shrink"}
      />
    </frame>
  );
}