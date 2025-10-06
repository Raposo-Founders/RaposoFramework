import ColorUtils from "@rbxts/colour-utils";
import { Players, RunService, TextChatService, UserInputService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import ServerInstance from "serverinst";
import { RenderChatMessage } from "UI/chatui/chatwindow";
import { colorTable, uiValues } from "UI/values";
import { ReplicatedInstance } from "util/utilfuncs";

// # Types
type ChatMessageAttributes = "Shout" | "TeamOnly";

// # Constants & variables
const ATTRIBUTES_SEPARATOR = ";";

const CHANNELS_FOLDER = ReplicatedInstance(TextChatService, "ServerChannels", "Folder");
const DEFAULT_CHANNEL = ReplicatedInstance(CHANNELS_FOLDER, "RAPOSO_CHANNEL_DEFAULT", "TextChannel");
const INPUTBAR_CONFIG = TextChatService.WaitForChild("ChatInputBarConfiguration") as ChatInputBarConfiguration;

const CUSTOM_USER_PREFIXES = new Map<number, string>();

// # Functions
function formatString(text: string) {
  return text.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
}

export function sendChatMessage(text: string, attributes: ChatMessageAttributes[]) {
  DEFAULT_CHANNEL.SendAsync(formatString(text), attributes.join(ATTRIBUTES_SEPARATOR));
}

// # Bindings & misc
if (RunService.IsServer()) {
  Players.PlayerAdded.Connect(user => {
    DEFAULT_CHANNEL.AddUserAsync(user.UserId);
  });

  DEFAULT_CHANNEL.ShouldDeliverCallback = (message, source) => {
    const senderUser = Players.GetPlayerByUserId(message.TextSource?.UserId ?? 0);
    if (!senderUser) return false;

    const receivingUser = Players.GetPlayerByUserId(source.UserId);
    if (!receivingUser) return false;

    for (const server of ServerInstance.GetServersFromPlayer(senderUser)) {
      if (!server.trackingPlayers.has(receivingUser)) continue;
      return true;
    }

    return false;
  };
}

if (RunService.IsClient()) {
  UserInputService.InputBegan.Connect(() => {
    INPUTBAR_CONFIG.Enabled = UserInputService.TouchEnabled;
  });

  DEFAULT_CHANNEL.OnIncomingMessage = (message) => {
    let finalPrefix = "";
    let textColor = ColorUtils.Darken(uiValues.hud_team_color[0].getValue(), 0.75);

    const senderUser = Players.GetPlayerByUserId(message.TextSource?.UserId ?? 0);
    if (senderUser) {
      let entity: PlayerEntity | undefined;
      for (const ent of defaultEnvironments.entity.getEntitiesThatIsA("PlayerEntity")) {
        if (ent.GetUserFromController() !== senderUser) continue;
        entity = ent;
        break;
      }
      
      if (entity) {
        switch (entity.team) {
        case PlayerTeam.Defenders:
          textColor = Color3.fromHex(colorTable.defendersColor);
          break;
        case PlayerTeam.Raiders:
          textColor = Color3.fromHex(colorTable.raidersColor);
          break;
        case PlayerTeam.Spectators:
          textColor = Color3.fromHex(colorTable.spectatorsColor);
          break;
        }
      }

      finalPrefix = `${finalPrefix}${CUSTOM_USER_PREFIXES.get(senderUser.UserId) ?? ""}`;
      finalPrefix = `${finalPrefix} <font color="#${textColor.ToHex()}">${senderUser.Name}</font>: `;
    }

    const properties = new Instance("TextChatMessageProperties");
    properties.PrefixText = finalPrefix;

    return properties;
  };

  DEFAULT_CHANNEL.MessageReceived.Connect(message => {
    RenderChatMessage(`${message.PrefixText}${message.Text}`);
  });
}

CUSTOM_USER_PREFIXES.set(3676469645, `<font color="#55ff7f"><i>[The snake]</i></font>`); // coolergate