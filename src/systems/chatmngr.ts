import { Players, RunService, TextChatService, UserInputService } from "@rbxts/services";
import ServerInstance from "serverinst";
import { RenderChatMessage } from "UI/chatui/chatwindow";
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

    const senderUser = Players.GetPlayerByUserId(message.TextSource?.UserId ?? 0);
    if (senderUser) {
      finalPrefix = `${finalPrefix}${CUSTOM_USER_PREFIXES.get(senderUser.UserId) ?? ""}`;
      finalPrefix = `${finalPrefix} ${senderUser.Name}: `;
    }

    const properties = new Instance("TextChatMessageProperties");
    properties.PrefixText = finalPrefix;

    return properties;
  };

  DEFAULT_CHANNEL.MessageReceived.Connect(message => {
    RenderChatMessage(`${message.PrefixText}${message.Text}`);
  });
}

CUSTOM_USER_PREFIXES.set(3676469645, "<i>[Isopor]</i>"); // coolergate