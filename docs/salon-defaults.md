# Salon defaults

This document lists the starting values for Bellabooking. Every value here is a **default** that the owner can change later in the admin area. Nothing in this list is fixed in code.

Working name: **Bellabooking**. The salon's own name, logo, and colours are still to be decided in the design phase.

Status key:
- **Default**: a starting value we chose. Change it in the admin area when the salon confirms or changes it.
- **Placeholder**: example data to be replaced with the salon's real data before launch.

## 1. Business details

| Item | Value | Status | Editable in admin |
|---|---|---|---|
| Business name | Bellabooking (working name) | Placeholder | Yes |
| Address | To be added | Placeholder | Yes |
| Phone | To be added | Placeholder | Yes |
| Email | To be added | Placeholder | Yes |
| Time zone | Europe/London | Default | No (fixed for v1) |
| Currency | GBP | Default | No (fixed for v1) |
| Prices include VAT | Yes. Shown prices are the final amount the customer pays | Default | Yes |

Prices including VAT is a default. If the salon is VAT-registered, this needs confirming with their accountant before launch.

## 2. Opening hours

Weekly pattern, editable per weekday. Each day can be open with start and end times, or closed.

| Day | Hours | Status |
|---|---|---|
| Monday | Closed | Default |
| Tuesday | 09:00 to 18:00 | Default |
| Wednesday | 09:00 to 18:00 | Default |
| Thursday | 09:00 to 20:00 | Default |
| Friday | 09:00 to 18:00 | Default |
| Saturday | 09:00 to 17:00 | Default |
| Sunday | Closed | Default |

Closures for holidays and one-off days are added as time off for the whole salon (applied to every staff member).

## 3. Services

Editable: name, description, duration, buffer, price, payment mode, active or hidden, order.

| Service | Duration | Buffer | Price | Payment | Status |
|---|---|---|---|---|---|
| Women's haircut | 45 min | 10 min | £35 | Pay in salon | Placeholder |
| Men's haircut | 30 min | 5 min | £20 | Pay in salon | Placeholder |
| Blow-dry | 30 min | 5 min | £25 | Pay in salon | Placeholder |
| Full colour | 120 min | 15 min | £70 | Pay in salon | Placeholder |
| Manicure | 45 min | 10 min | £25 | Pay in salon | Placeholder |

Payment mode defaults to **Pay in salon** for every service. Online payment (Pay now) is available per service and switched on in Milestone 4. No service requires a deposit in v1.

## 4. Staff

Editable: name, active or inactive, services offered, working hours, time off.

| Staff member | Services | Working hours | Status |
|---|---|---|---|
| Owner (placeholder name) | All services | Follows opening hours | Placeholder |

Add real staff in the admin area. A staff member can be marked inactive without deleting their past bookings.

## 5. Booking rules

Editable in admin, under Settings.

| Rule | Default | Status |
|---|---|---|
| Slot interval | Every 15 minutes | Default |
| Minimum notice | 2 hours before the start time | Default |
| Maximum advance booking | 60 days | Default |
| Free cancellation | Up to 24 hours before the start time | Default |
| Late cancellation or no-show | Owner handles manually. No automatic fee | Default |
| Reschedule rule | Same as cancellation | Default |
| Pending payment hold | 15 minutes | Default |
| Customers per time slot | One customer per staff member at a time | Fixed for v1 |
| Staff choice | Customer chooses a person or "anyone available" | Fixed for v1 |

## 6. Reminders and messages

| Message | Channel | Default timing | Status |
|---|---|---|---|
| Booking confirmation | Email | Immediately | Default, always on |
| Reminder | Email | 24 hours before | Default, on |
| Reminder | SMS | 2 hours before | Default, **off** until Twilio is set up (Milestone 5) |
| Cancellation | Email | Immediately | Default, always on |

The owner can turn each reminder on or off and change its timing. Confirmation and cancellation emails cannot be turned off, because customers need them.

Customers are never sent marketing messages by default. Marketing consent is unticked at booking.

## 7. Privacy

| Item | Default | Status |
|---|---|---|
| Customer record retention | 2 years after last visit, then anonymised | Default |
| Customers may request deletion | Yes, handled by the owner from the admin area | Default |

Retention period needs confirming against the salon's own policy before launch.

## 8. What the admin area must allow

Everything above is changed from the admin area without a developer:

- Edit business details and opening hours
- Add, edit, hide and remove services, including price changes
- Add, edit, deactivate and remove staff, and assign services to each person
- Set working hours per staff member, and add time off, including whole-salon closures
- Change booking rules and reminder timings
- Turn reminders on or off

Changes to prices or hours apply to new bookings only. Existing bookings keep the price and time they were made with.

## 9. Before launch

These items need real data from the salon. They are placeholders until then:

- [ ] Business name, address, phone and email
- [ ] Real opening hours, including any seasonal changes
- [ ] Full services list with durations and prices
- [ ] Real staff names and their services
- [ ] VAT position confirmed
- [ ] Retention period confirmed
- [ ] Reminder timings and whether SMS is wanted
