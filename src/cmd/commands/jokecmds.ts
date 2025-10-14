import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import { gameValues } from "gamevalues";
import ServerInstance from "serverinst";
import { sendSystemChatMessage } from "systems/ChatSystem";
import { startBufferCreation, writeBufferString } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_joke";

// # Bindings & execution

ServerInstance.serverCreated.Connect(inst => {
  inst.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !info.sender.GetAttribute(gameValues.modattr)) return;

    sendSystemChatMessage(`Nice try ${info.sender.Name}, but this is not Kohl's admin.`);
  });
}); 

new ConsoleFunctionCallback(["fly", "ff", "forcefield", "invisible", "invis"], [])
  .setCallback((ctx) => {
    startBufferCreation();
    writeBufferString("joke");
    defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
  });