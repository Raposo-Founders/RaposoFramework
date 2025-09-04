import { HttpService } from "@rbxts/services";
import { GetGameDefinedValue } from "shared/gamevalues";
import { ListenDirectPacket, WriteDirectPacket } from "shared/network";
import { FinalizeBufferCreation, StartBufferCreation, WriteBufferString } from "shared/util/bufferwriter";

// # Constants & variables
const NEWS_URL = GetGameDefinedValue("NewsFetchURL", "");
const RETRY_TIMER = 5;

let currentNewsInfo: string | undefined;

// # Function
function FetchNews() {
  if (currentNewsInfo) return currentNewsInfo;

  while (!currentNewsInfo) {
    assert(NEWS_URL !== "", "Invalid news URL.");
    print("Fetching news from URL...");

    const [success, obj] = pcall(() => {
      return HttpService.GetAsync(NEWS_URL, true);
    });

    if (!success) {
      warn(`Failed to fetch news. Retrying in ${RETRY_TIMER} seconds... (${obj})`);

      task.wait(RETRY_TIMER);
      continue;
    }

    currentNewsInfo = obj;
  }

  return currentNewsInfo;
}

// # Bindings & misc
ListenDirectPacket("fetch_news", (sender) => {
  StartBufferCreation();
  WriteBufferString(FetchNews());
  WriteDirectPacket("news_fetch_reply", sender, FinalizeBufferCreation());
});