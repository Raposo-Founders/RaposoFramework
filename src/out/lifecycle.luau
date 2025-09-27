export type LifecycleModule = {
	TICKRATE: number,

	BindFramerate: (callback: (dt: number) -> any) -> RBXScriptConnection,
	LifecycleInstance: LifecycleClassConstructor,
}

export type LifecycleClass = {
	running: boolean,
	tickrate: number,

	YieldForTicks: (self: LifecycleClass, ticks: number) -> nil,
	BindUpdate: (self: LifecycleClass, callback: (dt: number) -> any) -> () -> nil,
	BindLateUpdate: (self: LifecycleClass, callback: (dt: number) -> any) -> () -> nil,
	BindTickrate: (self: LifecycleClass, callback: (dt: number) -> any) -> () -> nil,

	Destroy: (self: LifecycleClass) -> nil,
}

export type LifecycleClassConstructor = {
	new: () -> LifecycleClass,
}

return nil
