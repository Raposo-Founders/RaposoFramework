export type BufferReader = (
	bfr: buffer
) -> {
	u8: () -> number,
	i8: () -> number,
	u16: () -> number,
	i16: () -> number,
	u32: () -> number,
	i32: () -> number,
	f32: () -> number,
	u64: () -> number,
	f64: () -> number,
	bool: () -> boolean,
	string: () -> string,
	vec: () -> vector,
}

export type BufferWriter = {
	startBufferCreation: () -> nil,
	writeBufferU8: (value: number) -> nil,
	writeBufferI8: (value: number) -> nil,
	writeBufferU16: (value: number) -> nil,
	writeBufferI16: (value: number) -> nil,
	writeBufferU32: (value: number) -> nil,
	writeBufferI32: (value: number) -> nil,
	writeBufferF32: (value: number) -> nil,
	writeBufferU64: (value: number) -> nil,
	writeBufferF64: (value: number) -> nil,
	writeBufferString: (value: string) -> nil,
	writeBufferBool: (value: boolean) -> nil,
	writeBufferVector: (value1: number, value2: number, value3: number) -> nil,
	finalizeBufferCreation: () -> buffer,
}

return nil
