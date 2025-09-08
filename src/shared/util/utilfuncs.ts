// # Constants
const RunService = game.GetService("RunService");

// # Functions
export function ErrorObject<T>(message: string) {
  return setmetatable({}, {
    __index: () => {
      throw message;
    },
    __newindex: () => {
      throw message;
    },
    __call: () => {
      throw message;
    }
  }) as T;
}

export function DoesInstanceExist(inst: Instance | undefined): inst is Instance {
  return inst !== undefined && inst.IsDescendantOf(game);
}

export function ReplicatedInstance<K extends keyof CreatableInstances, I extends CreatableInstances[K]>(
  parent: Instance,
  name: string,
  classname: K,
): I {
  let targetInstance = parent.FindFirstChild(name) as I | undefined;

  if (!targetInstance || !targetInstance.IsA(classname)) {
    if (RunService.IsClient()) {
      targetInstance = parent.WaitForChild(name + "_" + classname) as I;
      return targetInstance;
    }

    targetInstance = new Instance(classname) as I;
    targetInstance.Name = name + "_" + classname;
    targetInstance.Parent = parent;
  }

  return targetInstance;
}

export function RandomString(length: number) {
  let content = "";
  for (let index = 0; index < length; index++)
    content = `${content}${string.char(math.random(48, 122))}`;

  return content;
}
