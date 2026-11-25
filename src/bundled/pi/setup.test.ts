import { expect, test } from "vitest";
import { shownModels } from "./setup";

const model = (id: string, label: string) => ({ id, label, thinking: [] });

test("Databricks models are named from their IDs and sorted", () => {
  const shown = shownModels("databricks", [
    model("system.ai.gemini-4-neon", "gemini-4-neon (Databricks)"),
    model("databricks-gemini-3-5-flash", "Gemini 3.5 Flash (Databricks)"),
    model(
      "team-custom-gpt-endpoint",
      "team-custom-gpt-endpoint → GPT-5.5 (Databricks)",
    ),
    model("system.ai.gemini-4-carbon", "gemini-4-carbon (Databricks)"),
    model("databricks-gpt-5-1", "GPT-5.1 (Databricks)"),
    model("databricks-gemini-3-1-pro", "Gemini 3.1 Pro (Databricks)"),
    model("system.ai.gemini-3-1-pro", "gemini-3-1-pro (Databricks)"),
  ]);
  expect(shown.map(({ label }) => label)).toEqual([
    "databricks-gemini-3-1-pro",
    "Gemini 3.5 Flash",
    "Gemini 4 Carbon",
    "Gemini 4 Neon",
    "GPT-5.1",
    "system.ai.gemini-3-1-pro",
    "team-custom-gpt-endpoint → GPT-5.5",
  ]);
});

test("other providers keep Pi's labels", () => {
  expect(
    shownModels("anthropic", [
      model("claude-opus-4-5", "Claude Opus 4.5"),
      model("claude-fable-5-2", "Claude Fable 5.2"),
    ]).map(({ label }) => label),
  ).toEqual(["Claude Fable 5.2", "Claude Opus 4.5"]);
  expect(
    shownModels("constructor", [model("custom-1", "Custom 1")]).map(
      ({ label }) => label,
    ),
  ).toEqual(["Custom 1"]);
});
