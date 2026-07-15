import { v } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireActor } from "./auth";

export type StoredHistoryTurn = { question: string; answer: string };

export function deriveServerConversationTitle(question: string) {
  const normalized = question.trim().replace(/\s+/g, " ");
  if (!normalized) return "New chat";
  return normalized.length > 60 ? `${normalized.slice(0, 59)}…` : normalized;
}

export function trimStoredHistory(
  history: StoredHistoryTurn[],
  maxTurns = 6,
  maxChars = 6000,
) {
  const recent = history.slice(-maxTurns);
  const result: StoredHistoryTurn[] = [];
  let chars = 0;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const turn = recent[index];
    const size = turn.question.length + turn.answer.length;
    if (result.length > 0 && chars + size > maxChars) break;
    result.unshift(turn);
    chars += size;
  }
  return result;
}

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActor(ctx);
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_owner_updated", (q) => q.eq("ownerSubject", actor.subject))
      .order("desc")
      .take(30);
    return conversations.map((conversation) => ({
      id: conversation._id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    }));
  },
});

export const getById = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.ownerSubject !== actor.subject) {
      throw new Error("FORBIDDEN");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();
    const turns = [];

    for (let index = 0; index < messages.length - 1; index += 1) {
      const user = messages[index];
      const assistant = messages[index + 1];
      if (user.role !== "user" || assistant.role !== "assistant") continue;

      if (assistant.status === "completed") {
        const evidence = await ctx.db
          .query("messageEvidence")
          .withIndex("by_message", (q) => q.eq("messageId", assistant._id))
          .collect();
        turns.push({
          id: assistant._id,
          question: user.content,
          answer: {
            question: user.content,
            answer: assistant.content,
            answerModel: assistant.answerModel ?? "unknown",
            structuredAnswer: {
              answerType: assistant.answerType ?? "insufficient_evidence",
              paragraphs: assistant.structuredParagraphs ?? [],
            },
            retrieval: {
              embeddingModel: assistant.embeddingModel ?? "unknown",
              embeddingDimensions: assistant.embeddingDimensions ?? 0,
              results: evidence
                .slice()
                .sort((left, right) => left.rank - right.rank)
                .map(({ _id, _creationTime, messageId, ...item }) => item),
            },
            conversationId: conversation._id,
            assistantMessageId: assistant._id,
          },
          error: null,
        });
      } else if (assistant.status === "failed") {
        turns.push({
          id: assistant._id,
          question: user.content,
          answer: null,
          error: "The previous answer could not be completed.",
        });
      }
      index += 1;
    }

    return {
      id: conversation._id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      turns,
    };
  },
});

export const remove = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.ownerSubject !== actor.subject) {
      throw new Error("FORBIDDEN");
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();
    for (const message of messages) {
      const evidence = await ctx.db
        .query("messageEvidence")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();
      for (const item of evidence) await ctx.db.delete(item._id);
      await ctx.db.delete(message._id);
    }
    await ctx.db.delete(conversation._id);
    return null;
  },
});

export const getHistory = internalQuery({
  args: { conversationId: v.id("conversations"), ownerSubject: v.string() },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.ownerSubject !== args.ownerSubject) {
      throw new Error("FORBIDDEN");
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();
    const turns: StoredHistoryTurn[] = [];
    for (let index = 0; index < messages.length - 1; index += 1) {
      const user = messages[index];
      const assistant = messages[index + 1];
      if (
        user.role === "user" &&
        assistant.role === "assistant" &&
        assistant.status === "completed"
      ) {
        turns.push({ question: user.content, answer: assistant.content });
        index += 1;
      }
    }
    return trimStoredHistory(turns);
  },
});

export const createPendingTurn = internalMutation({
  args: {
    ownerSubject: v.string(),
    conversationId: v.optional(v.id("conversations")),
    requestId: v.string(),
    question: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("messages")
      .withIndex("by_request_id", (q) => q.eq("requestId", args.requestId))
      .first();
    if (duplicate) {
      const duplicateConversation = await ctx.db.get(duplicate.conversationId);
      if (
        !duplicateConversation ||
        duplicateConversation.ownerSubject !== args.ownerSubject
      ) {
        throw new Error("FORBIDDEN");
      }
      return {
        conversationId: duplicate.conversationId,
        assistantMessageId: duplicate._id,
        duplicate: true,
      };
    }

    let conversationId: Id<"conversations">;
    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId);
      if (!conversation || conversation.ownerSubject !== args.ownerSubject) {
        throw new Error("FORBIDDEN");
      }
      conversationId = conversation._id;
    } else {
      conversationId = await ctx.db.insert("conversations", {
        ownerSubject: args.ownerSubject,
        title: deriveServerConversationTitle(args.question),
        createdAt: args.now,
        updatedAt: args.now,
      });
    }

    await ctx.db.insert("messages", {
      conversationId,
      role: "user",
      content: args.question,
      status: "completed",
      createdAt: args.now,
      updatedAt: args.now,
    });
    const assistantMessageId = await ctx.db.insert("messages", {
      conversationId,
      requestId: args.requestId,
      role: "assistant",
      content: "",
      status: "pending",
      createdAt: args.now + 1,
      updatedAt: args.now + 1,
    });
    await ctx.db.patch(conversationId, { updatedAt: args.now });
    return { conversationId, assistantMessageId, duplicate: false };
  },
});

export const completeTurn = internalMutation({
  args: {
    assistantMessageId: v.id("messages"),
    content: v.string(),
    answerType: v.union(v.literal("grounded"), v.literal("insufficient_evidence")),
    answerModel: v.string(),
    embeddingModel: v.string(),
    embeddingDimensions: v.number(),
    structuredParagraphs: v.array(
      v.object({ text: v.string(), citations: v.array(v.string()) }),
    ),
    evidence: v.array(
      v.object({
        rank: v.number(), score: v.number(), chunkId: v.string(), source: v.string(),
        section: v.string(), text: v.string(), tokenEstimate: v.number(),
        citationLabel: v.string(),
      }),
    ),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assistantMessageId, {
      content: args.content,
      status: "completed",
      answerType: args.answerType,
      answerModel: args.answerModel,
      embeddingModel: args.embeddingModel,
      embeddingDimensions: args.embeddingDimensions,
      structuredParagraphs: args.structuredParagraphs,
      updatedAt: args.now,
    });
    for (const evidence of args.evidence) {
      await ctx.db.insert("messageEvidence", {
        messageId: args.assistantMessageId,
        ...evidence,
      });
    }
    const message = await ctx.db.get(args.assistantMessageId);
    if (message) {
      await ctx.db.patch(message.conversationId, { updatedAt: args.now });
    }
    return null;
  },
});

export const getCompletedTurn = internalQuery({
  args: {
    assistantMessageId: v.id("messages"),
    ownerSubject: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.assistantMessageId);
    if (!message || message.role !== "assistant") return null;
    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.ownerSubject !== args.ownerSubject) {
      throw new Error("FORBIDDEN");
    }
    if (message.status !== "completed") return null;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", message.conversationId),
      )
      .order("asc")
      .collect();
    const messageIndex = messages.findIndex((item) => item._id === message._id);
    const user = messages[messageIndex - 1];
    if (!user || user.role !== "user") return null;
    const evidence = await ctx.db
      .query("messageEvidence")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .collect();
    return {
      question: user.content,
      answer: message.content,
      answerModel: message.answerModel ?? "unknown",
      structuredAnswer: {
        answerType: message.answerType ?? "insufficient_evidence",
        paragraphs: message.structuredParagraphs ?? [],
      },
      retrieval: {
        embeddingModel: message.embeddingModel ?? "unknown",
        embeddingDimensions: message.embeddingDimensions ?? 0,
        results: evidence
          .slice()
          .sort((left, right) => left.rank - right.rank)
          .map(({ _id, _creationTime, messageId, ...item }) => item),
      },
      conversationId: conversation._id,
      assistantMessageId: message._id,
    };
  },
});

export const failTurn = internalMutation({
  args: { assistantMessageId: v.id("messages"), errorCode: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assistantMessageId, {
      status: "failed", errorCode: args.errorCode, updatedAt: args.now,
    });
    return null;
  },
});
