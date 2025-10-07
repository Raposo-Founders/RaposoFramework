import { Players, RunService } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import { PlayerTeam } from "entities/PlayerEntity";
import ServerInstance from "serverinst";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_addbot";

// # Functions

// # Bindings & misc
new ConsoleFunctionCallback(["addbot"], [{ name: "name", type: "string" }])
  .setCallback(ctx => {
    const entityName = ctx.getArgument("name", "string");

    startBufferCreation();
    writeBufferString(entityName.value);
    defaultEnvironments.network.sendPacket(CMD_INDEX_NAME);
  });

ServerInstance.serverCreated.Connect(inst => {
  
  inst.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !RunService.IsStudio()) return;

    const reader = BufferReader(info.content);
    const entityName = reader.string();

    const sessionList = ServerInstance.GetServersFromPlayer(info.sender);

    for (const session of sessionList)
      session.entity.createEntity("SwordPlayerEntity", `bot_${entityName}`, "", info.sender.UserId)
        .andThen(ent => {
          ent.team = PlayerTeam.Raiders;

          ent.spawned.Connect(() => {
            ent.health = 1000;
            ent.maxHealth = 1000;
          });

          ent.died.Connect(() => {
            task.wait(Players.RespawnTime);
            ent.Spawn();
          });

          ent.Spawn();
        });
  });
});