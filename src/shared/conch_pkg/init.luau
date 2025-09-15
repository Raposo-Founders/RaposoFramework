local conch = require("@self/conch")
local ui = require("@self/ui")

local main = setmetatable({
	ui = ui,
}, {
	__index = conch,
})

return main
