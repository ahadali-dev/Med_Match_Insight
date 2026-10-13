# Client demo guide

About 10 minutes. Everything runs on invented data in the **Demo data** source, so nothing real is shown and nothing you click is saved anywhere except the presenter's browser.

## Before the call (2 minutes)

1. Use the deployed site or `npm run build && npm start` (smoother than `npm run dev`).
2. Open the site in a **fresh browser window** (or click **Reset demo data** in the sidebar). The sample dates are generated relative to today, so a reset keeps "expiring in 18 days" realistic.
3. Check the sidebar says **Demo data** and the top bar shows **Demo workspace**.
4. Browser zoom 100%, window at least 1280px wide.

## Walkthrough

1. **Overview** (the headline)
   - "Ready to work: 15 of 24" is who can be scheduled today.
   - "Credentialing in progress": the red days are files past the 60-day target. Dr. Patel is at 88 days, waiting on the medical staff committee.
   - "Expiring in the next 90 days": licenses and certifications grouped 30 / 60 / 90 days.
   - "Where the days go": payer enrollment is the slowest step.
   - "Needs attention this week" builds itself from rules. Nobody maintains this list.
2. **Filters**: pick *Downtown ASC*. Every card, chart and table narrows. Switch back.
3. **Click a provider name** (for example Dr. L. Chen): full profile with the credentialing timeline, expirations, onboarding.
4. **Credentialing board**: drag Dr. L. Chen from *Application* to *Payer enrollment*. Go back to Overview: the numbers moved. Drag a card to *Finished*; the provider moves to Onboarding. Use **Undo**.
5. **Providers table**: change a status from the dropdown in the row. Open the **⋮** menu: Details, Edit, Delete. Use search, filters and **Export CSV**.
6. **Licenses & expirations**: sort by time left, edit a date from the row menu.
7. **Recruiting**: stalled searches (open 60+ days) in red.
8. **The sheet connection** (sidebar → **Connect a Google Sheet**; paste a link shared as "Anyone with the link", click Connect, and the whole dashboard switches to that sheet. Disconnect returns to the demo): "In production each client's tracker is a Google Sheet. The dashboard reads it live every 5 minutes, read-only. Your team keeps working in the sheet they already use."

## Things to avoid or say honestly

- Edits in the demo are **not shared** between people or devices.
- Live Google Sheet mode needs the setup in the README (service account, share the sheet). Do not promise it live on the call unless you tested it beforehand with the client's real sheet or the seeded sample sheet (`npm run seed`).
- There is no login yet. The "Demo user" avatar is a placeholder.
- Drag and drop on the board is mouse only; touch users use the **Move to** dropdown on each card.
