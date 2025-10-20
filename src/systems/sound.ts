import * as Services from "@rbxts/services";
import { ReplicatedInstance } from "../util/utilfuncs";

// # Types
interface AudioEffectPath {
  wire: Wire;
  effect: Instance;
}

// # Constants
const defaultSoundOutput = ReplicatedInstance(Services.SoundService, "MainOutput", "AudioDeviceOutput");
const mappedSoundGroups = new Map<string, AudioFader>();

const createdSounds = new Map<string, CSoundInstance>();

// # Classes
export class CSoundInstance {
  player = new Instance("AudioPlayer");

  protected instances = new Array<Instance>();
  protected targetOutput: AudioFader | AudioDeviceOutput | AudioEmitter = defaultSoundOutput;
  protected latestWire = new Instance("Wire");

  constructor(readonly name: string, readonly soundid: string) {
    this.player.Asset = soundid;
    this.player.Parent = Services.ReplicatedStorage;
    this.player.AutoLoad = true;

    this.latestWire.Parent = this.player;
    this.latestWire.SourceInstance = this.player;
    this.latestWire.TargetInstance = this.targetOutput;

    this.instances.push(this.player, this.latestWire);
    createdSounds.set(name, this);
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
    for (const inst of this.instances) {
      inst.Destroy();
    }
    this.instances.clear();

    createdSounds.delete(this.name);
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

    this.latestWire.TargetInstance = inst;
    this.latestWire = wire;

    this.instances.push(inst, wire);

    this._UpdateLatestDevicePath();
  }

  SetOutput(output: typeof this.targetOutput) {
    this.targetOutput = output;

    this._UpdateLatestDevicePath();
  }

  protected _UpdateLatestDevicePath() {
    this.latestWire.TargetInstance = this.targetOutput;
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

    this.latestWire.TargetInstance = emitter;
    this.instances.push(emitter, this._attachment);
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
  assert(!mappedSoundGroups.has(name), `SoundGroup ${name} already exists.`);

  const fader = new Instance("AudioFader");
  fader.Parent = Services.SoundService;
  fader.Name = "group_" + name;

  const wire = new Instance("Wire");
  wire.Parent = fader;
  wire.SourceInstance = fader;
  wire.TargetInstance = defaultSoundOutput;

  mappedSoundGroups.set(name, fader);
}

export function GetSoundFromName(name: string) {
  return createdSounds.get(name);
}

export function AddListenerToWorldObject(inst: BasePart | Camera, soundgroup: string) {
  const fader = mappedSoundGroups.get(soundgroup);
  assert(fader, `SoundGroup ${soundgroup} does not exist.`);

  const listener = new Instance("AudioListener");
  listener.Parent = inst;

  const wire = new Instance("Wire");
  wire.Parent = listener;
  wire.SourceInstance = listener;
  wire.TargetInstance = fader;
}
