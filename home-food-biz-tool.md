# Home Food Business Ops Tool — Idea Brief

> Problem: Home bakers, tiffin services, and small food businesses run their entire operation through WhatsApp, scattered UPI apps, and memory. No tool exists at their price point and simplicity level.

---

## Validation Approach

The goal is to answer three critical questions before writing a single line of code:

1. **Will they pay?** (₹299–499/month)
2. **Will their customers use a link instead of WhatsApp?**
3. **What is the one feature they cannot live without?**

### Phase 1 — Find and Listen (Week 1–2)

**Where to find them:**
- Instagram: search `#homebaker`, `#homemadecakes`, `#tiffinservice` + your city
- Facebook groups: "Home Bakers Network India", city-specific food groups
- Local: ask around — almost every building in a metro has someone running a tiffin service

**What to do:**
- DM 20–30 home bakers/tiffin services with a simple message:
  > "Hi! I'm building a simple tool for home food businesses. Not selling anything — just trying to understand how you manage orders. Can I chat for 15 minutes?"
- Aim for 8–10 conversations. Do them on a call or in-person, not over text.

**What to ask (in order):**
1. Walk me through how you take an order today — start to finish.
2. What's the most stressful part of your day?
3. Have you ever lost money or a customer because of a mistake in order tracking?
4. How do you know at the end of the day what you need to make tomorrow?
5. How do you track who has paid and who hasn't?
6. Have you tried any app or tool? Why did you stop?
7. If I built something that showed all your orders in one place and auto-reminded customers to pay — would that be useful? Would you pay ₹300/month for it?

**What you're listening for:**
- Emotional language ("it's a mess", "I lose sleep", "I've fought with customers over this")
- Specific lost money or customer stories — these are your strongest signals
- Hesitation on paying = you need a better pitch or a freemium model
- Surprising workarounds = tells you what they've already tried

---

### Phase 2 — Manual Concierge Test (Week 3–4)

Don't build anything yet. Run the product manually for 3–5 businesses.

**How it works:**

1. Create a **Google Form** per business — their menu, prices, delivery slots
2. Give them a shareable link — this is their "storefront"
3. Their customers place orders via the form
4. You (manually) WhatsApp the owner a daily summary: "Today's orders: 3 cakes, 2 brownie boxes. Unpaid: Priya ₹600"
5. Track payments in a shared Google Sheet

**What you're measuring:**
- Do customers actually use the form, or do they still WhatsApp directly?
- Does the owner look at the summary every day?
- Do they refer anyone else? (Strongest signal of value)
- After 2 weeks, do they say "I can't go back to doing it the old way"?

**Success criteria to move forward:**
- At least 3 out of 5 businesses use it consistently for 2 weeks
- At least 1 pays you something (even ₹100) or strongly commits to paying
- Customers use the link at least 50% of the time

---

### Phase 3 — Willingness to Pay Test (Week 5)

Before building, confirm pricing directly.

- Tell your concierge users: "I'm building this as a proper app. It'll cost ₹399/month. Would you pay?"
- Ask for a commitment — not a "yes", but: "Can I send you a payment link for the first month?"
- If 2 out of 5 pay in advance, you have enough signal to build.

**If they don't pay:** Go back to listening. Either the pain isn't sharp enough, the price is wrong, or you're solving the wrong problem.

---

### Key Risks to Validate

| Risk | How to test |
|---|---|
| Customers prefer WhatsApp over a link | Measure form usage % in concierge test |
| Owners too busy to adopt new tools | Measure daily active use in concierge test |
| Price too high | Test ₹199 vs ₹399 with different users |
| Problem is seasonal (festive only) | Talk to tiffin services — their demand is daily |

---

## MVP Map

Build only after validation signals are green. The MVP has one job: **replace the WhatsApp + notebook + UPI chaos with one mobile screen.**

### Core MVP Features (Build this, nothing else)

**1. Digital Menu / Storefront**
- Owner sets up: item name, price, photo (optional), available quantity per day
- Generates a shareable link (e.g., `tinyact.in/lokesh-bakes`)
- Owner can mark items as sold out in one tap
- Customers open the link in browser — no app install required

**2. Order Intake**
- Customer selects items, fills name + phone + delivery date/time + address
- Order lands instantly in owner's dashboard
- Owner gets a push notification per order
- Customer gets a WhatsApp confirmation (via WhatsApp Business API or a simple text)

**3. Orders Dashboard**
- Single screen: all orders for today and upcoming days
- Each order shows: customer name, items, amount, payment status, delivery time
- One-tap actions: Mark paid / Mark delivered / Cancel

**4. Daily Production Sheet**
- Auto-generated every morning: consolidated list of everything to make that day
- Example: "3x Chocolate Cake, 12x Tiffin (Priya, Rahul, Sneha...)"
- Shareable — owner can screenshot and send to a helper

**5. Payment Tracker**
- Mark orders as: Advance Paid / Pay on Delivery / Fully Paid
- One tap to send a WhatsApp reminder to unpaid customers
- Simple summary: "This week: ₹8,400 received, ₹1,200 pending"

**6. Capacity / Slot Control**
- Owner sets max orders per day
- Once full, storefront shows "Slots full for this date" automatically
- No manual intervention needed

---

### What is NOT in MVP

Deliberately excluded — do not build these until v2:

- Inventory / ingredient tracking
- Delivery route optimization
- Loyalty points / rewards
- In-app payments (just track, don't process)
- Analytics / charts
- Multiple staff accounts
- Ratings / reviews

---

### Tech Stack Recommendation

| Layer | Choice | Reason |
|---|---|---|
| Mobile app | React Native or Flutter | Single codebase, fast to build |
| Storefront (customer side) | Web (Next.js) | No install friction for customers |
| Backend | Firebase | Real-time, auth, push notifications — you already know it |
| WhatsApp notifications | WhatsApp Business API (360dialog or Interakt) | Affordable, reliable for India |
| Payments tracking | Manual (no processing) | Avoid RBI compliance complexity in v1 |

---

### MVP Build Scope — Honest Estimate

| Module | Complexity |
|---|---|
| Auth + onboarding | Low |
| Menu setup | Low |
| Storefront (web) | Medium |
| Order intake form | Low |
| Orders dashboard | Medium |
| Payment tracker | Low |
| Daily production sheet | Low |
| WhatsApp notification | Medium (API setup) |
| Capacity slots | Low |

Realistic solo build time: **6–8 weeks** with focused effort.

---

### Go-to-Market (Post-MVP)

- **Seed users**: Your 5 concierge test users become your first real users and case studies
- **Distribution**: Instagram DMs + home baker Facebook groups + word of mouth
- **Hook**: "First 3 months free" for early adopters who refer 2 others
- **Pricing**: ₹0 up to 30 orders/month → ₹399/month unlimited

---

## Decision Checkpoint

```
Week 1–2: Interviewed 8+ users → Clear pain confirmed?
              ↓ Yes
Week 3–4: Concierge test with 5 users → 3+ use it consistently?
              ↓ Yes
Week 5:   2+ users pay in advance?
              ↓ Yes
          → Build the MVP
          ↓ No at any step
          → Dig deeper before building
```

Do not skip steps. The biggest mistake is building before the signal is clear.

---

## Storefront UX

The storefront is the **customer-facing web page** — no app install, opens in browser. Owner shares a link like `tinyact.in/priya-bakes`. This is the most critical surface: if customers don't use it, the whole product fails.

**Design principles:**
- Mobile-first, always (customers are on phones, often slow 4G)
- Zero friction — no login, no account creation for customers
- Must feel trustworthy — this is a real business, not a random link
- Fast to load — under 2 seconds on 4G

---

### Screen 1 — Storefront Home (Menu Page)

```
┌─────────────────────────────┐
│  📷  [Business cover photo] │
│                             │
│  Priya's Bakes 🎂           │
│  Mumbai · Home Baker        │
│  ⭐ Taking orders           │
├─────────────────────────────┤
│  Order for:                 │
│  [Today] [Tomorrow] [Date▼] │
├─────────────────────────────┤
│  CAKES                      │
│  ┌───────────────────────┐  │
│  │ 📷  Chocolate Truffle │  │
│  │     ₹650 · 500g       │  │
│  │     Egg / Eggless     │  │
│  │              [+ Add]  │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 📷  Red Velvet        │  │
│  │     ₹700 · 500g       │  │
│  │         ░ SOLD OUT ░  │  │
│  └───────────────────────┘  │
│                             │
│  CUPCAKES                   │
│  ┌───────────────────────┐  │
│  │ 📷  Assorted Box (6)  │  │
│  │     ₹380              │  │
│  │              [+ Add]  │  │
│  └───────────────────────┘  │
│                             │
│                             │
│  ┌─────────────────────┐    │
│  │  🛒 View Order · 2  │    │  ← sticky bottom bar
│  └─────────────────────┘    │
└─────────────────────────────┘
```

**Interactions:**
- Tapping an item opens the Item Detail sheet (below)
- Sold out items are visible but greyed — builds trust, shows range
- Date selector at top filters availability — if owner has set capacity for a date, it auto-shows "Full" for that date
- Sticky "View Order" bar appears as soon as 1 item is added

---

### Screen 2 — Item Detail (Bottom Sheet)

```
┌─────────────────────────────┐
│  ▼ drag to close            │
│                             │
│  [      Large Photo       ] │
│                             │
│  Chocolate Truffle Cake     │
│  ₹650 · 500g                │
│                             │
│  Rich dark chocolate sponge │
│  with ganache frosting.     │
│  Made fresh to order.       │
│                             │
│  Customise:                 │
│  Egg or Eggless?            │
│  ○ Egg  ○ Eggless           │
│                             │
│  Write on cake? (optional)  │
│  ┌─────────────────────┐    │
│  │ Happy Birthday Rohan│    │
│  └─────────────────────┘    │
│                             │
│  Quantity:  [−] 1 [+]       │
│                             │
│  ┌─────────────────────┐    │
│  │    Add to Order     │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

**Interactions:**
- Customization fields are configured by the owner per item
- Quantity defaults to 1
- "Add to Order" updates the sticky bar count and closes the sheet

---

### Screen 3 — Order Cart

```
┌─────────────────────────────┐
│  ← Your Order               │
├─────────────────────────────┤
│  Chocolate Truffle Cake     │
│  Eggless · "Happy Bday"     │
│  ₹650              [−] 1 [+]│
│                             │
│  Assorted Cupcakes (6)      │
│  ₹380              [−] 1 [+]│
├─────────────────────────────┤
│  Delivery Date & Time       │
│  📅 Saturday, 29 Mar        │
│  🕕 6:00 PM                 │
├─────────────────────────────┤
│  Delivery or Pickup?        │
│  ● Delivery   ○ Pickup      │
├─────────────────────────────┤
│  Subtotal         ₹1,030    │
│                             │
│  ┌─────────────────────┐    │
│  │   Enter Details →   │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

**Interactions:**
- Only dates the owner has capacity for are selectable
- Time slots are preset by owner (e.g., 10am–12pm, 4pm–7pm)
- Delivery/Pickup toggle — if pickup, address field disappears in next screen

---

### Screen 4 — Customer Details

```
┌─────────────────────────────┐
│  ← Your Details             │
├─────────────────────────────┤
│  Name *                     │
│  ┌─────────────────────┐    │
│  │ Rohan Sharma        │    │
│  └─────────────────────┘    │
│                             │
│  WhatsApp Number *          │
│  ┌─────────────────────┐    │
│  │ +91 98765 43210     │    │
│  └─────────────────────┘    │
│                             │
│  Delivery Address *         │
│  ┌─────────────────────┐    │
│  │ 12B, Rosary Apts,   │    │
│  │ Bandra West, Mumbai │    │
│  └─────────────────────┘    │
│                             │
│  Special Instructions       │
│  ┌─────────────────────┐    │
│  │ Please don't ring..  │   │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  Payment                    │
│  ○ Pay on Delivery          │
│  ● Pay Advance via UPI      │
│    UPI ID: priya@okicici    │
│    [Copy UPI ID]            │
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │    Place Order ✓    │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

**Interactions:**
- WhatsApp number used to send confirmation — make this clear to the customer
- UPI ID is owner-configured (no in-app payments, just share the ID)
- "Copy UPI ID" copies to clipboard so customer can open their UPI app
- "Place Order" is disabled until Name + Phone + Address are filled

---

### Screen 5 — Order Confirmation

```
┌─────────────────────────────┐
│                             │
│          ✅                 │
│   Order Placed!             │
│                             │
│  You'll get a WhatsApp      │
│  confirmation from Priya    │
│  shortly.                   │
│                             │
│  Order Summary              │
│  ─────────────────          │
│  Chocolate Truffle Cake  1  │
│  Assorted Cupcakes (6)   1  │
│  Total          ₹1,030      │
│  Delivery  Sat 29 Mar 6pm   │
│                             │
│  ┌─────────────────────┐    │
│  │  Order from a friend│    │  ← share the storefront
│  └─────────────────────┘    │
│                             │
│  Loved it? Share Priya's    │
│  store with a friend ↗      │
│                             │
└─────────────────────────────┘
```

**Interactions:**
- Owner gets a push notification the moment order is placed
- Customer gets a WhatsApp message: "Hi Rohan! Priya's Bakes confirmed your order..."
- "Share store" opens native share sheet with the storefront link — this is organic growth

---

### Storefront States (Edge Cases)

| State | What customer sees |
|---|---|
| Owner closed for today | "Not taking orders today. Check back tomorrow." |
| Date fully booked | That date is greyed out in the date picker |
| All items sold out | Banner: "Priya's menu is sold out for today" |
| Business on vacation | Custom message set by owner: "Back on 5th April!" |

---

## Onboarding Flow

**Goal:** Owner has a live, shareable storefront link in under 5 minutes. Don't ask for everything upfront — get them to the link fast, let them fill the rest later.

**Design principles:**
- One screen, one question
- Skip wherever possible
- Show progress — "Step 2 of 4"
- Celebrate completion loudly

---

### Step 0 — Landing / Sign Up

```
┌─────────────────────────────┐
│                             │
│   🧁 TinyAct for Food       │
│                             │
│   Get orders. Track pay.    │
│   No chaos.                 │
│                             │
│   Your WhatsApp number      │
│  ┌─────────────────────┐    │
│  │ +91 __________      │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │   Get OTP →         │    │
│  └─────────────────────┘    │
│                             │
│  No passwords. Ever.        │
└─────────────────────────────┘
```

**Why phone/OTP only:** These users are not email-first. They live on WhatsApp. Phone number is their identity. Password recovery adds friction they'll abandon.

---

### Step 1 — Business Name (1 of 4)

```
┌─────────────────────────────┐
│  ● ○ ○ ○    Step 1 of 4    │
│                             │
│  What's your               │
│  business called?           │
│                             │
│  ┌─────────────────────┐    │
│  │ Priya's Bakes       │    │
│  └─────────────────────┘    │
│                             │
│  Your storefront link:      │
│  tinyact.in/priyas-bakes    │  ← live preview as they type
│                             │
│  ┌─────────────────────┐    │
│  │      Next →         │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

**Key detail:** Show the storefront URL updating live as they type the name. This makes the link feel real and exciting — it's theirs. Triggers ownership psychology.

---

### Step 2 — Business Type (2 of 4)

```
┌─────────────────────────────┐
│  ● ● ○ ○    Step 2 of 4    │
│                             │
│  What do you make?          │
│                             │
│  ┌──────────┐ ┌──────────┐  │
│  │  🎂      │ │  🍱      │  │
│  │  Cakes & │ │  Tiffin  │  │
│  │  Bakes   │ │  Service │  │
│  └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐  │
│  │  🍪      │ │  🍽️     │  │
│  │  Snacks  │ │  Other   │  │
│  │  & More  │ │          │  │
│  └──────────┘ └──────────┘  │
└─────────────────────────────┘
```

**Why this matters:** Business type sets default menu category names and order flow. Tiffin services need "daily subscription" logic later; bakers need "custom order" logic. Capturing this early shapes the product experience.

---

### Step 3 — First Menu Item (3 of 4)

```
┌─────────────────────────────┐
│  ● ● ● ○    Step 3 of 4    │
│                             │
│  Add your first item        │
│  (you can add more later)   │
│                             │
│  Item name *                │
│  ┌─────────────────────┐    │
│  │ Chocolate Cake      │    │
│  └─────────────────────┘    │
│                             │
│  Price *                    │
│  ┌─────────────────────┐    │
│  │ ₹ 650               │    │
│  └─────────────────────┘    │
│                             │
│  Photo  [+ Upload]  (skip)  │
│                             │
│  ┌─────────────────────┐    │
│  │   Add Item →        │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

**Key detail:** Photo is optional and skippable. Don't block them here — they can add photos later. Name + price is enough to go live.

---

### Step 4 — You're Live! (4 of 4)

```
┌─────────────────────────────┐
│                             │
│          🎉                 │
│  Your store is live!        │
│                             │
│  tinyact.in/priyas-bakes    │
│  ┌─────────────────────┐    │
│  │  Copy Link          │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │  Share on WhatsApp  │    │
│  └─────────────────────┘    │
│                             │
│  ────── What's next ─────   │
│                             │
│  ☐ Add more menu items      │
│  ☐ Set daily capacity       │
│  ☐ Add your UPI ID          │
│                             │
│  ┌─────────────────────┐    │
│  │  Go to Dashboard →  │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

**Key details:**
- "Share on WhatsApp" pre-fills a message: "Hi! You can now order from my store here 👇 tinyact.in/priyas-bakes"
- The checklist is motivational, not a blocker — they can skip everything and go to dashboard
- Completion of this screen = owner has a live storefront. That's the win.

---

### Post-Onboarding — Dashboard First View

```
┌─────────────────────────────┐
│  Good morning, Priya 👋     │
│                             │
│  Today's Orders             │
│  ┌─────────────────────┐    │
│  │  No orders yet      │    │
│  │  Share your store   │    │
│  │  to get started →   │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │  📋 Menu (1 item)   │    │
│  │  💰 Set UPI ID      │    │
│  │  📦 Set capacity    │    │
│  └─────────────────────┘    │
│                             │
│  [Orders] [Menu] [Settings] │  ← bottom nav
└─────────────────────────────┘
```

**First-time empty state** shows the share prompt prominently — the most important action they can take is to share their link. Don't show empty charts or dead dashboards.

---

### Onboarding Flow Summary

```
Phone OTP
    ↓
Business Name + URL preview (live)
    ↓
Business Type (Baker / Tiffin / Other)
    ↓
First Menu Item (name + price, photo optional)
    ↓
🎉 Store is live — Share link
    ↓
Dashboard (empty state with clear next actions)
```

Total screens: 6
Target completion time: under 4 minutes
Drop-off risk: Step 3 (first menu item) — if they get stuck here, give a "Use a template" shortcut with pre-filled example items they can edit.
