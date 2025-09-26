import { RunService, StarterGui, TextChatService, UserInputService } from "@rbxts/services";
import { finishDirectMessage, listenDirectMessage, startDirectMessage } from "network";
import ServerInstance from "serverinst";
import { BufferReader } from "util/bufferreader";
import { writeBufferString } from "util/bufferwriter";
import { RandomString, ReplicatedInstance } from "util/utilfuncs";

// # Constants & variables
const channelsFolder = ReplicatedInstance(TextChatService, "ServerChannels", "Folder");
const inputBarConfig = TextChatService.WaitForChild("ChatInputBarConfiguration") as ChatInputBarConfiguration;

const yieldingThreads = new Map<string, thread>();

// # Functions
function formatString(text: string) {
  return text.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
}

function requestChannelName() {
  const thread = coroutine.running();
  const threadId = RandomString(10);

  startDirectMessage("c-GetChannel");
  writeBufferString(threadId);
  finishDirectMessage();

  yieldingThreads.set(threadId, thread);
  return tostring(coroutine.yield()[0]);
}

export function sendMessage(message: string) {
  const channelName = requestChannelName();
  const channelInstance = channelsFolder.FindFirstChild(channelName);
  if (!channelInstance || !channelInstance.IsA("TextChannel")) return;

  const sentMessage = channelInstance.SendAsync(formatString(message));
}

// # Bindings & misc
ServerInstance.serverCreated.Connect(inst => {
  const registeredPlayers = new Map<number, TextSource>();

  const channel = new Instance("TextChannel");
  channel.Name = inst.id;
  channel.Parent = channelsFolder;

  inst.playerJoined.Connect(user => {
    const source = channel.AddUserAsync(user.UserId) as unknown as TextSource | undefined;
    if (!source) return;

    registeredPlayers.set(user.UserId, source);
  });

  inst.playerLeft.Connect(user => {
    registeredPlayers.get(user.UserId)?.Destroy();
    registeredPlayers.delete(user.UserId);
  });
});

if (RunService.IsServer())
  listenDirectMessage("c-GetChannel", (sender, bfr) => {
    if (!sender) return;

    const reader = BufferReader(bfr);
    const replyId = reader.string();

    const serverInstance = ServerInstance.GetServersFromPlayer(sender)[0];
    if (!serverInstance) return;

    startDirectMessage("c-GetChannel_reply", sender);
    writeBufferString(replyId);
    writeBufferString(serverInstance.id);
    finishDirectMessage();
  });

if (RunService.IsClient())
  listenDirectMessage("c-GetChannel_reply", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const replyId = reader.string();
    const channelName = reader.string();

    const targetThread = yieldingThreads.get(replyId);
    if (!targetThread) return;

    coroutine.resume(targetThread, channelName);
    yieldingThreads.delete(replyId);
  });

if (RunService.IsClient()) {
  UserInputService.InputBegan.Connect(() => {
    inputBarConfig.Enabled = UserInputService.PreferredInput === Enum.PreferredInput.Touch;
  });
}