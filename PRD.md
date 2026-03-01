# Product Requirements Document (PRD)

## Product Name

**PolicyTracker** (placeholder)

---

## 1. Problem Statement

Insurance agents in India manage policies from multiple insurers and across multiple insurance types (life, health, motor, etc.).
They are responsible for tracking policy expiries and ensuring timely renewals to avoid:

* Loss of commission
* Client dissatisfaction
* Policy lapses

Today, most agents rely on:

* Handwritten diaries
* Excel sheets
* WhatsApp reminders to self

These methods **do not scale**, are error-prone, and lead to missed or late renewals.

---

## 2. Target Users

### Primary Users

* Independent insurance agents
* Small insurance agencies (1–5 staff)
* Mid-sized agencies (5–15 staff)

### Secondary Users

* Agency staff handling renewals and follow-ups
* Agency owners needing visibility and control

---

## 3. Goals & Success Metrics

### Business Goals

* Reduce missed renewals
* Increase renewal follow-up discipline
* Become the daily “opening app” for agents
* Enable agents to manage more policies with the same staff

### Success Metrics

* % of agents logging in weekly
* % of policies with renewal status updated
* Reduction in expired-without-action policies
* Retention after 3 and 6 months

---

## 4. Non-Goals (Explicitly Out of Scope for V1)

* Insurance quote generation
* Insurer integrations
* Payment collection
* Claim management
* Consumer marketplace
* Lead generation

This product focuses **only on policy tracking and renewals**.

---

## 5. Core User Jobs To Be Done

1. “I want to know which policies are expiring soon.”
2. “I want to follow up with clients on time.”
3. “I don’t want to miss renewals even when I’m busy or on leave.”
4. “I want my staff to clearly know what they should work on today.”
5. “I want all policy data in one place, not across files.”

---

## 6. Key Features (V1)

### 6.1 Agency & User Management

* An agency account represents one insurance business
* Agency can have one or more users (owner, staff)
* Owner has full visibility across all policies and staff activity
* Users log in using **WhatsApp number + OTP** (no passwords in V1)

---

### 6.2 Client Management

* Add and edit clients
* Store basic contact details
* Optional grouping of family members under one household
* One client can have multiple policies

---

### 6.3 Policy Management

* Add policies with:

  * Insurance type
  * Insurance company
  * Policy number
  * Start date
  * Expiry date
  * Optional premium amount
* Policies are always owned by an agency
* Policies can be assigned to a staff member

---

### 6.4 Expiry Dashboard (Primary Screen)

This is the **main value surface** of the product.

* Shows policies grouped by:

  * Expiring in 0–7 days
  * Expiring in 8–30 days
  * Expiring in 31–60 days
  * Already expired
* Sorted by urgency (nearest expiry first)
* Quick actions:

  * Call client
  * Message client
  * Mark renewal status

This dashboard should answer:

> “What should I work on today?”

---

### 6.5 Renewal Status Tracking

Each policy supports lightweight renewal states:

* Active
* Renewal in progress
* Renewed
* Lost
* Expired

Agents can update status as they work, without heavy workflows.

---

### 6.6 Reminders & Follow-Ups (Agent-side)

* Daily view of upcoming renewals
* Optional reminder rules (e.g., 30 / 15 / 7 / 1 days before expiry)
* Focus is on reminding the **agent**, not automating the relationship

---

### 6.7 Document Storage (Basic)

* Upload policy documents and renewal copies
* Documents are attached to a client or policy
* Easy retrieval during renewal calls

---

### 6.8 Import from Existing Data

To reduce adoption friction:

* Import policies from Excel or CSV
* Simple mapping of columns
* Clear error feedback for invalid rows

This is critical for onboarding.

---

## 7. User Experience Principles

* Mobile-first
* Minimal data entry
* No insurance jargon overload
* Fast access to “what’s expiring”
* Works well even for low-tech users

The app should feel like:

> “A digital version of my renewal diary — but smarter.”

---

## 8. Permissions & Roles

### Owner

* Full access to all data
* View all staff workloads
* Manage users and settings

### Staff

* View and manage assigned policies
* Update renewal statuses
* Add notes and documents

---

## 9. Pricing & Packaging (Guiding Assumptions)

* Entry-level plan for solo agents
* Higher tiers for agencies with staff
* Pricing should feel justified by:

  * Avoided missed renewals
  * Reduced manual tracking
  * Better staff productivity

This product is positioned as **staff amplification**, not staff replacement.

---

## 10. Risks & Mitigations

### Risk: Low willingness to pay

**Mitigation:**
Start with low-friction pricing and grow into agency plans.

### Risk: Agents don’t maintain data

**Mitigation:**
Make the expiry dashboard valuable even with minimal updates.

### Risk: App becomes “extra work”

**Mitigation:**
Design workflows that replace Excel/diaries, not add on top.

---

## 11. Future Enhancements (Post-V1)

* Client self-service portal
* Automated client reminders
* Commission tracking
* Renewal analytics and insights
* Multi-branch agency support
* Branded client communication

---

## 12. Product North Star

> **Never let an insurance agent miss a renewal because of poor tracking.**
