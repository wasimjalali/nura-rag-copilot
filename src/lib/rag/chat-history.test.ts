import { beforeEach, describe, expect, it } from "vitest";

import {
  loadLegacyConversationsForMigration,
  markLegacyConversationMigrationComplete,
  saveConversations,
  type Conversation,
} from "./chat-history";

describe("legacy conversation migration", () => {
  beforeEach(() => window.localStorage.clear());

  it("offers local conversations once and removes them after migration", () => {
    const conversation: Conversation = {
      id: "legacy-1",
      title: "Legacy chat",
      turns: [],
      createdAt: 1,
      updatedAt: 2,
    };
    saveConversations([conversation]);

    expect(loadLegacyConversationsForMigration()).toEqual([conversation]);
    markLegacyConversationMigrationComplete();
    expect(loadLegacyConversationsForMigration()).toEqual([]);
  });
});
