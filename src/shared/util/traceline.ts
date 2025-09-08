import { t } from "@rbxts/t";

declare global {
  interface TracelineResult {
    origin: Vector3;
    finish: Vector3;
    hit: Vector3;

    dist: number;
    dir: Vector3;
    normal: Vector3;

    inst: BasePart;
  }
}

export function validadeTraceline(data: TracelineResult | undefined): boolean {
  const blatantCheck = t.interface({
    origin: t.Vector3,
    finish: t.Vector3,
    hit: t.Vector3,

    dist: t.number,
    dir: t.Vector3,
    normal: t.Vector3,

    inst: t.instanceIsA("BasePart"),
  })(data);
  if (!blatantCheck) return false;

  return true;
}

export function traceline(
  root: WorldRoot,
  pos: Vector3,
  rot: Vector3,
  params: RaycastParams,
  distance = 10e8,
): TracelineResult | undefined {
  const raycast = root.Raycast(pos, rot.Unit.mul(distance), params);
  if (!raycast) return;

  return {
    origin: pos,
    finish: new CFrame(pos, pos.add(rot.Unit.mul(distance))).Position,
    hit: raycast.Position,

    dist: raycast.Distance,
    dir: rot.Unit,
    normal: raycast.Normal,

    inst: raycast.Instance,
  };
}

export function tracelineFixed(root: WorldRoot, start: Vector3, finish: Vector3, params: RaycastParams): TracelineResult | undefined {
  const raycast = root.Raycast(
    start,
    new CFrame(start, finish).LookVector.mul(start.sub(finish).Magnitude),
    params,
  );
  if (!raycast) return;

  return {
    origin: start,
    finish: finish,
    hit: raycast.Position,

    dist: raycast.Distance,
    dir: new CFrame(start, finish).LookVector,
    normal: raycast.Normal,

    inst: raycast.Instance,
  };
}

export function Traceblock(
  root: WorldRoot,
  start: Vector3,
  finish: Vector3,
  size: Vector3,
  params: RaycastParams,
): TracelineResult | undefined {
  const raycast = root.Blockcast(
    new CFrame(start, finish),
    size,
    new CFrame(start, finish).LookVector.mul(start.sub(finish).Magnitude),
    params,
  );
  if (!raycast) return;

  return {
    origin: start,
    finish: finish,
    hit: raycast.Position,

    dist: raycast.Distance,
    dir: new CFrame(start, finish).LookVector,
    normal: raycast.Normal,

    inst: raycast.Instance,
  };
}
