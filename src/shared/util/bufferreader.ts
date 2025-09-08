// # Constants
enum ByteType {
  u8,
  i8,
  u16,
  i16,
  u32,
  i32,
  f32,
  f64,
  bool,
  str,
  vec,
}

const bufferReadingStructure = {
  [ByteType["u8"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu8(b, offset);

    setOffset(offset + 8);
    return data;
  },
  [ByteType["i8"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readi8(b, offset);

    setOffset(offset + 8);
    return data;
  },
  [ByteType["u16"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu16(b, offset);

    setOffset(offset + 16);
    return data;
  },
  [ByteType["i16"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readi16(b, offset);

    setOffset(offset + 16);
    return data;
  },
  [ByteType["u32"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu32(b, offset);

    setOffset(offset + 32);
    return data;
  },
  [ByteType["i32"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readi32(b, offset);

    setOffset(offset + 32);
    return data;
  },
  [ByteType["f32"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readf32(b, offset);

    setOffset(offset + 32);
    return data;
  },
  [ByteType["f64"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readf64(b, offset);

    setOffset(offset + 64);
    return data;
  },
  [ByteType["bool"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu8(b, offset) === 255;

    setOffset(offset + 8);
    return data;
  },
  [ByteType["str"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const size = buffer.readi16(b, offset);
    offset += 16;

    const data = buffer.readstring(b, offset, size);

    setOffset(offset + size);
    return data;
  },
  [ByteType["vec"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const x = buffer.readf32(b, offset);
    offset += 32;
    const y = buffer.readf32(b, offset);
    offset += 32;
    const z = buffer.readf32(b, offset);
    offset += 32;

    const data = vector.create(x, y, z);

    setOffset(offset);
    return data;
  },
};

// # Functions
export function BufferReader(bfr: buffer) {
  let currentOffset = 0;
  const setOffset = (newOffset: number) => currentOffset = newOffset;

  const stContent = {
    u8: () => bufferReadingStructure[ByteType.u8](bfr, currentOffset, setOffset),
    i8: () => bufferReadingStructure[ByteType.i8](bfr, currentOffset, setOffset),
    u16: () => bufferReadingStructure[ByteType.u16](bfr, currentOffset, setOffset),
    i16: () => bufferReadingStructure[ByteType.i16](bfr, currentOffset, setOffset),
    u32: () => bufferReadingStructure[ByteType.u32](bfr, currentOffset, setOffset),
    i32: () => bufferReadingStructure[ByteType.i32](bfr, currentOffset, setOffset),
    f32: () => bufferReadingStructure[ByteType.f32](bfr, currentOffset, setOffset),
    f64: () => bufferReadingStructure[ByteType.f64](bfr, currentOffset, setOffset),
    bool: () => bufferReadingStructure[ByteType.bool](bfr, currentOffset, setOffset),
    string: () => bufferReadingStructure[ByteType.str](bfr, currentOffset, setOffset),
    vec: () => bufferReadingStructure[ByteType.vec](bfr, currentOffset, setOffset),
  };

  return stContent;
}
