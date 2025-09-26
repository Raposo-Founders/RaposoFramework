import React from "@rbxts/react";
import { colorTable, uiPreferences } from "./values";
import { UserInputService } from "@rbxts/services";
import { BindFramerate } from "lifecycle";

interface I_WindowProps extends React.PropsWithChildren {
  id: string;
  title: React.Binding<string> | string;
  Closed?: Callback,
}

const visibilityMappings = new Map<string, Callback>();
const windowTitleSize = 25;

export function hideWindow(id: string) {
  visibilityMappings.get(id)?.(false);
}
export function showWindow(id: string) {
  visibilityMappings.get(id)?.(true);
}

export function BaseWindow(props: I_WindowProps) {
  const [visibleBinding, SetVisible] = React.useBinding(false);
  const [positionBinding, SetPosition] = React.useBinding(UDim2.fromOffset(200, 200));
  const titlebarRef = React.createRef<Frame>();

  let isMoving = false;
  let isMouseInsideFrame = false;
  let previusMousePosition = new Vector2();

  visibilityMappings.set(props.id, SetVisible);

  React.useEffect(() => {
    if (!titlebarRef.current) return;

    BindFramerate(() => {
      if (!isMoving || !titlebarRef.current) return;

      if (!visibleBinding.getValue() || !UserInputService.IsMouseButtonPressed("MouseButton1")) {
        isMoving = false;
        return;
      }

      const currentFramePosition = positionBinding.getValue();
      const currentMousePosition = UserInputService.GetMouseLocation();
      const difference = previusMousePosition.sub(currentMousePosition).mul(-1);

      SetPosition(currentFramePosition.add(UDim2.fromOffset(difference.X, difference.Y)));
      previusMousePosition = currentMousePosition;
    });
  });

  return (
    <frame
      BackgroundColor3={Color3.fromHex(colorTable.windowBackground)}
      BackgroundTransparency={0.5}
      Position={positionBinding}
      Size={UDim2.fromOffset(500, 300)}
      Visible={visibleBinding}
    >
      <frame // Title bar
        BackgroundColor3={Color3.fromHex("#00557F")}
        BorderSizePixel={0}
        Size={new UDim2(1, 0, 0, windowTitleSize)}
        Active={true}
        Event={{
          InputBegan: (rbx, input) => {
            if (input.UserInputType.Name !== "MouseButton1" || !isMouseInsideFrame) return;
            isMoving = true;
            previusMousePosition = UserInputService.GetMouseLocation();
          },
          MouseEnter: () => isMouseInsideFrame = true,
          MouseLeave: () => isMouseInsideFrame = false,
        }}
        ref={titlebarRef}
      >
        <imagebutton // Close button
          Image={"rbxassetid://6302778252"}
          AnchorPoint={new Vector2(1, 0.5)}
          BackgroundTransparency={1}
          Position={UDim2.fromScale(1, 0.5)}
          Size={UDim2.fromScale(1, 1)}
          ZIndex={2}
          Event={{
            Activated: () => {
              SetVisible(false);
              props.Closed?.();
            },
          }}
        >
          <uiaspectratioconstraint />
        </imagebutton>

        <textlabel
          FontFace={Font.fromEnum(Enum.Font.GothamBold)}
          Text={props.title}
          TextColor3={Color3.fromHex(colorTable.windowText)}
          TextScaled={true}
          TextSize={14}
          TextWrapped={true}
          TextXAlignment={"Left"}
          BackgroundTransparency={1}
          Size={UDim2.fromScale(1, 1)}
        />

        <uipadding
          PaddingBottom={new UDim(0, 5)}
          PaddingLeft={new UDim(0, 5)}
          PaddingRight={new UDim(0, 5)}
          PaddingTop={new UDim(0, 5)}
        />
      </frame>

      <frame // Content
        BackgroundTransparency={1}
        Position={UDim2.fromOffset(0, windowTitleSize)}
        Size={new UDim2(1, 0, 1, -windowTitleSize)}
      >
        <uipadding
          PaddingBottom={new UDim(0, uiPreferences.baseWindowBorderPadding)}
          PaddingLeft={new UDim(0, uiPreferences.baseWindowBorderPadding)}
          PaddingRight={new UDim(0, uiPreferences.baseWindowBorderPadding)}
          PaddingTop={new UDim(0, uiPreferences.baseWindowBorderPadding)}
        />
        {props.children}
      </frame>
    </frame>
  );
}
