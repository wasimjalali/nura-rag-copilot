/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as answerProvider from "../answerProvider.js";
import type * as auth from "../auth.js";
import type * as conversations from "../conversations.js";
import type * as embeddingProvider from "../embeddingProvider.js";
import type * as evaluations from "../evaluations.js";
import type * as groundedAnswer from "../groundedAnswer.js";
import type * as operations from "../operations.js";
import type * as providerRetry from "../providerRetry.js";
import type * as ragAnswer from "../ragAnswer.js";
import type * as ragEmbedding from "../ragEmbedding.js";
import type * as ragRetrieval from "../ragRetrieval.js";
import type * as ragStorage from "../ragStorage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  answerProvider: typeof answerProvider;
  auth: typeof auth;
  conversations: typeof conversations;
  embeddingProvider: typeof embeddingProvider;
  evaluations: typeof evaluations;
  groundedAnswer: typeof groundedAnswer;
  operations: typeof operations;
  providerRetry: typeof providerRetry;
  ragAnswer: typeof ragAnswer;
  ragEmbedding: typeof ragEmbedding;
  ragRetrieval: typeof ragRetrieval;
  ragStorage: typeof ragStorage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
