# Design

This document defines what the salon booking system does and how it behaves. The technical design is in [ARCHITECTURE.md](ARCHITECTURE.md).

Values marked **(assumed)** are sensible defaults I chose. They are not yet confirmed by the salon and should be reviewed before launch.

## 1. Product goals

1. A customer can book a service with a chosen or available staff member in under two minutes, on a phone.
2. The salon never double books a staff member.
3. Staff know their day at a glance without asking the owner.
4. The owner can change services, prices and hours without a developer.
5. Fewer no-shows, through timely reminders and easy rescheduling.

## 2. Users and jobs

### Customer
- Find a service and see its price, duration and whether payment is needed now
- Choose a specific stylist or "anyone available"
- Pick a date and time from real availability
- Enter name, email and phone, and pay if the service requires it
- Get a confirmation and reminders
- Reschedule or cancel without calling the salon, within the cancellation rules

### Staff member
- See today's and this week's bookings
- Set regular working hours and add time off
- Mark a booking as completed or no-show
- See customer notes for the booking (not the full history in v1)

### Owner
- Everything staff can do, for all staff
- Manage services: name, description, duration, buffer, price, payment mode, active or hidden
- Manage staff and which services each person performs
- Set opening hours and booking rules
- Issue refunds
- See weekly bookings, revenue and no-show rate
- Receive a daily summary

## 3. Terminology

| Term | Meaning |
|---|---|
| Service | Something a customer can book, such as a cut and blow-dry |
| Staff | A person who performs services |
| Slot | A possible start time for a booking, e.g. 14:15 |
| Booking | A reserved time for one service with one staff member for one customer |
| Buffer | Time after a service that the staff member needs before the next client |
| Occupied time | Service duration plus buffer. The time a booking blocks |
| Time off | A period when a staff member is unavailable |
| No-show | A booking that was confirmed but the customer did not attend |
| Pending payment | A booking that is reserved while the customer completes payment |

Use these words consistently in the UI, emails, code and docs. Do not use "appointment" and "booking" interchangeably.

## 4. Booking rules

| Rule | Default | Status |
|---|---|---|
| Slot interval | 15 minutes | (assumed) |
| Minimum lead time | 2 hours before the start time | (assumed) |
| Maximum advance booking | 60 days | (assumed) |
| Customers per slot | 1 (one staff member, one client at a time) | Confirmed by scope |
| Cancellation without charge | Up to 24 hours before the start time | (assumed) |
| Late cancellation or no-show fee | Not in v1. Owner handles manually | (assumed) |
| Reschedule | Same rules as cancellation. Counts as cancel and rebook | (assumed) |
| Pending payment hold | 15 minutes, then the slot is released | (assumed) |
| Staff choice | Customer may choose a staff member or "anyone available" | Confirmed by scope |

### Payment modes per service

- **None:** booking is confirmed immediately. Price shown is paid in salon.
- **Pay now:** customer pays the full price at booking through Stripe. Booking is confirmed when payment succeeds.
- **Pay in salon:** no online payment. Price shown. Booking is confirmed immediately.

Refunds:
- Cancellation within the free window: full refund if paid online.
- Cancellation after the window, or no-show: no automatic refund. Owner may refund manually.

### Booking status

| From | To | Triggered by |
|---|---|---|
| (new) | `pending_payment` | Customer starts a pay-now booking |
| (new) | `confirmed` | Customer books a non-payment service |
| `pending_payment` | `confirmed` | Stripe payment succeeds |
| `pending_payment` | `cancelled` | Hold expires, or customer abandons |
| `confirmed` | `completed` | Staff or owner marks it done |
| `confirmed` | `no_show` | Staff or owner marks it |
| `confirmed` | `cancelled` | Customer or owner cancels |

A completed, no-show or cancelled booking never returns to an active status. Rescheduling creates a new booking and cancels the old one, so the history stays clear.

## 5. Core flows

### 5.1 Customer books a service

1. **Choose service.** List of active services, grouped by category. Each shows name, duration and price.
2. **Choose staff.** Photos and names of staff who perform the service, plus "anyone available". Skipped if only one person offers the service.
3. **Choose time.** Calendar with dates that have availability. Times shown for the selected day. Times in Europe/London.
4. **Your details.** Full name, email, phone. Marketing consent checkbox, unticked by default.
5. **Review and pay.** Summary with service, staff, date, time, price. If pay now, go to Stripe Checkout. Otherwise confirm.
6. **Confirmation.** Page with booking details, an "add to calendar" file, and a link to manage the booking. Confirmation email sent.

If a slot is taken while the customer is deciding, show a message and return to the time step with the next available times. Do not show a generic error.

### 5.2 Customer manages a booking

- Link in the email opens the booking page without login.
- Shows details, the cancellation deadline, and buttons to reschedule or cancel.
- Cancellation after the deadline is still allowed but shows the no-refund message before confirming.

### 5.3 Staff manages their day

- Default view: today's list in time order, with customer name, service, and status.
- Tapping a booking shows details and actions: mark completed, mark no-show, cancel.
- Working hours screen: weekly grid, edits apply from a chosen date forward.
- Time off: pick a date range and reason. Existing bookings in that range are listed and must be moved or cancelled by the owner.

### 5.4 Owner sets up the salon

1. Create services.
2. Add staff and link them to services.
3. Set working hours per staff member.
4. Set booking rules in settings.
5. Make the booking page live.

Setup should be possible without developer help. Show a checklist on the dashboard until the basics are complete.

## 6. Notifications

| Message | Channel | When | Content |
|---|---|---|---|
| Booking confirmed | Email | Immediately | Service, staff, date, time, address, manage link |
| Reminder | Email | 24 hours before | Same as above, plus cancellation deadline |
| Reminder | SMS | 2 hours before | Date, time, salon phone number, short link to manage |
| Cancelled | Email | Immediately | What was cancelled, rebook link |
| Payment receipt | Email | On payment | Amount, booking reference |

SMS messages are kept short and include the salon name. They never include prices or personal details beyond the first name.

Timing for reminders is **(assumed)**. Customers can opt out of SMS reminders, but not email confirmations about their booking.

## 7. UI principles

- **Mobile first.** Most customers book from a phone. Design for 375px width first.
- **One decision per screen** in the booking flow. Progress is always visible.
- **Show the total early.** Price and duration appear at service selection and stay visible through checkout. No surprises at payment.
- **Times in local time.** Always show Europe/London and never ask the customer which time zone they are in.
- **Clear unavailable states.** Dates with no availability are disabled with an explanation, not hidden.
- **Accessible by default.** WCAG 2.2 AA contrast, keyboard operable, labels on every field, errors linked to fields, touch targets at least 44 by 44 pixels.
- **Calm visual style.** Warm neutral palette, one accent colour, generous whitespace. Photography of the salon and staff where available. Exact brand to be defined.

## 8. Content and tone

- UK English spelling throughout (colour, licence, organise).
- Friendly and direct. "Your booking is confirmed" rather than "Your appointment has been successfully scheduled".
- Use "you" for the customer and the salon name for the business.
- Error messages say what happened and what to do next. Example: "That time was just taken. Choose another time below."
- Prices in GBP with the pound sign, shown as £35 or £35.50. No trailing zeros on whole pounds.
- Dates written as "Saturday 7 March, 2:15pm".

## 9. Empty and error states

| Situation | What the user sees |
|---|---|
| No availability on a date | Date greyed out. Message: "No times left on this day." |
| No availability at all in the next 60 days | "We're fully booked for now. Join the waiting list or call us on [number]." Waiting list is out of scope for v1, so show the phone number only. |
| Payment failed | Stay on the review step. "Payment didn't go through. Try another card." |
| Payment succeeded but booking not confirmed yet | "We're confirming your payment. This usually takes a few seconds." Refresh automatically. |
| Booking link expired or invalid | "This link has expired. Find your booking by calling us on [number]." |
| No staff yet for a service | Service hidden from the booking page. Owner sees a warning in admin. |

## 10. Out of scope for v1

- Waiting list
- Loyalty points and memberships
- Gift vouchers
- Deposits (partial payment)
- Multiple locations
- Staff commission reports
- Product sales and stock
- Customer self-service accounts with booking history
- Multi-language UI

## 11. Open questions

- Confirm opening hours, staff list and services with the salon.
- Confirm cancellation window and fee policy.
- Confirm reminder timings and whether SMS is wanted at launch.
- Will the salon want a waiting list in the first year?
- Is there an existing booking system with customers to import?
- Brand: name, logo, colours, photography.
