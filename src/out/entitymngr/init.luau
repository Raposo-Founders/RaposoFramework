local signal = require("./util/signal")
local world = require("./worldinst")

local BaseEntity = require("@self/baseEntity")

export type EntityManagerModule = {
	EntityManager: EntityManagerConstructor,
}

export type EntityManager = {
	entities: { [string]: BaseEntity.BaseEntity },
	entityCreated: signal.Signal<{ entity: BaseEntity.BaseEntity }>,
	entityDeleting: signal.Signal<{ entity: BaseEntity.BaseEntity }>,

	isServer: boolean,
	isPlayback: boolean,

	createEntity: (self: EntityManager, classname: string, entityId: string | nil, ...unknown) -> unknown, -- TODO: Fix this with a Promise
	killThisFucker: (self: EntityManager, entity: BaseEntity.BaseEntity) -> nil,
	isEntityOnMemoryOrImSchizo: (self: EntityManager, entity: BaseEntity.BaseEntity) -> nil,
	getEntitiesThatIsA: (self: EntityManager, classname: string) -> { BaseEntity.BaseEntity },
	getEntitiesOfClass: (self: EntityManager, classname: string) -> { BaseEntity.BaseEntity },
	getEntitiesFromInstance: (self: EntityManager, inst: Instance) -> { BaseEntity.BaseEntity },
	murderAllFuckers: (self: EntityManager) -> nil,
}

export type EntityManagerConstructor = {
	new: (world: world.WorldInstance) -> EntityManager,
}

return nil
