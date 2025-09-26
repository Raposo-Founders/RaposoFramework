import React from "@rbxts/react";
import Signal from "util/signal";
import { colorTable } from "../default/values";
import { TweenService } from "@rbxts/services";

// # Constants & variables
const TAB_ANIMATION_TIME = 0.125;

export const menuTabChanged = new Signal<[group: string, name: string]>();

// # Functions
export function TabsButtonList(props: React.PropsWithChildren) {
  return (
    <frame
      BackgroundTransparency={1}
      Size={UDim2.fromScale(1, 0.075)}
    >
      <uilistlayout
        HorizontalFlex={"Fill"}
        Padding={new UDim(0, 5)}
        FillDirection={"Horizontal"}
        HorizontalAlignment={"Center"}
        SortOrder={"LayoutOrder"}
        VerticalAlignment={"Center"}
      />
      {props.children}
    </frame>
  );
}

export function TabButton(props: { Group: string, Name: string, SmallText?: boolean, Size?: UDim2 }) {
  const reference = React.createRef<TextButton>();

  React.useEffect(() => {
    menuTabChanged.Connect(name => {
      if (!reference.current) return;

      if (name !== props.Name) {
        reference.current.BackgroundTransparency = 0.5;
        reference.current.BackgroundColor3 = new Color3(0, 0, 0);
        reference.current.TextColor3 = new Color3(1, 1, 1);

        return;
      }

      reference.current.BackgroundTransparency = 0;
      reference.current.BackgroundColor3 = Color3.fromHex(colorTable.primaryColor);
      reference.current.TextColor3 = new Color3();
    });
  });

  return <textbutton
    FontFace={new Font(
      "rbxasset://fonts/families/GothamSSm.json",
      Enum.FontWeight.Medium,
      Enum.FontStyle.Normal
    )}
    Text={props.SmallText ? props.Name : props.Name.upper()}
    TextColor3={Color3.fromHex("#FFFFFF")}
    TextScaled={true}
    BackgroundColor3={Color3.fromHex("#000000")}
    BackgroundTransparency={0.5}
    BorderSizePixel={0}
    Size={props.Size || UDim2.fromScale(1, 1)}
    Event={{
      Activated: () => menuTabChanged.Fire(props.Group, props.Name),
    }}
    TextXAlignment={props.SmallText ? "Left" : "Center"}
    ref={reference}
  >
    <uipadding PaddingBottom={new UDim(0, 3)} PaddingTop={new UDim(0, 3)} PaddingLeft={new UDim(0.05, 0)} PaddingRight={new UDim(0.05, 0)} />
  </textbutton>;
}

export function TabContentFrame(props: React.PropsWithChildren) {
  return (
    <frame
      BackgroundTransparency={1}
      Size={UDim2.fromScale(1, 1)}
    >
      <uiflexitem
        FlexMode={"Fill"}
      />
      {props.children}
    </frame>
  );
}

export function Tab(props: { Group: string, Name: string } & React.PropsWithChildren) {
  const parentRef = React.createRef<CanvasGroup>();

  React.useEffect(() => {
    if (!parentRef.current) return;

    menuTabChanged.Connect((group, name) => {
      if (!parentRef.current || group !== props.Group) return;
      let tween: Tween;

      if (name !== props.Name) {
        tween = TweenService.Create(parentRef.current, new TweenInfo(TAB_ANIMATION_TIME), { GroupTransparency: 1 });
        tween.Completed.Connect(() => parentRef.current!.Visible = false);
        tween.Play();

        return;
      }

      parentRef.current.GroupTransparency = 1;
      parentRef.current.Visible = true;

      tween = TweenService.Create(parentRef.current, new TweenInfo(TAB_ANIMATION_TIME), { GroupTransparency: 0 });
      tween.Play();
    });
  });

  return <canvasgroup
    BackgroundTransparency={1}
    Size={new UDim2(1, 0, 1, 0)}
    Visible={false}
    ref={parentRef}
  >
    {props.children}
  </canvasgroup>;
}