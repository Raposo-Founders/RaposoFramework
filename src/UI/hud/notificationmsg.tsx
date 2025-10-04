import ColorUtils from "@rbxts/colour-utils";
import React, { useEffect } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { Players, RunService, TextService, TweenService } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ServerInstance from "serverinst";
import { colorTable } from "UI/default/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString } from "util/bufferwriter";

// # Constants & variables
const [positionBinding, SetPosition] = React.createBinding(-0.1);

let currentParentInstance: Instance | undefined;
let disconnectCurrentAnimation: Callback | undefined;

// # Functions
function Animate() {
  disconnectCurrentAnimation?.();

  const startingTime = time();

  let binding: Callback | undefined;
  binding = defaultEnvironments.lifecycle.BindUpdate(() => {
    const alpha = TweenService.GetValue((time() - startingTime) / 0.25, "Sine", "InOut");
    SetPosition(-0.2 * math.clamp(1 - alpha, 0, 1));

    if (alpha <= 0) {
      binding?.();
      binding = undefined;

      disconnectCurrentAnimation = undefined;
    }
  });

  disconnectCurrentAnimation = () => {
    binding?.();
    binding = undefined;

    SetPosition(-0.1);
  };
}

export function NotificationsDisplay() {
  const parentReference = React.createRef<Frame>();

  useEffect(() => {
    currentParentInstance = parentReference.current;
    return () => currentParentInstance = undefined;
  });

  return (
    <frame
      BackgroundTransparency={1}
      Position={UDim2.fromScale(0, 0.25)}
      Size={UDim2.fromScale(0.25, 1)}
      ZIndex={-1e+03}
      ref={parentReference}
    >
      <uilistlayout
        SortOrder={"LayoutOrder"}
      />
    </frame>
  );
}

export async function RenderPlayerShout(userId: number, color: Color3, duration: number, message: string) {
  if (!currentParentInstance) return;

  const element = (
    <frame
      BackgroundColor3={ColorUtils.Darken(color, 0.75)}
      BorderSizePixel={0}
      ClipsDescendants={true}
      Position={UDim2.fromScale(0, 0.25)}
      Size={UDim2.fromScale(1, 1)}
    >
      <uiaspectratioconstraint
        AspectRatio={3}
      />

      <frame // Content frame
        BackgroundColor3={color}
        BorderSizePixel={0}
        LayoutOrder={1}
        Size={UDim2.fromScale(1, 1)}
        Position={positionBinding.map(val => UDim2.fromScale(val, 0))}
        ZIndex={100}
      >
        <uiflexitem
          FlexMode={"Shrink"}
        />

        <imagelabel
          Image={"rbxassetid://103619157995612"}
          ImageColor3={color}
          BackgroundTransparency={1}
          Size={UDim2.fromScale(1, 1)}
          ZIndex={5}
        >
          <uiaspectratioconstraint />
        </imagelabel>

        <textlabel // Username
          FontFace={new Font(
            "rbxasset://fonts/families/GothamSSm.json",
            Enum.FontWeight.Bold,
            Enum.FontStyle.Normal
          )}
          Text={`${Players.GetPlayerByUserId(userId)?.Name ?? Players.GetNameFromUserIdAsync(userId)}:`}
          TextColor3={Color3.fromHex("#FFFFFF")}
          TextScaled={true}
          TextTransparency={0.25}
          TextXAlignment={"Left"}
          BackgroundTransparency={1}
          Position={UDim2.fromScale(0.1, 0.1)}
          Size={UDim2.fromScale(0.9, 0.25)}
        />

        <textlabel // Content
          FontFace={new Font(
            "rbxasset://fonts/families/GothamSSm.json",
            Enum.FontWeight.Bold,
            Enum.FontStyle.Normal
          )}
          Text={message}
          TextColor3={Color3.fromHex("#FFFFFF")}
          TextSize={20}
          TextWrapped={true}
          TextXAlignment={"Left"}
          TextYAlignment={"Top"}
          AutomaticSize={"Y"}
          BackgroundTransparency={1}
          Position={UDim2.fromScale(0.2, 0.35)}
          Size={UDim2.fromScale(0.8, 0.65)}
        />

        <imagelabel // User avatar
          Image={`rbxthumb://type=AvatarHeadShot&id=${tostring(userId)}&w=150&h=150`}
          BackgroundTransparency={1}
          Size={UDim2.fromScale(1, 1)}
          ZIndex={0}
        >
          <uiaspectratioconstraint />

          <uigradient
            Transparency={new NumberSequence([
              new NumberSequenceKeypoint(0, 0),
              new NumberSequenceKeypoint(1, 1),
            ])}
          />
        </imagelabel>
      </frame>
    </frame>
  );

  const root = ReactRoblox.createRoot(currentParentInstance, { "hydrate": true });
  root.render(element);

  Animate();

  task.wait(duration);

  root.unmount();
}

// # Bindings
new ConsoleFunctionCallback(["shout", "message", "m"], [{ name: "message", type: "strings" }])
  .setDescription("Shouts an message to everyone in the session")
  .setCallback(ctx => {
    ctx.Reply("Message shouted.");

    startBufferCreation();
    writeBufferString(ctx.getArgument("message", "strings").value.join(" "));
    defaultEnvironments.network.sendPacket("message_shout");
  });

ServerInstance.serverCreated.Connect(inst => {

  inst.network.listenPacket("message_shout", (info) => {
    if (!info.sender) return;
    if (!info.sender.GetAttribute(gameValues.modattr)) return;

    const reader = BufferReader(info.content);
    const message = reader.string();
    const filteredMessage = TextService.FilterStringAsync(message, info.sender.UserId, "PublicChat");

    startBufferCreation();
    writeBufferString(tostring(info.sender.UserId));
    writeBufferString(tostring(info.sender.GetAttribute(gameValues.usersessionid)));
    writeBufferString(filteredMessage.GetNonChatStringForBroadcastAsync());
    inst.network.sendPacket("message_shouted");
  });

});

if (RunService.IsClient())
  defaultEnvironments.network.listenPacket("message_shouted", (info) => {
    const reader = BufferReader(info.content);
    const userId = tonumber(reader.string()) ?? 1;
    const userSessionId = reader.string();
    const message = reader.string();

    let entity: PlayerEntity | undefined;
    for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("PlayerEntity")) {
      if (ent.controller !== userSessionId) continue;
      entity = ent;
      break;
    }
    if (!entity) return;

    let teamColor = colorTable.spectatorsColor;
    if (entity.team === PlayerTeam.Raiders) teamColor = colorTable.raidersColor;
    if (entity.team === PlayerTeam.Defenders) teamColor = colorTable.defendersColor;

    RenderPlayerShout(userId, Color3.fromHex(teamColor), 10, message);
  });