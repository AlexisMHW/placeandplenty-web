import { readFileSync } from "node:fs";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import { messages } from "./messages";
const catalog = JSON.parse(
  readFileSync(
    new URL("../translations/messages_en.json", import.meta.url),
    "utf8",
  ),
);
describe("Canva translation upload catalog", () => {
  it("contains every runtime descriptor with the required translator context", () => {
    const descriptors = Object.values(messages);
    expect(Object.keys(catalog)).toHaveLength(descriptors.length);
    expect(descriptors.length).toBeLessThanOrEqual(500);
    for (const message of descriptors) {
      expect(catalog[message.id]).toEqual({
        defaultMessage: message.defaultMessage,
        description: message.description,
      });
      for (const value of Object.values(catalog[message.id])) {
        expect(typeof value).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
        expect((value as string).length).toBeLessThanOrEqual(500);
      }
    }
  });
  it("all source messages format successfully with real FormatJS", () => {
    const onError = (error: Error) => {
      throw error;
    };
    const intl = createIntl({ locale: "en", messages: {}, onError });
    for (const descriptor of Object.values(messages))
      expect(intl.formatMessage(descriptor)).toBe(descriptor.defaultMessage);
  });
});
