import { t } from "@rbxts/t";
import { RandomString } from "./utilfuncs";

// # Types
interface IBufferCreator {
  currentSize: number;
}

interface IBufferEntryInfo {
  type: BUFFER_TYPE;
  value: unknown;
}

// # Constants
enum BUFFER_TYPE {
  U8,
  I8,
  U16,
  I16,
  U32,
  I32,
  F32,
  F64,
  STRING,
  BOOL,
  VECTOR,
}

const DEFAULT_STRING_SIZE = 16;

const bufferCreationThreads = new Map<thread, IBufferEntryInfo[]>();

// # Functions
export function StartBufferCreation() {
  const thread = coroutine.running();
  bufferCreationThreads.set(thread, []);
}

export function WriteBufferU8(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.U8,
    value: value,
  });
}

export function WriteBufferI8(bufferInfo: IBufferCreator, value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.I8,
    value: value,
  });

  bufferInfo.currentSize += 8;
}

export function WriteBufferU16(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.U16,
    value: value,
  });
}

export function WriteBufferI16(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.I16,
    value: value,
  });
}

export function WriteBufferU32(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.U32,
    value: value,
  });
}

export function WriteBufferI32(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.I32,
    value: value,
  });
}

export function WriteBufferF32(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.F32,
    value: value,
  });
}

export function WriteBufferF64(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.F64,
    value: value,
  });
}

export function WriteBufferString(value: string) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.STRING,
    value: value,
  });
}

export function WriteBufferBool(value: boolean) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.BOOL,
    value: value,
  });
}

export function WriteBufferVector(value1: number, value2: number, value3: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BUFFER_TYPE.VECTOR,
    value: vector.create(value1, value2, value3),
  })
}

export function FinalizeBufferCreation() {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  let currentSize = 0;
  let currentOffset = 0;

  for (const element of bufferQueue) {
    switch (element.type) {
      case BUFFER_TYPE.U8:
        currentSize += 8;
        break;
      case BUFFER_TYPE.I8:
        currentSize += 8;
        break;
      case BUFFER_TYPE.U16:
        currentSize += 16;
        break;
      case BUFFER_TYPE.I16:
        currentSize += 16;
        break;
      case BUFFER_TYPE.U32:
        currentSize += 32;
        break;
      case BUFFER_TYPE.I32:
        currentSize += 32;
        break;
      case BUFFER_TYPE.F32:
        currentSize += 32;
        break;
      case BUFFER_TYPE.F64:
        currentSize += 64;
        break;
      case BUFFER_TYPE.STRING: {
        const stringSize = tostring(element.value).size();
        currentSize += stringSize + DEFAULT_STRING_SIZE;
        break;
      }
      case BUFFER_TYPE.BOOL:
        currentSize += 8;
        break;
      case BUFFER_TYPE.VECTOR:
        currentSize += 32 * 3;
        break;
    }
  }

  const bfr = buffer.create(currentSize);

  for (const element of bufferQueue) {
    switch (element.type) {
      case BUFFER_TYPE.U8:
        buffer.writeu8(bfr, currentOffset, element.value as number);
        currentOffset += 8;
        break;
      case BUFFER_TYPE.I8:
        buffer.writei8(bfr, currentOffset, element.value as number);
        currentOffset += 8;
        break;
      case BUFFER_TYPE.U16:
        buffer.writeu16(bfr, currentOffset, element.value as number);
        currentOffset += 16;
        break;
      case BUFFER_TYPE.I16:
        buffer.writei16(bfr, currentOffset, element.value as number);
        currentOffset += 16;
        break;
      case BUFFER_TYPE.U32:
        buffer.writeu32(bfr, currentOffset, element.value as number);
        currentOffset += 32;
        break;
      case BUFFER_TYPE.I32:
        buffer.writei32(bfr, currentOffset, element.value as number);
        currentOffset += 32;
        break;
      case BUFFER_TYPE.F32:
        buffer.writef32(bfr, currentOffset, element.value as number);
        currentOffset += 32;
        break;
      case BUFFER_TYPE.F64:
        buffer.writef64(bfr, currentOffset, element.value as number);
        currentOffset += 64;
        break;
      case BUFFER_TYPE.STRING: {
        const stringValue = tostring(element.value);
        const stringSize = stringValue.size();

        buffer.writeu16(bfr, currentOffset, stringSize);
        currentOffset += DEFAULT_STRING_SIZE;

        buffer.writestring(bfr, currentOffset, stringValue);
        currentOffset += stringSize;
        break;
      }
      case BUFFER_TYPE.BOOL:
        buffer.writeu8(bfr, currentOffset, element.value === true ? 255 : 0);
        currentOffset += 8;
        break;
      case BUFFER_TYPE.VECTOR:
        const x = (element.value as vector).x;
        const y = (element.value as vector).y;
        const z = (element.value as vector).z;
        const addOffset = 32;

        buffer.writef32(bfr, currentOffset, x);
        buffer.writef32(bfr, currentOffset + addOffset, y);
        buffer.writef32(bfr, currentOffset + (addOffset * 2), z);

        currentOffset += (addOffset * 3);
        break;
    }
  }

  bufferQueue.clear();
  bufferCreationThreads.delete(thread);
  return bfr;
}
