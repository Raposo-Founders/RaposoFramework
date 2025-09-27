local signalType = require("./util/signal")
local world = require("./worldinst")
local network = require("./network")
local entity = require("./entitymngr")
local lifecycle = require("./lifecycle")

export type ServerInstance = {
	trackingPlayers: { [Player]: boolean },
	playerJoined: signalType.Signal<{ user: Player, referenceId: string }>,
	playerLeft: signalType.Signal<{ user: Player, referenceId: string }>,

	id: string,
	world: world.WorldInstance,
	network: network.NetworkClass,
	entity: entity.EntityManager,
	lifecycle: lifecycle.LifecycleClass,

	channel: TextChannel,

	Close: (self: ServerInstance) -> nil,
	BindToClose: (self: ServerInstance) -> nil,

	InsertPlayer: (self: ServerInstance, player: Player) -> nil,
	RemovePlayer: (self: ServerInstance, player: Player, reason: string?) -> nil,
}

export type ServerInstanceConstructor = {
	GetServersFromPlayer: (user: Player) -> { ServerInstance },
	new: (
		id: string,
		world: world.WorldInstance,
		network: network.NetworkClass,
		entity: entity.EntityManager,
		lifecycle: lifecycle.LifecycleClass
	) -> ServerInstance,
}

return nil
