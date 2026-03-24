# Delegate Gap Analysis

## Goal Baseline

Target product:

- Telegram-only public representative
- founder representative first
- public knowledge only
- safe skills only
- handoff + paid continuation
- a real owner can publish and run it without hardcoded demo data

## What Is Already Working

### Core foundation

- Telegram bot runtime with private chat and conservative group gating
- public representative page
- owner dashboard with handoff and invoice snapshots
- Action Gate boundary model
- Postgres persistence for conversations, contacts, invoices, handoffs, and wallet state
- Telegram Stars invoice creation and payment confirmation writeback
- ClawHub skill discovery, install, and enable flow
- Dockerized local stack

### Product behaviors already present

- FAQ-ish reply path
- paid unlock path with `Free / Pass / Deep Help / Sponsor`
- owner inbox creation for human handoff
- sponsor pool accounting
- mention / reply group handling policy

## What Is Only Partially Done

### Deep-service skills exist mostly as routing, not real workflows

- lead qualification is inferred from intent keywords, but not yet a structured owner-tunable flow
- quote request collection is classified, but not yet a dedicated multi-step collector with accept / reject / paid-consult outcomes
- scheduling is classified, but not yet a scheduling intent workflow with candidate windows
- material delivery is modeled, but not yet a first-class deliverable workflow with tracked sends and downloadable asset management

### Analytics exists as an inbox snapshot, not an operator console

- current dashboard shows counts, recent invoices, and handoffs
- it does not yet show FAQ gaps, source conversion, paid vs free funnel, lead list quality, or "worth owner time" ranking

## Highest-Impact Missing Pieces

### 1. Real owner setup and representative publishing

Current state:

- the product still centers on one hardcoded demo representative
- there is no owner-facing setup flow to create or edit a representative end to end
- public page and bot behavior still depend on demo defaults instead of a fully editable persisted representative

Why this matters:

- without this, we cannot honestly say an owner can publish a representative in 15 minutes
- it blocks almost every success metric because the system is still a demo shell

### 2. Public knowledge pack management

Current state:

- knowledge pack lives in seeded demo data
- there is no dashboard workflow to edit identity summary, FAQ, materials, policies, pricing, or handoff copy

Why this matters:

- "public knowledge first" is the product's core safety and trust principle
- until owners can manage this themselves, the trust interface is not real

### 3. Structured deep-service workflows

Current state:

- the bot can route to intake, pricing, and scheduling categories
- but it does not yet run structured multi-turn forms and produce operator-grade structured outputs

Missing workflows:

- quote request collector
- scheduling intent collector
- richer handoff summary with "should the owner take this?"
- paid priority uplift after purchase

### 4. Operator analytics beyond inbox

Current state:

- dashboard is useful, but still narrow

Missing:

- FAQ gap analysis
- free vs paid funnel
- source attribution and group-to-private conversion
- best leads list
- repeated paid usage visibility

## Recommendation

The next build should be:

`Owner Setup + DB-backed Representative Runtime`

This is the narrowest lake with the highest leverage because it upgrades the repo from a polished demo into a publishable founder-representative system.

## Proposed Delivery Order

### Slice A

- owner setup editor for representative basics
- knowledge pack editor
- pricing / contract editor
- public page reads persisted representative data

### Slice B

- bot reads persisted representative config instead of hardcoded demo data
- reply copy, free limits, plans, and handoff wording all come from DB

### Slice C

- structured quote and scheduling collectors
- richer owner handoff summary
- priority uplift after paid unlock

### Slice D

- source attribution and deeper analytics
- FAQ gap dashboard
- group-to-private conversion tracking
