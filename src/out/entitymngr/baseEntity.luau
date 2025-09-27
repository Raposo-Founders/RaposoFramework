export type BaseEntity = {
	id: string,
	environment: nil, -- TODO: This?

	classname: string,
	associatedInstances: { [Instance]: boolean },
	attributesList: { [string]: unknown },

	IsA: (self: BaseEntity, classname: string) -> boolean,
	OnDelete: (self: BaseEntity, callback: (entity: BaseEntity) -> any) -> nil,

	AssociateInstance: (self: BaseEntity, inst: Instance) -> nil,
	UnassociateInstance: (self: BaseEntity, inst: Instance) -> nil,

	SetAttribute: (self: BaseEntity, name: string, value: unknown) -> nil,
	GetAttribute: (self: BaseEntity, name: string) -> unknown | nil,

	Destroy: (self: BaseEntity) -> nil,

	WriteStateBuffer: (self: BaseEntity) -> nil,
	ApplyStateBuffer: (self: BaseEntity, state: buffer) -> nil,

	Think: (self: BaseEntity, dt: number) -> nil,
}

return nil
