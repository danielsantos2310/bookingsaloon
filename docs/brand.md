# Brand direction

This document proposes three directions for the look and feel of the salon booking system. Pick one, or combine parts of two. The chosen direction becomes the basis for the design system (step 6).

Nothing here is final. The salon's name, logo and colours are open until you choose.

## 1. Name

**Working name: Bellabooking.** This needs a decision before the brand is settled.

A product called "Bella Booking" already exists as salon booking software (listed on Capterra, GetApp and Software Advice). "Bellabooking" is close to it in name and in category, which risks confusion with customers and with that product.

Before committing to any name, check:
- UK trademark register (IPO) for the name in class 9 (software) and class 42 (online services)
- Domain availability for the name, and for a short alternative
- Social media handles

Options:
1. Keep a different name for the product and the salon brand separately, for example the salon keeps its own name and the product is called something neutral
2. Choose a new name. I can suggest candidates after you tell me the feel you want, and check each one before we use it
3. Keep Bellabooking if the trademark and domain checks come back clear

The rest of this document uses the placeholder name "Bellabooking" and works for any final name.

## 2. What the brand needs to do

- Feel like a salon: warm, personal, not clinical or corporate
- Be easy to read at small sizes, on phones and in SMS and email
- Look trustworthy for payments and personal data
- Meet WCAG 2.2 AA contrast for all text (DESIGN.md section 7)
- Work in light mode first. Dark mode is out of scope for v1

## 3. The three directions

### Option A: Blush and Espresso

Warm, classic and feminine. Feels like a well-kept salon with soft light and good materials. The serif headline gives it a boutique feel.

| Role | Hex | Use | Contrast |
|---|---|---|---|
| Background | `#FBF7F4` | Page background | Base |
| Surface | `#FFFFFF` | Cards, forms, modals | Base |
| Text | `#2B211E` | Body text, headings | 14.7 : 1 on background |
| Muted text | `#6B5B55` | Secondary text, captions | 6.1 : 1 on background |
| Primary | `#9C5B4A` | Buttons, links, selected states | 5.2 : 1 with white text |
| Accent | `#D9A441` | Decoration only (dividers, icons) | Not for text or essential UI |
| Border | `#8C7B73` | Input borders (3:1 minimum) | 3.8 : 1 on background |

- **Typography:** Fraunces (headings, serif) with Inter (body and interface)
- **Logo direction:** a wordmark in Fraunces with a small monogram of the first letter inside a thin circle. Works in one colour.
- **Best for:** a salon that wants to feel personal and high-end, with a strong female customer base
- **Risk:** serif headings can look dated if overused. Keep them to page titles and the logo.

### Option B: Sage and Stone

Calm, natural and spa-like. Quiet, uncluttered, and easy on the eye. Suits salons that focus on wellbeing and natural products.

| Role | Hex | Use | Contrast |
|---|---|---|---|
| Background | `#F6F7F3` | Page background | Base |
| Surface | `#FFFFFF` | Cards, forms, modals | Base |
| Text | `#1F2A24` | Body text, headings | 13.8 : 1 on background |
| Muted text | `#5C6B63` | Secondary text, captions | 5.2 : 1 on background |
| Primary | `#4E6B5C` | Buttons, links, selected states | 5.9 : 1 with white text |
| Accent | `#B98B4E` | Decoration only (dividers, icons) | Not for text or essential UI |
| Border | `#7F8C84` | Input borders (3:1 minimum) | 3.3 : 1 on background |

- **Typography:** DM Sans (headings and body). One family keeps it calm.
- **Logo direction:** a simple wordmark in DM Sans with a small leaf or line mark. Works in one colour.
- **Best for:** a natural or wellbeing-focused salon, mixed customer base
- **Risk:** can feel too quiet, and the green may read as "medical" if the design is too plain. Add warm photography to balance it.

### Option C: Noir and Gold

Modern and confident. High contrast, with a dark primary colour and gold used sparingly. Feels premium and a little bold, suits a salon with a modern, fashion-led identity.

| Role | Hex | Use | Contrast |
|---|---|---|---|
| Background | `#FFFFFF` | Page background | Base |
| Surface | `#F7F6FA` | Cards, forms, modals | Base |
| Text | `#17151F` | Body text, headings | 18.1 : 1 on background |
| Muted text | `#5E5A6B` | Secondary text, captions | 6.7 : 1 on background |
| Primary | `#1E1B2E` | Buttons, links, selected states | 16.8 : 1 with white text |
| Accent | `#C8923A` | Decoration only (dividers, icons) | Not for text or essential UI |
| Border | `#7A7490` | Input borders (3:1 minimum) | 4.4 : 1 on background |

- **Typography:** Manrope (headings and body). Geometric, clean, works well at large sizes.
- **Logo direction:** a bold wordmark in Manrope, with the gold accent on one letter or as a small underline. Works in one colour.
- **Best for:** a modern salon, or one aiming at a younger customer base
- **Risk:** very dark buttons can feel heavy on a beauty brand. Test on a phone in daylight.

## 4. Shared rules (apply to all three)

These come from the accessibility requirements, so they hold whichever option is chosen:

- **Accent colour is for decoration only.** It is too light to meet contrast for text or for essential UI. Never use it for an error, a link, a price or a button.
- **Input borders use the darker border colour**, not the light divider colour. Form fields must have a boundary that meets 3:1 against the background.
- **Focus ring:** a 2px outline in the primary colour, with an offset, visible on every interactive element. Never remove focus outlines.
- **Status colours** (confirmed, pending, cancelled, no-show, completed) are chosen in step 6, with text labels on every badge so colour is never the only signal.
- **Prices and times** use the text colour, never the accent.
- **Logo** appears in one colour on any background, with a reversed version for dark photography.

## 5. Typography rules (apply to all three)

- Body text: 16px minimum on phones, never smaller for prices or times
- Line height 1.5 for body, 1.2 for headings
- Headings no more than two sizes apart from body on mobile
- Numbers in prices and times use tabular figures, so columns align

## 6. Recommendation

**Option A (Blush and Espresso)** fits the brand's name best, since "Bella" suggests beauty and warmth, and the serif headings signal a salon rather than software. It also has the most room for the salon's own personality to come through.

Option B is the safest choice if the salon's clients are mostly wellbeing-focused. Option C is the best fit if the salon is a more modern, fashion-led brand.

This is my suggestion, not a decision. The salon's own look matters more than any of these.

## 7. What I need from you

1. **Name:** keep Bellabooking after checking, or choose a new one. If new, tell me the words you want it to suggest.
2. **Direction:** A, B or C, or a mix.
3. **Salon look:** any photos of the salon, its current logo or website, or colours you already use.
4. **Customer:** who the main customers are (age, style). This affects the balance between warm and modern.

Once these are answered, step 6 builds the design system from the chosen palette: buttons, form fields, the date and time picker, status badges, and the mobile layout rules.
