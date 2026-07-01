# 01 - Foundation

## What We Built

We created the project foundation: a Next.js app, Convex backend location, project rules, environment documentation, and a small tested first screen.

## What Next.js Owns

Next.js owns the user interface, routes, page layouts, and browser-facing experience. In Nura, the support agent will use Next.js screens to ask questions, inspect retrieved chunks, review citations, and run manual evals.

## What Convex Owns

Convex owns application data and backend functions. In later phases it will store synthetic documents, chunks, embeddings, vector indexes, retrieval results, and manual eval notes.

Convex code generation needs an interactive project setup. In this foundation phase we added the schema location and documented the setup command, but we did not commit generated Convex bindings because no deployment is configured yet.

## Why We Lock The Embedding Model Early

Embeddings are stored as fixed-size vectors. If we change the embedding model or vector dimension later, we usually need to re-embed all chunks. For this project we start with `text-embedding-3-small` at 1536 dimensions.

## Why The Answer Model Stays Configurable

The answer model does not shape stored vector data. We are using `gpt-5.4-mini` through Microsoft Foundry for answer generation, while embeddings stay on `text-embedding-3-small`.

## What Comes Next

The next phase is RAG visibility: synthetic documents, ingestion, chunking, and a chunk preview screen.
