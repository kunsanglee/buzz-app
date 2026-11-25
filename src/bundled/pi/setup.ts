// Pi's providers, as Pi itself has them: the ones it offers, their models,
// saving a provider's key, and testing that a model answers. Keys go to Pi's
// own `~/.pi/agent/auth.json`, shared with the `pi` command, never into Buzz.
import {
  formatModelChoices,
  formatModelDisplayName,
} from "../../features/agents/formatModelDisplayName";
import type { ModelChoice } from "../../features/agents/ModelPicker";
import type { Pi } from "./pi";
import type { ReviewPrompt } from "../../features/agent-protection/models";

export type Provider = Readonly<{
  id: string;
  name: string;
  /** Takes an API key, saved here. */
  key: boolean;
  /** Signs in through the `pi` command rather than with a key. */
  signsIn: boolean;
  /** Where Pi finds its credentials, when it has them. */
  configured?: string;
}>;

export type Providers = Readonly<{
  providers: readonly Provider[];
  /** What Pi's settings pick when an agent names no provider or model. */
  defaults: Readonly<{ provider?: string; model?: string; thinking?: string }>;
}>;

/** A model, with the thinking levels it supports, lowest first. */
export type PiModel = ModelChoice & Readonly<{ thinking: readonly string[] }>;

/** Databricks IDs name the model, as Goose shows them: the pi-databricks
 * provider labels some with the workspace's display name and the rest with
 * the raw ID. */
const LABEL_PREFIXES: ReadonlyMap<string, readonly string[]> = new Map([
  ["databricks", ["databricks-", "goose-"]],
]);
const PROVIDER_SUFFIX = / \(Databricks\)$/;

/** A provider's models labelled and sorted by label, so each family reads
 * in order. An ID the formatter can't name, such as another team's endpoint
 * or an alias, keeps Pi's label. */
export function shownModels(
  provider: string,
  models: readonly PiModel[],
): PiModel[] {
  const prefixes = LABEL_PREFIXES.get(provider);
  const labeled = prefixes
    ? formatModelChoices(
        models.map((model) => ({
          ...model,
          label:
            formatModelDisplayName(model.id, prefixes) === model.id
              ? model.label.replace(PROVIDER_SUFFIX, "")
              : model.id,
        })),
        prefixes,
      )
    : [...models];
  return labeled.sort((a, b) =>
    a.label.localeCompare(b.label, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export type Tested = Readonly<{ ok: boolean; message: string }>;

/** Pi's own thinking level when its settings name none. */
export const DEFAULT_THINKING = "medium";
const LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
/** The level a model with `levels` runs at when asked for `level`, as Pi's
 * `clampThinkingLevel` picks it: that one, else the nearest, higher first. */
export function runsAt(levels: readonly string[], level: string) {
  if (levels.includes(level)) return level;
  const at = LEVELS.indexOf(level);
  const has = (item: string) => levels.includes(item);
  return (
    (at < 0
      ? undefined
      : (LEVELS.slice(at).find(has) ??
        LEVELS.slice(0, at).reverse().find(has))) ??
    levels[0] ??
    "off"
  );
}

export class PiSetup {
  private readonly listed = new Map<string, Promise<readonly PiModel[]>>();

  constructor(private readonly pi: Pick<Pi, "request">) {}

  /** Pi's providers and settings as they are now, which the `pi` command
   * changes. */
  providers(): Promise<Providers> {
    return this.pi.request<Providers>("providers");
  }

  /** What Pi's settings pick now, which the `pi` command changes. */
  defaults(): Promise<Providers["defaults"]> {
    return this.pi.request<Providers["defaults"]>("defaults");
  }

  /** A provider's models, from Pi's catalog. */
  models(id: string): Promise<readonly PiModel[]> {
    const listed = this.listed.get(id);
    if (listed) return listed;
    const listing = this.pi
      .request<{ id: string; name: string; thinking: string[] }[]>("models", {
        provider: id,
      })
      .then((models) =>
        shownModels(
          id,
          models.map((model) => ({
            id: model.id,
            label: model.name || model.id,
            thinking: model.thinking,
          })),
        ),
      );
    this.listed.set(id, listing);
    listing.catch(() => {
      if (this.listed.get(id) === listing) this.listed.delete(id);
    });
    return listing;
  }

  /** Saves a provider's API key with Pi's own login. */
  async login(id: string, key: string) {
    await this.pi.request("login", { provider: id, key });
  }

  /** Asks the model for one short reply, without tools. */
  test(choice: Readonly<{ provider: string; model: string }>): Promise<Tested> {
    return this.pi.request<Tested>("test", choice);
  }
  async review(
    choice: { provider?: string; id: string },
    prompt: ReviewPrompt,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    const id = crypto.randomUUID();
    const cancel = () => {
      void this.pi.request("cancel-review", { id }).catch(() => undefined);
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      const result = await this.pi.request<{
        text: string;
        model: { provider: string; id: string };
      }>("review", { ...choice, model: choice.id, prompt, id });
      signal.throwIfAborted();
      return result;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  }
}
