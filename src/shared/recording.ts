import { EntityManager } from "./entities";
import { LifecycleInstance } from "./lifecycle";
import { registerConsoleFunction } from "./cmd/cvar";
import { clientSharedEnv } from "./clientshared";
import { ExecuteCommand } from "./cmd";
import { UserInputService } from "@rbxts/services";
import { finalizeBufferCreation, startBufferCreation } from "./util/bufferwriter";

// # Types
interface I_EntitySnapshotContent {
  classname: keyof GameEntities,
  id: EntityId;
  content: buffer;
}

interface I_SnapshotInfo {
  time: number;
  content: I_EntitySnapshotContent[];
}

// # Constants & variables
const savedReplays = new Map<string, I_SnapshotInfo[]>();

let stopRecordingConnection: Callback | undefined;

// # Functions
function RecordEnvironment(entityEnvironment: EntityManager, lifecycleEnvironment: LifecycleInstance) {
  const snapshots = new Array<I_SnapshotInfo>();
  const startingTime = time();

  const unbindConnection = lifecycleEnvironment.BindTickrate((_, dt) => {
    const entitiesSaveData = new Array<I_EntitySnapshotContent>();
    const currentRecordingTime = time() - startingTime;

    for (const [, ent] of entityEnvironment.entities) {
      startBufferCreation();
      ent.WriteStateBuffer();

      entitiesSaveData.push({
        id: ent.id,
        classname: ent.classname,
        content: finalizeBufferCreation(),
      });
    }

    snapshots.push({
      time: currentRecordingTime,
      content: entitiesSaveData,
    });

    print("Recording time:", currentRecordingTime);
  });

  return () => {
    unbindConnection();

    // TODO: Serialize?

    return snapshots;
  };
}

// # Class
export class CReplayPlayer {
  playing = false;
  speed = 1;
  time = 0;

  readonly total_replay_time: number;

  private _entitiesOnCreationQueue = new Set<string>();

  constructor(private _environment: EntityManager, private _lifecycle: LifecycleInstance, private _replayData: I_SnapshotInfo[]) {
    _replayData.sort((a, b) => {
      return a.time < b.time;
    });

    this.total_replay_time = _replayData[_replayData.size() - 1].time;
    _lifecycle.BindUpdate((_, dt) => this._Update(dt));
  }

  private _UpdateWithAlpha(dt: number) {
    const snapshotsInfo = this.GetSnapshotsAlpha();

    if (snapshotsInfo)
      for (const entityData of snapshotsInfo.currSnapshot.content) {
        const targetEntity = this.GetEntity(entityData.id, entityData.classname);
        if (!targetEntity) continue;

        // Get the next snapshot from the same entity
        let nextEntitySnapshot: I_EntitySnapshotContent | undefined;

        for (const futureEntityData of snapshotsInfo.nextSnapshot.content) {
          if (futureEntityData.id !== entityData.id) continue;
          nextEntitySnapshot = futureEntityData;
          break;
        }

        if (!nextEntitySnapshot) warn(`Entity ${entityData.id} has no future data!`);
        // if (nextEntitySnapshot)
        // targetEntity.ApplyStateBuffer(entityData.content, nextEntitySnapshot.content, snapshotsInfo.alpha);
      }

    // Update time
    if (this.playing)
      this.time += dt * this.speed;

    if (this.time > this.total_replay_time || this.time < 0) {
      this.time = math.clamp(this.time, 0, this.total_replay_time);
      this.playing = false;
    }
  }

  private _Update(dt: number) {
    const currentSnapshot = this.GetCurrentSnapshot();

    if (currentSnapshot)
      for (const entityData of currentSnapshot.content) {
        const targetEntity = this.GetEntity(entityData.id, entityData.classname);
        if (!targetEntity) continue;

        targetEntity.ApplyStateBuffer(entityData.content);
      }

    // Update time
    if (this.playing)
      this.time += dt * this.speed;

    if (this.time > this.total_replay_time || this.time < 0) {
      this.time = math.clamp(this.time, 0, this.total_replay_time);
      this.playing = false;
    }
  }

  GetSnapshotsAlpha() {
    let currSnapshot: I_SnapshotInfo | undefined;
    let nextSnapshot: I_SnapshotInfo | undefined;

    // Get snapshots
    for (let i = 0; i < this._replayData.size(); i++) {
      const snapshot = this._replayData[i];
      if (!snapshot || snapshot.time > this.time) break;

      currSnapshot = snapshot;
      nextSnapshot = this._replayData[i + 1];
    }

    if (!currSnapshot || !nextSnapshot)
      return;

    // get alpha
    const passedTime = this.time - currSnapshot.time;
    const totalTime = nextSnapshot.time - currSnapshot.time;
    const alpha = passedTime / totalTime;

    return {
      currSnapshot,
      nextSnapshot,
      alpha,
    };
  }

  GetCurrentSnapshot() {
    let currSnapshot: I_SnapshotInfo | undefined;

    // Get snapshots
    for (let i = 0; i < this._replayData.size(); i++) {
      const snapshot = this._replayData[i];
      if (!snapshot || snapshot.time > this.time) break;

      currSnapshot = snapshot;
    }

    return currSnapshot;
  }

  GetEntity(entityId: string, classname: keyof GameEntities) {
    if (this._entitiesOnCreationQueue.has(entityId)) return;

    const entity = this._environment.entities.get(entityId);
    if (entity && entity.classname !== classname) return; // How the fuck?
    if (entity) return entity;

    this._entitiesOnCreationQueue.add(entityId);

    this._environment.createEntity(classname, entityId) // This might be a bug... too bad!
      .finally(() => this._entitiesOnCreationQueue.delete(entityId));
  }
}

// # Bindings & misc
registerConsoleFunction(["record"], { name: "name" })((ctx, name) => {
  const stopRecordingCallback = RecordEnvironment(clientSharedEnv.entityEnvironment, clientSharedEnv.lifecycle);

  ctx.Reply(`Recording replay ${name}...`);

  stopRecordingConnection = () => {
    stopRecordingConnection = undefined;
    const replay = stopRecordingCallback();

    savedReplays.set(tostring(name), replay);
    ctx.Reply(`Stopped recording ${name}. ${replay.size()} total frames.`);
  };
});

registerConsoleFunction(["stop"])(() => stopRecordingConnection?.());

registerConsoleFunction(["playdemo"], { name: "name" })((ctx, name) => {
  ExecuteCommand("disconnect").expect(); // Ugly ass hack.

  const targetSnapshots = savedReplays.get(tostring(name));
  if (!targetSnapshots) {
    ctx.Error(`Unknown replay ${name}.`);
    return;
  }

  clientSharedEnv.lifecycle.YieldForTicks(20);
  clientSharedEnv.entityEnvironment.isPlayback = true;

  const player = new CReplayPlayer(clientSharedEnv.entityEnvironment, clientSharedEnv.lifecycle, targetSnapshots);

  UserInputService.InputBegan.Connect((input, busy) => {
    if (busy) return;

    if (input.KeyCode.Name === "KeypadEight") {
      player.playing = !player.playing;
      print("Playing:", player.playing);
    }

    if (input.KeyCode.Name === "KeypadSeven") {
      player.speed -= 0.25;
      print("Replay speed:", player.speed);
    }

    if (input.KeyCode.Name === "KeypadNine") {
      player.speed += 0.25;
      print("Replay speed:", player.speed);
    }
  });
});

