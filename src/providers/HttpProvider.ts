
// # Constants & variables

import { HttpService, RunService } from "@rbxts/services";

// # Functions

// # Namespace
export namespace HttpProvider {
  export function Request(requestOptions: RequestAsyncRequest, maxAttempts = 3, attemptCooldown = 1) {
    assert(RunService.IsServer(), "Function can only be called from the server.");

    let totalAttempts = 0;

    while (game) {
      totalAttempts++;
      if (totalAttempts > maxAttempts) {
        warn(`Failed to ${requestOptions.Method} "${requestOptions.Url}". (MAX_ATTEMPTS_REACHED)`);
        break;
      }

      const [success, result] = pcall(() => HttpService.RequestAsync(requestOptions));
      if (!success) {
        warn(`Failed to ${requestOptions.Method} "${requestOptions.Url}", retrying in ${attemptCooldown} seconds...`);
        print(result);

        task.wait(attemptCooldown);
        continue;
      }

      if (!result.Success) {
        warn(`${requestOptions.Method} to "${requestOptions.Url}" returned code: ${result.StatusCode} (${result.StatusMessage}).\nRetrying in ${attemptCooldown} seconds...`);
        task.wait(attemptCooldown);
        continue;
      }

      return result.Body;
    }
  }
}

// # Bindings & misc