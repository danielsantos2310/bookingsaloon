# Design system

This document defines the shared parts every screen is built from: colours, type, spacing, and components, with their states and rules. The screens are listed in [screens.md](screens.md). The brand options are in [brand.md](brand.md).

**Status: provisional.** The values use Option A (Blush and Espresso) from brand.md, the recommendation, until a direction is chosen. Components refer to tokens by role, not by colour, so changing the palette changes only the token values.

## 1. Principles

1. **Tokens, not values.** Components use semantic tokens such as `color.text.primary`, never a hex code. A hex value appears only in the token file.
2. **One component for each job.** If two screens need a button, they use the same button.
3. **Colour is never the only signal.** Every status, error and selected state also has text, an icon or a shape.
4. **Mobile first.** Every component is designed at 375px before anything wider.
5. **Accessible by default.** WCAG 2.2 AA is the baseline. Components that fail it are not used.

## 2. Colour tokens

### Brand and surfaces

| Token | Value (Option A) | Use |
|---|---|---|
| `color.bg.page` | `#FBF7F4` | Page background |
| `color.bg.surface` | `#FFFFFF` | Cards, forms, dialogs |
| `color.bg.subtle` | `#F3EEEA` | Table stripes, grouped sections |
| `color.bg.selected` | `#F3E6E1` | Selected card background (always paired with a border and icon) |
| `color.text.primary` | `#2B211E` | Body text, headings. 14.7 : 1 on page |
| `color.text.secondary` | `#6B5B55` | Captions, helper text. 6.1 : 1 on page |
| `color.text.onPrimary` | `#FFFFFF` | Text on primary buttons. 5.2 : 1 |
| `color.primary` | `#9C5B4A` | Primary buttons, links, focus ring |
| `color.primary.hover` | `#86493B` | Hover state for primary buttons |
| `color.accent.decor` | `#D9A441` | Dividers and decorative icons only. Never text or essential UI |
| `color.border.input` | `#8C7B73` | Input borders. 3.8 : 1 on page, meets 3:1 |
| `color.border.subtle` | `#E8DED9` | Dividers between content (decorative, not required for meaning) |
| `color.focus` | `#9C5B4A` | Focus ring, 2px, 2px offset. 4.9 : 1 on page |

### Feedback and status

Each status has a text colour and a tinted background. Badges always show the label text and an icon.

| Token | Text | Background | Contrast | Meaning |
|---|---|---|---|---|
| `status.confirmed` | `#1F5C3A` | `#E3F1E8` | 6.8 : 1 | Booking confirmed |
| `status.pending` | `#6B4300` | `#FBEFD6` | 7.6 : 1 | Pending payment |
| `status.completed` | `#3A3550` | `#E9E7EF` | 9.5 : 1 | Visit completed |
| `status.noShow` | `#9A2A1B` | `#FBE5E1` | 6.4 : 1 | Customer did not attend |
| `status.cancelled` | `#5B5668` | `#EDEBF0` | 6.0 : 1 | Booking cancelled. Label is struck through in lists |
| `feedback.error` | `#B42318` | `#FFFFFF` (text on surface) | 6.6 : 1 | Field errors, failed actions |
| `feedback.success` | `#1F5C3A` | `#FFFFFF` (text on surface) | 7.9 : 1 | Saved, sent, confirmed |

Icons for status: confirmed (check circle), pending (clock), completed (tick), no-show (cross in circle), cancelled (slashed circle). The labels are always visible; no icon-only status.

## 3. Typography

Two families. Fraunces is used only for the logo, page titles and the price on the review screen. Inter is used for everything else.

| Token | Family | Size (mobile) | Size (desktop) | Weight | Line height |
|---|---|---|---|---|---|
| `type.display` | Fraunces | 32px | 40px | 600 | 1.2 |
| `type.title` | Fraunces | 26px | 30px | 600 | 1.2 |
| `type.heading` | Inter | 20px | 22px | 600 | 1.3 |
| `type.subheading` | Inter | 17px | 18px | 600 | 1.4 |
| `type.body` | Inter | 16px | 16px | 400 | 1.5 |
| `type.small` | Inter | 14px | 14px | 400 | 1.5 |
| `type.label` | Inter | 14px | 14px | 500 | 1.4 |
| `type.price` | Fraunces | 20px | 24px | 600 | 1.2 |

Rules:
- Body text is never below 16px on a phone. Inputs are 16px or larger, which also stops iOS zooming on focus.
- Prices and times use tabular figures (`font-variant-numeric: tabular-nums`) so columns line up.
- Long text measures no wider than 70 characters.
- Text is never centred in paragraphs. Short labels and buttons may be centred.

## 4. Spacing, shape and layout

### Spacing scale (4px base)

`space.1` 4px, `space.2` 8px, `space.3` 12px, `space.4` 16px, `space.5` 24px, `space.6` 32px, `space.7` 48px, `space.8` 64px.

- Screen edge padding: 16px on phones, 24px on tablets, 32px on desktop.
- Space between related items: `space.2` or `space.3`. Between sections: `space.5` or `space.6`.

### Shape

| Token | Value | Use |
|---|---|---|
| `radius.control` | 8px | Buttons, inputs, selects |
| `radius.card` | 12px | Cards, dialogs |
| `radius.pill` | 999px | Badges, tags |

### Elevation

One shadow, used only for dialogs and the floating action bar: `0 8px 24px rgba(43, 33, 30, 0.12)`. Cards use a 1px `color.border.subtle` border instead of a shadow.

### Breakpoints

| Name | Width | Layout |
|---|---|---|
| Phone | 0 to 639px | Single column. Bottom action bar in booking flow |
| Tablet | 640px to 1023px | Two columns for lists and forms where useful |
| Desktop | 1024px and up | Admin uses a sidebar. Booking flow centred at 480px wide |

### Touch and target size

- Every tappable control is at least 44 by 44px, including small icon buttons and table row actions.
- Gap between adjacent tap targets is at least 8px.

## 5. Components

Each component lists its variants, states and rules. States are: default, hover (desktop only), focus, active, disabled, loading, error (where relevant).

### 5.1 Button

| Variant | Use | Style |
|---|---|---|
| Primary | One per screen: the main action (Continue, Confirm, Save) | Filled `color.primary`, white text |
| Secondary | Other actions (Back, Edit) | Outlined, 1px `color.primary` border, primary text |
| Ghost | Low-emphasis (Cancel, Skip) | Text only, primary text, underline on hover |
| Destructive | Cancel booking, remove service | Filled `feedback.error`, white text. Always behind a confirmation dialog |

- Sizes: standard 48px high (default on phones), compact 40px high (admin tables only, still 44px tap area).
- Full width on phones for the main action.
- Loading: label replaced with a spinner and "Saving…". Button disabled while loading. Width does not change.
- Disabled: 40% opacity, cursor not allowed, and the reason shown nearby in text. Disabled buttons are never the only way to see why an action is blocked.
- Labels are verbs: "Confirm booking", "Save changes", "Cancel booking". Never "OK" or "Submit".

### 5.2 Text field

- Label is always visible above the field. Placeholder text is an example only, never the label.
- Border `color.border.input`, 1px, 2px on focus in `color.focus`.
- Height 48px. Padding 12px 16px.
- Helper text below the field in `type.small`, `color.text.secondary`.
- Error: border becomes `feedback.error`, an error icon and the message in text below. The message explains what to do: "Enter an email like name@example.com".
- Required fields are marked "(required)" in the label, or the form says "All fields are required" at the top. Do not use only an asterisk.
- Optional fields are marked "(optional)" in the label.
- Autocomplete and keyboard hints are set: `name`, `email` (type email), `tel` (type tel), `one-time-code` for sign-in codes.

### 5.3 Select, checkbox and radio

- Select: same size and border as text field. Native select on phones.
- Checkbox and radio: 24px visual, 44px tap area. Label is clickable.
- Marketing consent checkbox: unticked by default, label states exactly what they agree to.

### 5.4 Toggle

Used for reminder settings and staff active or inactive state.

- Label on the left, toggle on the right. Label states the setting ("Email reminder 24 hours before"), not "On/Off".
- Shows "On" or "Off" as text next to the switch, so state is not only colour.
- Changes save immediately with a short confirmation.

### 5.5 Choice card

Used for choosing a service, a staff member or a time on phones where a list would be long.

- Padding 16px. Border 1px `color.border.subtle`.
- Selected: 2px border in `color.primary`, `color.bg.selected` background, check icon at the top right, and `aria-checked` set. The check icon means selected is never shown by colour alone.
- Hover (desktop): border `color.border.input`.
- Focus: focus ring as in section 6.

### 5.6 Service card

- Image at 4:3 (optional, placeholder if missing), name in `type.subheading`, one line description, duration and price below.
- Payment label shown as a small tag: "Pay now" or "Pay in salon".
- Whole card is a single link or button. Not nested links.
- If a service is fully booked for the next 60 days, the card shows "Fully booked" as a badge and is still tappable to see the message.

### 5.7 Staff card

- Circular photo 56px, or initials on `color.bg.subtle` if there is no photo. Alt text is the person's name.
- Name in `type.subheading`. Optional one-line role.
- "Anyone available" is a separate card at the top of the list, with an icon of two people.

### 5.8 Date picker

The most complex component. It must work with keyboard and screen reader.

- Month grid with weekday headings (Mon to Sun, as the salon's week starts Monday in the UK). Week numbers not shown.
- Each day cell is at least 44 by 44px.
- Dates with availability: normal text, tappable.
- Dates with no availability: greyed out, with an explanation text above the grid ("No times left on Sunday 25 October" when a day is selected, or "Closed on Mondays" for closed days). Not hidden, so the layout does not jump.
- Dates beyond 60 days or before the minimum notice are disabled with the same treatment.
- Today is marked with a dot below the number and the label "today" for screen readers.
- Selected date: filled `color.primary`, white text, `aria-selected` set.
- Keyboard: arrow keys move between days, Page Up and Page Down change month, Enter selects.
- Previous and next month buttons are 44px and labelled ("Previous month, September").

### 5.9 Time slot picker

- Shown after a date is picked. Heading: "Times on Saturday 7 March".
- Grid of buttons, 3 columns on phones, 4 on tablets. Each button 48px high.
- Only free times are shown. Taken times are not shown at all, so there are no dead buttons.
- Selected time: filled `color.primary`.
- If no times are free, the picker shows "No times left on this day" and the nearest days with availability as buttons.
- Times are always Europe/London. The label "Times in UK time" appears once above the grid.

### 5.10 Status badge

- Pill shape, `radius.pill`, `type.label` text, 4px 10px padding.
- Icon 16px to the left of the label.
- Used in lists and detail screens. In tables on phones, the badge stays visible and the rest of the row collapses.

### 5.11 Notice and alert

For messages that stay on the page.

| Variant | Colour | Icon | Use |
|---|---|---|---|
| Info | `color.text.primary` text on `color.bg.selected` (12.9 : 1). Primary colour is not used for body text on tints, as it reaches only 4.3 : 1 | Information | Helpful context, e.g. cancellation rule |
| Success | `feedback.success` on `status.confirmed` tint | Check | Saved, confirmed |
| Warning | `status.pending` text on `status.pending` tint | Triangle | Something needs attention |
| Error | `feedback.error` text on `#FDECEA` | Cross in circle | Something failed, with what to do next |

Notices have a heading only when the message is more than one sentence. Errors receive focus when they appear, so screen reader users hear them.

### 5.12 Dialog (modal)

- Used for confirmations only: cancel booking, remove service, refund.
- Title states the action ("Cancel this booking?"). Body states what will happen, including any refund. Two buttons: secondary on the left ("Keep booking"), destructive on the right ("Cancel booking").
- Focus moves into the dialog on open, returns to the trigger on close. Escape closes.
- On phones, the dialog is a bottom sheet with the buttons full width.

### 5.13 Toast

Short confirmations in the admin area only ("Service saved"). Shown for 4 seconds, with a close button. Errors never use toasts; they stay in the form as a notice. Toasts are announced politely to screen readers.

### 5.14 Table and list

- Admin tables on desktop: sticky header, row height 56px, right-aligned numbers, left-aligned text.
- On phones, tables become a list of cards: the primary field (customer name or service) at the top, then status badge, then the other fields as label and value pairs.
- Sorting controls are buttons in the header with `aria-sort`. Filters appear above the table as chips that can be removed.

### 5.15 Stepper (booking flow)

- Text first: "Step 2 of 4: Choose a time". The progress bar is decorative and sits below the text.
- Steps: Service, Staff, Time, Details, Review. The pay-now flow adds Payment.
- Back is always available except on the confirmation screen.

### 5.16 Bottom action bar (booking flow, phones)

- Fixed to the bottom of the screen, with a 1px top border and the surface background.
- Left: total price and duration ("£35 · 45 min"). Right: primary button ("Continue").
- Respects the device safe area at the bottom.
- Hidden when the keyboard is open, so it does not cover the field being typed in.

### 5.17 Empty and loading states

- Empty: a short sentence, what to do next, and one button. Copy from DESIGN.md section 9.
- Loading: skeleton blocks matching the layout, not a centred spinner, for lists and cards. Spinners only inside buttons.
- Loading longer than 3 seconds shows "Still loading…" beneath the skeleton.

### 5.18 Navigation

| Area | Pattern |
|---|---|
| Customer site | Top bar with logo (left) and "Manage booking" link (right). No menu |
| Staff, phone | Bottom tab bar with 3 items: Today, Week, Account |
| Owner, desktop | Left sidebar: Dashboard, Calendar, Bookings, Services, Staff, Hours, Time off, Customers, Reports, Messages, Payments, Settings |
| Owner, phone | Bottom tab bar: Dashboard, Calendar, Bookings, More (opens the rest as a list) |

The current item has `aria-current="page"` and a 2px indicator in `color.primary`.

## 6. Focus, keyboard and motion

- Focus ring: 2px solid `color.focus` with a 2px offset, on every interactive element. Never removed.
- Tab order follows the visual order. Skip link "Skip to main content" is the first focusable element on every page.
- All components are operable with keyboard alone.
- Motion: 150ms for hover and focus, 200ms for panels and dialogs. Nothing loops. `prefers-reduced-motion` removes all transitions except focus rings.

## 7. Imagery and icons

- One icon set only. Stroke icons, 24px default, 16px inside badges, 2px stroke weight.
- Icons next to text are decorative (`aria-hidden`). Icons alone (buttons with no text) must have an accessible name.
- Photos: staff and service photos are optional. Every image has alt text. Alt text is the person's name or the service name, not "photo of…".
- No stock photos of people that suggest a real staff member.

## 8. Copy rules for components

- Buttons: verbs, specific ("Confirm booking", not "Submit").
- Errors: say what happened and what to do next, in the words in DESIGN.md section 8.
- Dates and times: "Saturday 7 March, 2:15pm". Prices: "£35" or "£35.50".
- Never use "appointment" in the interface. Use "booking" (see DESIGN.md section 3).

## 9. Testing checklist for components

Each component is checked before it is used on a screen:

- [ ] Works at 375px width with no horizontal scrolling
- [ ] Touch targets are 44px or larger
- [ ] Every state (default, focus, disabled, error, selected, loading) is designed
- [ ] Focus ring visible and tab order correct
- [ ] Works with the keyboard alone
- [ ] Labels are read correctly by a screen reader
- [ ] Contrast meets WCAG 2.2 AA for text and for UI boundaries
- [ ] Status and selection are shown with more than colour
- [ ] Works with `prefers-reduced-motion` on
- [ ] Copy follows section 8

## 10. Implementation notes (for Milestone 1)

- Tokens are defined once in a token file, then exposed as CSS custom properties. Components use the custom properties only.
- The component library uses Tailwind for layout and spacing, with the tokens mapped into its theme so class names read as roles (for example `text-primary`, not `text-[#2B211E]`).
- Accessible primitives (dialog, select, tabs, date picker) come from a headless library, so focus handling and keyboard support are not hand-built. Confirm the library choice in an ADR when Milestone 1 starts.
- Fonts: Fraunces and Inter from a single Google Fonts request with `display=swap`.

## 11. Open decisions

- Confirm the palette (depends on the brand direction).
- Choose the icon set (for example Lucide or Phosphor) and the headless component library, in an ADR.
- Decide whether the owner's calendar on phones uses a day view only (recommended) or also a week view.
