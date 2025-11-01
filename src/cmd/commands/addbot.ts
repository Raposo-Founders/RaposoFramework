import { Players, RunService } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import { defaultEnvironments } from "defaultinsts";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import SessionInstance from "providers/SessionProvider";
import ChatSystem from "systems/ChatSystem";
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

SessionInstance.sessionCreated.Connect(inst => {
  
  inst.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !RunService.IsStudio()) return;

    const reader = BufferReader(info.content);
    const entityName = reader.string();

    const sessionList = SessionInstance.GetServersFromPlayer(info.sender);

    for (const session of sessionList) {
      let callerEntity: PlayerEntity | undefined;
      for (const ent of inst.entity.getEntitiesThatIsA("PlayerEntity")) {
        if (ent.GetUserFromController() !== info.sender) continue;
        callerEntity = ent;
        break;
      }
      if (!callerEntity) continue;

      session.entity.createEntity("SwordPlayerEntity", `bot_${entityName}`, "", info.sender.UserId)
        .andThen(ent => {
          ent.team = PlayerTeam.Raiders;
          ent.networkOwner = tostring(info.sender!.GetAttribute(gameValues.usersessionid));

          let currentThread: thread | undefined;

          ent.spawned.Connect(() => {
            if (currentThread)
              task.cancel(currentThread);

            ent.Equip();

            currentThread = task.spawn(() => {
              while (ent.health > 0) {
                ent.Attack1();
                inst.lifecycle.YieldForTicks(1);
              }
            });
          });

          ent.died.Connect(() => {
            if (currentThread)
              task.cancel(currentThread);
            currentThread = undefined;

            task.wait(Players.RespawnTime);
            ent.Spawn();
          });

          ent.Spawn();

          ChatSystem.sendSystemMessage(`Spawned bot ${ent.id}.`);
        });
    }
  });
});