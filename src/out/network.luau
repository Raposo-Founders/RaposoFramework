local signal = require("./util/signal")

type PacketInfo = {
	id: string,
	sender: Player?,
	timestamp: number,
	content: buffer,
}

export type NetworkModule = {
	startDirectMessage: (id: string, user: Player | nil, unreliable: boolean?) -> nil,
	finishDirectMessage: () -> nil,
	listenDirectMessage: (id: string, callback: (sender: Player | nil, bfr: buffer) -> any) -> nil,

	NetworkManager: NetworkClassConstructor,
}

export type NetworkClass = {
	networkOutgoing: signal.Signal<{ id: string, bfr: buffer }>,
	postToRemote: boolean,

	signedUsers: { [Player]: boolean },

	insertNetwork: (self: NetworkClass, sender: Player | nil, id: string, bfr: buffer) -> nil,
	processQueuedPackets: (self: NetworkClass) -> nil,
	startWritingMessage: (
		self: NetworkClass,
		id: string,
		players: { Player }?,
		ignore: { Player }?,
		unreliable: boolean?
	) -> nil,
	finishWritingMessage: (self: NetworkClass) -> nil,

	listenPacket: (self: NetworkClass, id: string, callback: (sender: Player | nil, info: PacketInfo) -> any) -> nil,

	Destroy: (self: NetworkClass) -> nil,
}

export type NetworkClassConstructor = {
	new: () -> NetworkClass,
}

return nil
