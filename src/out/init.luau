local sessions = require("@self/session")
local network = require("@self/network")
local world = require("@self/worldinst")
local lifecycle = require("@self/lifecycle")
local entity = require("@self/entitymngr")
local server = require("@self/session")
local buffers = require("@self/util/buffer")

type RaposoGlobal = {
	Systems: {}, -- TODO
	Controllers: {}, -- TODO
	Environment: {
		Folders: {
			cacheFolder: Folder,
			mapStorageFolder: Folder,
			modulesFolder: Folder,
			modelsFolder: Folder,
			soundsFolder: Folder,
			uiFolder: Folder,
			animFolder: Folder,
			vendorFolder: Folder,
		},
		Sessions: sessions.ServerInstanceConstructor,
		Network: network.NetworkModule,
		defaultEnvironments: defaultEnvironments,
		util: {
			BufferReader: buffers.BufferReader,
			BufferWriter: buffers.BufferWriter,
		},
	},
}

type defaultEnvironments = {
	world: world.WorldInstance,
	network: network.NetworkClass,
	lifecycle: lifecycle.LifecycleClass,
	entity: entity.EntityManager,

	server: server.ServerInstance | nil,
}

return _G.Raposo :: RaposoGlobal
