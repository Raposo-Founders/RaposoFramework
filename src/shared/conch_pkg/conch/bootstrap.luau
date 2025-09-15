--!nonstrict
--[[
Bootstraps some basic functions onto the command line.
]]

local RunService = game:GetService("RunService")

local arg = require("./arguments")
local console = require("./console")
local state = require("./state")
local types = require("./types")

local IS_CLIENT = RunService:IsClient()

local function output(t: types.Log)
	console.console.output(t)
end

local function concat(...: string)
	local t = { ... }
	for i, v in t do
		t[i] = tostring(v)
	end
	return table.concat(t, " ")
end

local function conch_print(...)
	local text = concat(...)
	output({ kind = "normal", text = text })
end

local function conch_error(...)
	local text = concat(...)
	error(text, 0)
end

local function conch_warn(...)
	local text = concat(...)
	output({ kind = "warn", text = text })
end

local function conch_info(...)
	local text = concat(...)
	output({ kind = "info", text = text })
end

return function()
	local function set(t: any, key: any, value: any)
		t[key] = value
	end

	-- print("registering commands")
	if IS_CLIENT then
		console.register_command("print", {
			permissions = {},
			description = "Converts the given arguments into a string and sends it to the output",
			arguments = function()
				return arg.variadic(arg.any("any", "Arguments to output"))
			end,
			callback = conch_print,
		})

		console.register_command("sleep", {
			description = "Waits for a given amount of time before continuing execution",
			arguments = function()
				return arg.number("time", "The amount of time to sleep for")
			end,
			callback = task.wait,
		})

		console.register_quick("error", conch_error)
		console.register_quick("warn", conch_warn)
		console.register_quick("info", conch_info)
		console.register_command("set", {
			permissions = {},
			description = "Attempts to set the given key and value onto the given object",
			arguments = function()
				return arg.any("object", "the object to set"),
					arg.any("key", "key of the object"),
					arg.any("value", "the value to set it to")
			end,
			callback = set,
		})
	end
end
