import { t } from "@rbxts/t";

// # Constants
enum BYTE_TYPE {
  U8,
  I8,
  U16,
  I16,
  U32,
  I32,
  F32,
  F64,
  BOOL,
  STRING,
  VECTOR,
}

const bufferReadingStructure = {
  [BYTE_TYPE["U8"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu8(b, offset);

    setOffset(offset + 8);
    return data;
  },
  [BYTE_TYPE["I8"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readi8(b, offset);

    setOffset(offset + 8);
    return data;
  },
  [BYTE_TYPE["U16"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu16(b, offset);

    setOffset(offset + 16);
    return data;
  },
  [BYTE_TYPE["I16"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readi16(b, offset);

    setOffset(offset + 16);
    return data;
  },
  [BYTE_TYPE["U32"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu32(b, offset);

    setOffset(offset + 32);
    return data;
  },
  [BYTE_TYPE["I32"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readi32(b, offset);

    setOffset(offset + 32);
    return data;
  },
  [BYTE_TYPE["F32"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readf32(b, offset);

    setOffset(offset + 32);
    return data;
  },
  [BYTE_TYPE["F64"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readf64(b, offset);

    setOffset(offset + 64);
    return data;
  },
  [BYTE_TYPE["BOOL"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu8(b, offset) === 255;

    setOffset(offset + 8);
    return data;
  },
  [BYTE_TYPE["STRING"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const size = buffer.readi16(b, offset);
    offset += 16;

    const data = buffer.readstring(b, offset, size);

    setOffset(offset + size);
    return data;
  },
  [BYTE_TYPE["VECTOR"]]: (b: buffer, offset: number, setOffset: Callback) => {
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
    U8: () => bufferReadingStructure[BYTE_TYPE.U8](bfr, currentOffset, setOffset),
    I8: () => bufferReadingStructure[BYTE_TYPE.I8](bfr, currentOffset, setOffset),
    U16: () => bufferReadingStructure[BYTE_TYPE.U16](bfr, currentOffset, setOffset),
    I16: () => bufferReadingStructure[BYTE_TYPE.I16](bfr, currentOffset, setOffset),
    U32: () => bufferReadingStructure[BYTE_TYPE.U32](bfr, currentOffset, setOffset),
    I32: () => bufferReadingStructure[BYTE_TYPE.I32](bfr, currentOffset, setOffset),
    F32: () => bufferReadingStructure[BYTE_TYPE.F32](bfr, currentOffset, setOffset),
    F64: () => bufferReadingStructure[BYTE_TYPE.F64](bfr, currentOffset, setOffset),
    BOOL: () => bufferReadingStructure[BYTE_TYPE.BOOL](bfr, currentOffset, setOffset),
    STRING: () => bufferReadingStructure[BYTE_TYPE.STRING](bfr, currentOffset, setOffset),
    VECTOR: () => bufferReadingStructure[BYTE_TYPE.VECTOR](bfr, currentOffset, setOffset),
  };

  return stContent;
}
