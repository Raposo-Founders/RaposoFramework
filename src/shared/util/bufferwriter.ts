
// # Types
interface IBufferCreator {
  currentSize: number;
}

interface IBufferEntryInfo {
  type: BufferType;
  value: unknown;
}

// # Constants
enum BufferType {
  u8,
  i8,
  u16,
  i16,
  u32,
  i32,
  f32,
  f64,
  str,
  bool,
  vec,
}

const defaultStringSize = 16;
const bufferCreationThreads = new Map<thread, IBufferEntryInfo[]>();

// # Functions
export function startBufferCreation() {
  const thread = coroutine.running();
  bufferCreationThreads.set(thread, []);
}

export function writeBufferU8(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.u8,
    value: value,
  });
}

export function writeBufferI8(bufferInfo: IBufferCreator, value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.i8,
    value: value,
  });

  bufferInfo.currentSize += 8;
}

export function writeBufferU16(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.u16,
    value: value,
  });
}

export function writeBufferI16(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.i16,
    value: value,
  });
}

export function writeBufferU32(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.u32,
    value: value,
  });
}

export function writeBufferI32(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.i32,
    value: value,
  });
}

export function writeBufferF32(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.f32,
    value: value,
  });
}

export function writeBufferF64(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.f64,
    value: value,
  });
}

export function writeBufferString(value: string) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.str,
    value: value,
  });
}

export function writeBufferBool(value: boolean) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.bool,
    value: value,
  });
}

export function writeBufferVector(value1: number, value2: number, value3: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferType.vec,
    value: vector.create(value1, value2, value3),
  });
}

export function finalizeBufferCreation() {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  let currentSize = 0;
  let currentOffset = 0;

  for (const element of bufferQueue) {
    switch (element.type) {
    case BufferType.u8:
      currentSize += 8;
      break;
    case BufferType.i8:
      currentSize += 8;
      break;
    case BufferType.u16:
      currentSize += 16;
      break;
    case BufferType.i16:
      currentSize += 16;
      break;
    case BufferType.u32:
      currentSize += 32;
      break;
    case BufferType.i32:
      currentSize += 32;
      break;
    case BufferType.f32:
      currentSize += 32;
      break;
    case BufferType.f64:
      currentSize += 64;
      break;
    case BufferType.str: {
      const stringSize = tostring(element.value).size();
      currentSize += stringSize + defaultStringSize;
      break;
    }
    case BufferType.bool:
      currentSize += 8;
      break;
    case BufferType.vec:
      currentSize += 32 * 3;
      break;
    }
  }

  const bfr = buffer.create(currentSize);

  for (const element of bufferQueue) {
    switch (element.type) {
    case BufferType.u8:
      buffer.writeu8(bfr, currentOffset, element.value as number);
      currentOffset += 8;
      break;
    case BufferType.i8:
      buffer.writei8(bfr, currentOffset, element.value as number);
      currentOffset += 8;
      break;
    case BufferType.u16:
      buffer.writeu16(bfr, currentOffset, element.value as number);
      currentOffset += 16;
      break;
    case BufferType.i16:
      buffer.writei16(bfr, currentOffset, element.value as number);
      currentOffset += 16;
      break;
    case BufferType.u32:
      buffer.writeu32(bfr, currentOffset, element.value as number);
      currentOffset += 32;
      break;
    case BufferType.i32:
      buffer.writei32(bfr, currentOffset, element.value as number);
      currentOffset += 32;
      break;
    case BufferType.f32:
      buffer.writef32(bfr, currentOffset, element.value as number);
      currentOffset += 32;
      break;
    case BufferType.f64:
      buffer.writef64(bfr, currentOffset, element.value as number);
      currentOffset += 64;
      break;
    case BufferType.str: {
      const stringValue = tostring(element.value);
      const stringSize = stringValue.size();

      buffer.writeu16(bfr, currentOffset, stringSize);
      currentOffset += defaultStringSize;

      buffer.writestring(bfr, currentOffset, stringValue);
      currentOffset += stringSize;
      break;
    }
    case BufferType.bool:
      buffer.writeu8(bfr, currentOffset, element.value === true ? 255 : 0);
      currentOffset += 8;
      break;
    case BufferType.vec: {
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
  }

  bufferQueue.clear();
  bufferCreationThreads.delete(thread);
  return bfr;
}
