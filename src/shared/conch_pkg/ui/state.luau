local conch = require("../conch")
local vide = require("../roblox_packages/vide")

local source = vide.source

return {
	opened = source(false),
	focused = source(false),

	logs = source({} :: { conch.Log }),
}
