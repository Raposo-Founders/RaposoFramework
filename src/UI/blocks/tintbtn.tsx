import React from "@rbxts/react";

interface OptionalTintButtonProps {
  Size: UDim2;
  Position: UDim2;
  AnchorPoint: Vector2;
  Visible: React.Binding<boolean> | boolean;
}

interface RequiredTintButtonProps {
  Text: string;
  Callback: Callback;
}

export function TintButton(props: Partial<OptionalTintButtonProps> & RequiredTintButtonProps & React.PropsWithChildren) {
  return (
    <textbutton
      FontFace={new Font("rbxasset://fonts/families/SourceSansPro.json")}
      Text={""}
      TextColor3={Color3.fromHex("#000000")}
      TextSize={14}
      BackgroundColor3={Color3.fromHex("#FFFFFF")}
      BackgroundTransparency={1}
      BorderColor3={Color3.fromHex("#000000")}
      BorderSizePixel={0}
      Size={props.Size}
      Position={props.Position}
      Event={{
        Activated: () => props.Callback(),
      }}
      Visible={props.Visible}
    >
      <textlabel
        FontFace={new Font(
          "rbxassetid://12187365364",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={props.Text}
        TextColor3={Color3.fromHex("#FFFFFF")}
        TextSize={21}
        TextWrapped={true}
        AnchorPoint={new Vector2(0.5, 0.5)}
        BackgroundColor3={Color3.fromHex("#FFFFFF")}
        BackgroundTransparency={1}
        BorderColor3={Color3.fromHex("#000000")}
        BorderSizePixel={0}
        Position={UDim2.fromScale(0.5, 0.5)}
        Size={UDim2.fromScale(1, 1)}
      />

      <frame
        AnchorPoint={new Vector2(0.5, 0.5)}
        BackgroundColor3={Color3.fromHex("#FFFFFF")}
        BackgroundTransparency={0.99}
        BorderColor3={Color3.fromHex("#000000")}
        BorderSizePixel={0}
        Position={UDim2.fromScale(0.5, 0.5)}
        Size={UDim2.fromScale(1, 1)}
        ZIndex={0}
      >
        <canvasgroup
          AnchorPoint={new Vector2(0.5, 0.5)}
          BackgroundColor3={Color3.fromHex("#0090FF")}
          BackgroundTransparency={0.05}
          BorderColor3={Color3.fromHex("#000000")}
          BorderSizePixel={0}
          Position={UDim2.fromScale(0.5, 0.5)}
          Size={UDim2.fromScale(1, 1)}
        >
          <uicorner
            CornerRadius={new UDim(0, 40)}
          />

          <imagelabel
            Image={"rbxassetid://99981045963352"}
            ImageColor3={Color3.fromHex("#80DDFF")}
            ImageTransparency={0.5}
            BackgroundTransparency={1}
            Size={UDim2.fromScale(1, 1.2)}
          />

          <imagelabel
            Image={"rbxassetid://99981045963352"}
            ImageColor3={Color3.fromHex("#80DDFF")}
            ImageTransparency={0.5}
            AnchorPoint={new Vector2(0, 1)}
            BackgroundTransparency={1}
            Position={UDim2.fromScale(0, 1)}
            Rotation={180}
            Size={UDim2.fromScale(1, 1.2)}
          />
        </canvasgroup>

        <uicorner
          CornerRadius={new UDim(0, 40)}
        />

        <frame
          AnchorPoint={new Vector2(0.5, 0.5)}
          BackgroundColor3={Color3.fromHex("#FFFFFF")}
          BackgroundTransparency={1}
          BorderColor3={Color3.fromHex("#000000")}
          BorderSizePixel={0}
          Position={UDim2.fromScale(0.5, 0.499)}
          Size={new UDim2(1, -3, 1, -3)}
          ZIndex={2}
        >
          <uicorner
            CornerRadius={new UDim(0, 40)}
          />

          <uistroke
            Color={Color3.fromHex("#FFFFFF")}
            Thickness={1.5}
            Transparency={0.5}
          />
        </frame>

        <uistroke
          Thickness={1.5}
          Transparency={0.9}
        />
      </frame>
    </textbutton>
  );
}