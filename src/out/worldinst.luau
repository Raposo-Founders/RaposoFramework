local signalType = require("./util/signal")

export type WorldInstance = {
	id: string,
	rootInstance: Folder,

	parts: Instance,
	objects: Instance,

	mapChanged: signalType.Signal<{ name: string, inst: Instance }>,

	loadMap: (self: WorldInstance, name: string) -> nil,
}

export type WorldInstanceConstructor = {
	new: (currentMap: string) -> WorldInstance,
}

return nil
