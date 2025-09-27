type DisconnectHandler = {
	Disconnect: () -> nil,
}

export type Signal<T> = {
	Once: (self: Signal<T>, callback: (...T) -> nil) -> DisconnectHandler,
	Connect: (self: Signal<T>, callback: (...T) -> nil) -> DisconnectHandler,
	Fire: (self: Signal<T>, ...T) -> DisconnectHandler,
	Wait: (self: Signal<T>) -> nil,
	Clear: (self: Signal<T>) -> nil,
}

return nil
