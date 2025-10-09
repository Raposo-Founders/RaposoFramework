import { GroupService, MarketplaceService } from "@rbxts/services";

// # Constants & variables
let gameName: string | undefined;

let currentGroupInfo: GroupInfo | undefined;
const alliedGroups: GroupInfo[] = [];

// # Functions
export function GetCreatorGroupInfo() {
  if (currentGroupInfo)
    return {
      groupInfo: currentGroupInfo,
      alliedGroups: alliedGroups,
    };

  if (game.CreatorType !== Enum.CreatorType.Group)
    return;

  currentGroupInfo = GroupService.GetGroupInfoAsync(game.CreatorId);

  const allies = GroupService.GetAlliesAsync(game.CreatorId);
  if (allies.GetCurrentPage().size() > 0)
    while (game) {
      for (const alliedGroup of allies.GetCurrentPage())
        alliedGroups.push(alliedGroup);

      if (allies.IsFinished)
        break;

      allies.AdvanceToNextPageAsync();
      task.wait(1);
    }

  return {
    groupInfo: currentGroupInfo,
    alliedGroups: alliedGroups,
  };
}

export function GetGameName() {
  if (gameName)
    return gameName;

  const info = MarketplaceService.GetProductInfo(game.PlaceId);
  gameName = info.Name;

  return gameName;
}