local conch = require("@self/conch")
local ui = require("@self/ui")

return setmetatable({
	ui = ui,
}, {
	__index = conch,
})
