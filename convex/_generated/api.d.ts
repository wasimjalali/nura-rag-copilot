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
import type * as embeddingProvider from "../embeddingProvider.js";
import type * as groundedAnswer from "../groundedAnswer.js";
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
  embeddingProvider: typeof embeddingProvider;
  groundedAnswer: typeof groundedAnswer;
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
