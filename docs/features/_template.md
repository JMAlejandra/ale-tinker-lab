<!--
Feature doc template. Copy to docs/features/<feature-name>.md.

A feature doc describes one piece of the system as it is now: what it does,
how it fits together, what it can't do, and why it's shaped this way. Keep it
current when the feature changes. A single decision with trade-offs gets its
own ADR in docs/adr/; link it from "Decisions" instead of repeating it.
Use the vocabulary in GLOSSARY.md. Delete these comments.
-->

# <Feature name>

Status: experimental | in use | retired · Last updated: YYYY-MM-DD

One or two sentences: what this is and who or what uses it.

## What it does

The behaviour from the outside: routes, UI, commands, API procedures.

## How it works

The moving parts and how they connect: modules, tables, external services,
background jobs. Name the entry points so a reader knows where to start.

## What it can't do

Known limits, unsupported cases, and things it deliberately doesn't handle.

## Decisions

Why it's built this way. One line per decision, linking the ADR when one exists.

- <Decision>: <reason>. See `docs/adr/NNNN-<slug>.md`.

## Operating it

Configuration, environment variables, migrations, how to test it. Delete if
there's nothing beyond the usual workflow.

## Open questions

What's still undecided or worth revisiting.
