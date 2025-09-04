import Object from "@rbxts/object-utils";
import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { UserInputService } from "@rbxts/services";
import { ExecuteCommand } from "shared/cmd";
import { registeredCallbacks, createdCVars, RegisterConsoleCallback } from "shared/cmd/cvar";
import { messageOut } from "shared/logger";
import CBindableSignal from "shared/util/signal";
import { colorTable, uiPreferences } from "./default/values";
import { BaseWindow, HideWindow, ShowWindow } from "./default/window";

// # Constants & variables
const logEntryAccentSize = 5;
const currentRenderingText: React.Element[] = [];
const currentRenderingSuggestions: string[] = [];
const setTextboxText = new CBindableSignal<[string]>();
const setTextboxFocus = new CBindableSignal<[focused: boolean]>();

let currentLogsFrame: ScrollingFrame | undefined;
let currentSuggestionsFrame: Frame | undefined;
let suggestionsRoot: ReactRoblox.Root | undefined;
let logsRoot: ReactRoblox.Root | undefined;

let selectedSuggestionIndex = 0;
let isTextboxFocused = false;
let isWindowVisible = false;

// # Functions
function ClearLogs() {
  currentRenderingText.clear();
  LogEntry([""]);
}

function ConsoleLogEntry(props: { entries: string[], order: number, accent?: Color3 }) {
  const textEntries: React.Element[] = [];

  for (let i = 0; i < props.entries.size(); i++) {
    const element = props.entries[i];
    textEntries.push(
      <textlabel
        FontFace={Font.fromEnum(Enum.Font.RobotoMono)}
        Text={element}
        TextColor3={Color3.fromHex(colorTable.windowText)}
        TextSize={18}
        AutomaticSize={"XY"}
        BackgroundTransparency={1}
        LayoutOrder={i}
      />
    );
  }

  return <frame
    AutomaticSize={"Y"}
    BackgroundColor3={Color3.fromHex("#FFFFFF")}
    BackgroundTransparency={1}
    Size={UDim2.fromScale(1, 0)}
  >
    {
      props.accent ?
        <frame
          BackgroundColor3={props.accent}
          BorderSizePixel={0}
          Size={new UDim2(0, logEntryAccentSize, 1, 0)}
        />
        :
        <></>
    }

    <frame
      AutomaticSize={"Y"}
      BackgroundTransparency={1}
      Position={props.accent ? UDim2.fromOffset(logEntryAccentSize, 0) : new UDim2()}
      Size={new UDim2(1, props.accent ? -logEntryAccentSize : 0, 1, 0)}
    >
      <uipadding
        PaddingLeft={new UDim(0, 5)}
      />

      <uilistlayout
        SortOrder={"LayoutOrder"}
      />

      {textEntries}
    </frame>
  </frame>;
}

export function LogEntry(content: string[], accentColor?: Color3) {
  const element = <ConsoleLogEntry entries={content} order={currentRenderingText.size() + 1} accent={accentColor} />;

  currentRenderingText.push(element);
  logsRoot?.render(<>{currentRenderingText}</>);
}

function GetCommandSuggestions(input: string) {
  const suggestionList: string[] = [];

  for (const [varName] of createdCVars) {
    if (!varName.match(input)[0]) continue;
    suggestionList.push(varName);
  }

  for (const cmdName of registeredCallbacks) {
    if (!cmdName.match(input)[0]) continue;
    suggestionList.push(cmdName);
  }

  return suggestionList;
}

function UpdateSuggestionsList() {
  if (!suggestionsRoot) return;

  const renderingList: React.Element[] = [];

  for (let i = 0; i < currentRenderingSuggestions.size(); i++) {
    const suggestion = currentRenderingSuggestions[i];
    const isSelected = selectedSuggestionIndex === i;
    const element = <textlabel
      FontFace={Font.fromEnum(Enum.Font.RobotoMono)}
      RichText={true}
      Text={`${isSelected ? "<b>" : ""} ${suggestion} ${isSelected ? "</b>" : ""}`}
      TextColor3={Color3.fromHex(colorTable.windowText)}
      TextSize={16}
      TextXAlignment={"Left"}
      BackgroundColor3={isSelected ? new Color3(0.25, 0.25, 0.25) : new Color3()} // TODO: Match accent color
      BackgroundTransparency={0}
      BorderSizePixel={0}
      LayoutOrder={i}
      Size={new UDim2()}
      AutomaticSize={"XY"}
    />;

    renderingList.push(element);
  }

  suggestionsRoot.render(<>{renderingList}</>);
}

function FormatCommandString(text: string) {
  return text.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
}

export default function ConsoleWindow() {
  const logsContentRef = React.createRef<ScrollingFrame>();
  const suggestionsContentRef = React.createRef<Frame>();
  const commandLineRef = React.createRef<TextBox>();

  React.useEffect(() => {
    const textbox = commandLineRef.current;
    currentLogsFrame = logsContentRef.current;
    currentSuggestionsFrame = suggestionsContentRef.current;

    if (!logsRoot && currentLogsFrame) {
      logsRoot = ReactRoblox.createRoot(currentLogsFrame, {"hydrate": true});
    }

    if (!suggestionsRoot && currentSuggestionsFrame) {
      suggestionsRoot = ReactRoblox.createRoot(currentSuggestionsFrame, { "hydrate": true });
    }

    if (textbox) {
      textbox.FocusLost.Connect(enterPressed => {
        if (!enterPressed) return;

        const content = FormatCommandString(textbox.Text);

        textbox.Text = "";
        textbox.CursorPosition = -1;

        LogEntry([`> ${content}`]);

        ExecuteCommand(content).andThen(reply => {
          if (!reply) return;
          LogEntry([reply]);
        });

        task.wait();
        task.wait(); // Double trouble :)

        textbox.CaptureFocus();
      });

      textbox.Focused.Connect(() => isTextboxFocused = true);
      textbox.FocusLost.Connect(() => isTextboxFocused = false);

      // Suggestions checking
      textbox.GetPropertyChangedSignal("Text").Connect(() => {
        const formattedContent = FormatCommandString(textbox.Text);
        const split = formattedContent.split(" ");
        const name = split.shift();

        currentRenderingSuggestions.clear();
        selectedSuggestionIndex = 0;

        if (!name || name === "") {
          UpdateSuggestionsList();
          return;
        }

        // If we're still typing out the first command
        if (split.size() === 0) {
          Object.assign(currentRenderingSuggestions, GetCommandSuggestions(name));
          UpdateSuggestionsList();

          return;
        }

        // TODO: Autocomplete
      });

      // Removing the last \t character from the textbox
      textbox.GetPropertyChangedSignal("Text").Connect(() => {
        const text = textbox.Text;
        const lastCharacter = text.sub(text.size(), text.size());

        if (lastCharacter === "\t")
          textbox.Text = FormatCommandString(text);
      });

      setTextboxText.Connect(text => {
        textbox.Text = FormatCommandString(text);
        textbox.CursorPosition = text.size();
      });

      setTextboxFocus.Connect((focused) => {
        task.wait();
        task.wait();

        if (focused)
          textbox.CaptureFocus();
        else textbox.ReleaseFocus(false);
      });
    }
  });

  return <BaseWindow id="console" title="Console" Closed={() => isWindowVisible = false}>
    <scrollingframe // Logs content
      BackgroundColor3={Color3.fromHex(colorTable.windowBackground)}
      BackgroundTransparency={1}
      BorderSizePixel={0}
      Size={UDim2.fromScale(1, 0)}
      TopImage={"rbxasset://textures/ui/Scroll/scroll-middle.png"}
      BottomImage={"rbxasset://textures/ui/Scroll/scroll-middle.png"}
      ScrollBarThickness={12}
      AutomaticCanvasSize={"Y"}
      VerticalScrollBarInset={"ScrollBar"}
      CanvasSize={new UDim2()}
      ref={logsContentRef}
    >
      <uilistlayout
        SortOrder={"LayoutOrder"}
      />
    </scrollingframe>

    <uilistlayout
      Padding={new UDim(0, uiPreferences.baseWindowBorderPadding)}
      VerticalFlex={"Fill"}
      SortOrder={"LayoutOrder"}
    />

    <frame
      BackgroundColor3={Color3.fromHex(colorTable.windowBackground)}
      BackgroundTransparency={0.5}
      BorderSizePixel={0}
      Size={UDim2.fromScale(1, 1)}
    >
      <uisizeconstraint
        MaxSize={new Vector2(math.huge, 20)}
      />

      <textbox
        CursorPosition={-1}
        FontFace={Font.fromEnum(Enum.Font.RobotoMono)}
        PlaceholderText={"Write your command here..."}
        RichText={true}
        Text={""}
        TextColor3={Color3.fromHex(colorTable.windowText)}
        TextSize={16}
        TextXAlignment={"Left"}
        BackgroundTransparency={1}
        ClipsDescendants={true}
        ClearTextOnFocus={false}
        Position={UDim2.fromOffset(10, 0)}
        Size={new UDim2(1, -10, 1, 0)}
        ref={commandLineRef}
      />

      <frame // TODO: This thing
        BackgroundColor3={Color3.fromHex("#55AAFF")}
        BorderSizePixel={0}
        Size={new UDim2(0, 5, 1, 0)}
      />

      <frame // SuggestionsFrame
        AutomaticSize={"XY"}
        Position={UDim2.fromScale(0, 1)}
        BackgroundTransparency={1}
        Size={new UDim2()}
        ref={suggestionsContentRef}
      >
        <uilistlayout
          SortOrder={"LayoutOrder"}
        />
      </frame>
    </frame>
  </BaseWindow>;
}

// # Bindings & misc
RegisterConsoleCallback(["clear", "cls"])(() => ClearLogs());

UserInputService.InputBegan.Connect((input, busy) => {
  if (!isTextboxFocused) return;

  if (input.KeyCode.Name === "Down") selectedSuggestionIndex++;
  if (input.KeyCode.Name === "Up") selectedSuggestionIndex--;

  if (input.KeyCode.Name === "Tab") {
    const selectedSuggestion = currentRenderingSuggestions[selectedSuggestionIndex];
    if (!selectedSuggestion) return;

    setTextboxText.Fire(selectedSuggestion + " ");
  }

  selectedSuggestionIndex = math.clamp(selectedSuggestionIndex, 0, math.max(currentRenderingSuggestions.size() - 1, 0));
  UpdateSuggestionsList();
});

UserInputService.InputBegan.Connect((input) => {
  if (input.KeyCode.Name !== "F2") return;

  if (isWindowVisible)
    HideWindow("console");
  else
    ShowWindow("console");

  isWindowVisible = !isWindowVisible;
  setTextboxFocus.Fire(isWindowVisible);
});

messageOut.Connect((logType, content) => {

  let accentColor: Color3 | undefined;

  switch (logType) {
  case "WARN":
    accentColor = new Color3(0.95, 0.95, 0);
    break;
  case "EXCEPTION":
    accentColor = new Color3(1, 0.25, 0.25);
    break;
  }

  LogEntry([content], accentColor);
});