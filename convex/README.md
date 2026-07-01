# Convex Backend

This directory is where Nura's Convex backend functions and schema live.

## Current Foundation State

- `schema.ts` defines the first placeholder table for project notes.
- `convex/_generated/` is intentionally not present yet because Convex requires an interactive project setup before code generation.

## First Interactive Setup Step

Run this when you are ready to connect the project to Convex:

```bash
npx convex dev
```

That command logs in, configures a dev deployment, writes local Convex environment settings, generates `convex/_generated/`, and starts watching backend files.

After setup, commit the generated Convex files so the project typechecks consistently.
