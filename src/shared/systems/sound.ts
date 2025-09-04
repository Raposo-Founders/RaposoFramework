import * as Services from "@rbxts/services";
import { ReplicatedInstance } from "../util/utilfuncs";

// # Types
interface AudioEffectPath {
  wire: Wire;
  effect: Instance;
}

// # Constants
const DEFAULT_OUTPUT = ReplicatedInstance(Services.SoundService, "MainOutput", "AudioDeviceOutput");
const MAP_SOUND_GROUPS = new Map<string, AudioFader>();

const CREATED_SOUNDS_MAP = new Map<string, CSoundInstance>();

// # Classes
export class CSoundInstance {
  player = new Instance("AudioPlayer");

  protected _instances = new Array<Instance>();
  protected _target_output: AudioFader | AudioDeviceOutput | AudioEmitter = DEFAULT_OUTPUT;
  protected _latest_wire = new Instance("Wire");

  constructor(readonly name: string, readonly soundid: string) {
    this.player.Asset = soundid;
    this.player.Parent = Services.ReplicatedStorage;
    this.player.AutoLoad = true;

    this._latest_wire.Parent = this.player;
    this._latest_wire.SourceInstance = this.player;
    this._latest_wire.TargetInstance = this._target_output;

    this._instances.push(this.player, this._latest_wire);
    CREATED_SOUNDS_MAP.set(name, this);
  }

  SetLoop(looped = true, region?: NumberRange) {
    this.player.Looping = true;
  }

  async Play(fromBeggining = true) {
    if (fromBeggining)
      this.player.TimePosition = 0;

    this.player.Play();
    this.player.Ended.Wait();
  }

  Stop() {
    this.player.Stop();
  }

  Dispose() {
    for (const inst of this._instances) {
      inst.Destroy();
    }
    this._instances.clear();

    CREATED_SOUNDS_MAP.delete(this.name);
    table.clear(this);
  }

  AddEffect<K extends keyof CreatableInstances, T extends CreatableInstances[K], V extends WritableInstanceProperties<T>>(name: K, config: Partial<V>) {
    const inst = new Instance(name) as T;
    inst.Parent = this.player;

    // What the bloody fuck is this?
    for (const [name, value] of config as unknown as Map<keyof T, unknown>) {
      (inst[name] as unknown) = value;
    }

    const wire = new Instance("Wire");
    wire.Parent = inst;
    wire.SourceInstance = inst;
    // wire.TargetInstance = this._target_output; // will be set by another function

    this._latest_wire.TargetInstance = inst;
    this._latest_wire = wire;

    this._instances.push(inst, wire);

    this._UpdateLatestDevicePath();
  }

  SetOutput(output: typeof this._target_output) {
    this._target_output = output;

    this._UpdateLatestDevicePath();
  }

  protected _UpdateLatestDevicePath() {
    this._latest_wire.TargetInstance = this._target_output;
  }
}

export class CWorldSoundInstance extends CSoundInstance {
  protected _attachment = new Instance("Attachment");

  constructor(name: string, soundid: string) {
    super(name, soundid);

    this._attachment.Parent = workspace.Terrain;
    this._attachment.Name = `world_sound_${name}`;

    const emitter = new Instance("AudioEmitter");
    emitter.Parent = this._attachment;

    this._latest_wire.TargetInstance = emitter;
    this._instances.push(emitter);
  }

  SetPosition(pos: Vector3) {
    this._attachment.Position = pos;
  }

  SetParent(parent: BasePart) {
    this._attachment.Parent = parent;
  }
}

// # Namespace
export function CreateSoundGroup(name: string) {
  assert(!MAP_SOUND_GROUPS.has(name), `SoundGroup ${name} already exists.`);

  const fader = new Instance("AudioFader");
  fader.Parent = Services.SoundService;
  fader.Name = "group_" + name;

  const wire = new Instance("Wire");
  wire.Parent = fader;
  wire.SourceInstance = fader;
  wire.TargetInstance = DEFAULT_OUTPUT;

  MAP_SOUND_GROUPS.set(name, fader);
}

export function GetSoundFromName(name: string) {
  return CREATED_SOUNDS_MAP.get(name);
}

export function AddListenerToWorldObject(inst: BasePart | Camera, soundgroup: string) {
  const fader = MAP_SOUND_GROUPS.get(soundgroup);
  assert(fader, `SoundGroup ${soundgroup} does not exist.`);

  const listener = new Instance("AudioListener");
  listener.Parent = inst;

  const wire = new Instance("Wire");
  wire.Parent = listener;
  wire.SourceInstance = listener;
  wire.TargetInstance = fader;
}
