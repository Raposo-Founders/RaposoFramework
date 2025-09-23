import React, { PropsWithChildren } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { LogService, UserInputService } from "@rbxts/services";
import { ExecuteCommand } from "shared/cmd";
import { ConsoleFunctionCallback } from "shared/cmd/cvar";
import { defaultEnvironments } from "shared/defaultinsts";
import Signal from "shared/util/signal";

// # Constants & variables
const PADDING_SIZE = 5;
const MASTER_SIZE = new UDim2(1, -200, 0, 40);

const LOADING_CHARS_LIST = ["|", "/", "—", "\\"] as const;
const CLEAR_ALL_OUTPUT = new Signal();

const [masterVisible, setMasterVisible] = React.createBinding(true);
const [commandLineEditable, setEditable] = React.createBinding(true);


// # Functions
function formatString(text: string) {
  return text.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
}

function InputBar() {
  const textboxRef = React.createRef<TextBox>();

  return (
    <frame
      BackgroundColor3={Color3.fromHex("#FFFFFF")}
      BorderSizePixel={0}
      LayoutOrder={-999}
      Size={new UDim2(1, 0, 0, 40)}
    >
      <uicorner />
      <uistroke
        Color={Color3.fromHex("#FFFFFF")}
        Transparency={0.75}
      />
      <uilistlayout
        Padding={new UDim(0, PADDING_SIZE)}
        FillDirection={"Horizontal"}
        SortOrder={"LayoutOrder"}
      />
      <textlabel
        FontFace={new Font("rbxassetid://16658246179")}
        Text={"Raposo$"}
        TextColor3={Color3.fromHex("#55AAFF")}
        TextSize={22}
        TextWrapped={true}
        AutomaticSize={"X"}
        BackgroundTransparency={1}
        Size={UDim2.fromScale(0, 1)}
      />

      <uipadding
        PaddingBottom={new UDim(0, 5)}
        PaddingLeft={new UDim(0, 12)}
        PaddingRight={new UDim(0, 12)}
        PaddingTop={new UDim(0, 5)}
      />

      <textbox
        ClearTextOnFocus={false}
        CursorPosition={-1}
        FontFace={new Font("rbxassetid://16658246179")}
        PlaceholderColor3={Color3.fromHex("#646464")}
        PlaceholderText={"Command here"}
        Text={""}
        TextColor3={Color3.fromHex("#C8C8C8")}
        TextSize={22}
        TextXAlignment={"Left"}
        AutomaticSize={"Y"}
        BackgroundTransparency={1}
        ClipsDescendants={true}
        LayoutOrder={1}
        Size={UDim2.fromScale(1, 1)}
        ref={textboxRef}
        TextEditable={commandLineEditable}
        Event={{
          FocusLost: (rbx, enterPressed) => {
            if (!enterPressed) return;

            const text = formatString(rbx.Text);
            const startTime = time();

            const thread1 = task.spawn(() => {
              let currentIndex = 0;
              let nextRotationTime = 0;

              while (game) {
                const elapsedTime = time() - startTime;
                const timePassed = math.floor(elapsedTime * 100) * 0.01;

                if (elapsedTime >= nextRotationTime) {
                  currentIndex++;
                  if (currentIndex > LOADING_CHARS_LIST.size())
                    currentIndex = 1;

                  nextRotationTime = elapsedTime + 0.25;
                }

                rbx.Text = string.format("%s %.2f s...", LOADING_CHARS_LIST[currentIndex - 1], timePassed);
                task.wait(0.1);
              }
            });

            setEditable(false);
            print(">", text);

            ExecuteCommand(text).finally(() => {
              task.cancel(thread1);
              rbx.Text = "";
              rbx.CursorPosition = -1;
              setEditable(true);
              defaultEnvironments.lifecycle.YieldForTicks(1);
              rbx.CaptureFocus();
            });
          },
        }}
      >
        <uiflexitem
          FlexMode={"Shrink"}
        />
      </textbox>

      <uigradient
        Color={new ColorSequence([
          new ColorSequenceKeypoint(0, Color3.fromHex("#323232")),
          new ColorSequenceKeypoint(1, Color3.fromHex("#000000")),
        ])}
        Rotation={90}
      />
    </frame>
  );
}

function LogsFrame() {
  const referenceParent = React.createRef<Frame>();

  LogService.MessageOut.Connect((message, msgType) => {
    if (!referenceParent.current) return;

    let textColor = Color3.fromHex("#FFFFFF");
    if (msgType.Name === "MessageWarning") textColor = Color3.fromRGB(255, 200, 0);
    if (msgType.Name === "MessageError") textColor = Color3.fromRGB(255, 30, 0);

    const element = <textlabel
      FontFace={new Font("rbxassetid://16658246179")}
      Text={message}
      TextColor3={textColor}
      TextSize={20}
      TextWrapped={true}
      TextXAlignment={"Left"}
      TextYAlignment={"Top"}
      AutomaticSize={"Y"}
      BackgroundTransparency={1}
      Size={UDim2.fromScale(1, 0)}
      LayoutOrder={referenceParent.current.GetChildren().size()}
    />;

    const root = ReactRoblox.createRoot(referenceParent.current, { "hydrate": true });
    root.render(element);

    CLEAR_ALL_OUTPUT.Once(() => root.unmount());
  });

  return (
    <frame
      AutomaticSize={"Y"}
      BackgroundTransparency={1}
      LayoutOrder={1}
      Size={UDim2.fromScale(1, 0)}
      ref={referenceParent}
    >
      <frame // Spacing
        BackgroundTransparency={1}
        LayoutOrder={-998}
        Size={new UDim2(1, 0, 0, 5)}
      />
      <frame // Top line
        BackgroundColor3={Color3.fromHex("#FFFFFF")}
        BackgroundTransparency={0.75}
        BorderSizePixel={0}
        LayoutOrder={-999}
        Size={new UDim2(1, 0, 0, 2)}
      />
      <uipadding
        PaddingBottom={new UDim(0, 5)}
        PaddingLeft={new UDim(0, 6)}
        PaddingRight={new UDim(0, 6)}
        PaddingTop={new UDim(0, 5)}
      />
      <uilistlayout
        SortOrder={"LayoutOrder"}
      />
    </frame>
  );
}

function CommandLineMasterFrame(props: PropsWithChildren) {
  return (
    <frame
      AnchorPoint={new Vector2(0.5, 0)}
      AutomaticSize={"Y"}
      BackgroundColor3={Color3.fromHex("#000000")}
      BackgroundTransparency={0.5}
      BorderSizePixel={0}
      Position={UDim2.fromScale(0.5, 0.1)}
      Size={MASTER_SIZE}
      Visible={masterVisible}
    >
      <uicorner
        CornerRadius={new UDim(0, 12)}
      />

      <uistroke
        Color={Color3.fromHex("#FFFFFF")}
        Transparency={0.75}
      />

      <uipadding
        PaddingBottom={new UDim(0, 5)}
        PaddingLeft={new UDim(0, 5)}
        PaddingRight={new UDim(0, 5)}
        PaddingTop={new UDim(0, 5)}
      />

      <frame
        AutomaticSize={"Y"}
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 0)}
      >
        <uilistlayout
          Padding={new UDim(0, 5)}
          HorizontalAlignment={"Center"}
          SortOrder={"LayoutOrder"}
        />
        {props.children}
      </frame>
    </frame>
  );
}

export function CommandLine() {
  return <CommandLineMasterFrame>
    <InputBar />
    <LogsFrame />
  </CommandLineMasterFrame>;
}

// # Execution
UserInputService.InputBegan.Connect((input) => {
  if (input.KeyCode !== Enum.KeyCode.F2) return;
  setMasterVisible(!masterVisible.getValue());
});

new ConsoleFunctionCallback(["testyield", "shit"], [{ name: "time", type: "number" }])
  .setCallback((ctx) => {
    const timeAmount = ctx.getArgument("time", "number").value;
    ctx.Reply(`Yielding for ${timeAmount} seconds!`);
    task.wait(10);
  });