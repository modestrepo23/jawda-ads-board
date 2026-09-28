# Jawda Ads Board

A Kanban board for Jawda's Meta ad creative pipeline. It replaces the row-per-ad tracking in the
"SILIBI Meta Ads Max Vol. 3" sheet with one ticket per ad ID, moved through stages from idea to
published, with the copy, links and hand-offs living on the ticket.

No build step, no framework. Open `index.html` and it works.

## What it does

- One ticket per ad ID. New tickets take the highest ID on the board plus one (a fresh board starts at
  #1142), and the ID can be edited in the ticket header if it needs to match Ads Manager.
- The ad name builds itself from the sheet formula: `#ID: Funnel / Angle / Product / Creative type / Format / AI`.
- The Meta UTM link builds itself from the landing page using the Triple Whale pattern
  (`utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content=...&fbadid={{ad.id}}`).
- Every field from the sheet has a place on the ticket: dates, angle, funnel, product, creative type,
  format, AI or non-AI, inspiration link, description, landing page, two primary texts, two headlines,
  both Canva links and learnings.
- Character counters on primary text (125, the safe length before mobile truncation) and headlines (40).
- Copy claims that need substantiation (fibre content, ethics, scarcity, ratings, opacity, crease
  resistance) are flagged on the ticket and on the card.
- A Brief section at the top of every ticket, and a Dates section at the end that fills in
  automatically as the ticket moves through the pipeline (editable if a date needs correcting).
- Notes thread and an activity log on every ticket, so feedback stays with the ad.
- Drag and drop between columns, or use the next and back buttons in the ticket.
- Duplicate a ticket to spin up hook or angle variants: the new ID keeps the ad definition, copy and
  links, and starts with clean dates, hand-offs and notes.
- Search and filters by angle, funnel, format, creative type and owner.
- Import the sheet tab as CSV. Export back to CSV in the sheet's exact column order.
- JSON backup and restore.
- Stages, team members and dropdown options are all editable in Settings.
- Shoots panel (top bar): log the next shoot's date, source of content, what is being shot and a
  link. Shared with the team, and the next one shows in the top bar.

## Pipeline

The board columns map to the sheet's column A and add the hand-off stages between them:

| Column | Meaning |
| --- | --- |
| Backlog | Ideas and angles not yet briefed |
| Brief prepared | Brief written, waiting on content |
| Awaiting creative | With studio, agency or editor |
| Awaiting approval | Awaiting approval for creative |
| Creative ready | Asset delivered, needs copy |
| In progress | Copy, links and Canva being built |
| Approved | Awaiting publishing |
| Published | Live in Ads Manager |
| Rejected | Not going ahead |

Rename, reorder, add or remove stages in Settings. Any status in the sheet that the board does not
recognise is added as a new column on import.

## Getting started

### 1. Run it

Either open `index.html` directly in a browser, or publish the repository with GitHub Pages
(Settings, Pages, deploy from the `main` branch, root folder). GitHub Pages gives everyone one URL.

### 2. Bring the sheet across

In Google Sheets, open the `SILIBI Meta Ads Max Vol. 3` tab, then File, Download,
Comma Separated Values. On the board use Data, Import from sheet, choose the file, Import.

Tickets are matched by ID. Re-importing later updates existing tickets rather than duplicating them.

### 3. Share it with the team

Out of the box the board saves to the browser you are using. That is fine for one person. For the
whole team to work on the same board live:

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor, paste the contents of `supabase/schema.sql`, run it.
3. In the Supabase project go to Project settings, API. Copy the Project URL and the `anon public` key.
4. Paste both into `js/config.js`.
5. Commit and push. Everyone opening the board now sees the same tickets, and changes appear as they happen.

Before switching, download a backup (Data, Download backup) and restore it after so nothing is lost.

The schema allows anyone holding the anon key to read and write, which is the simplest setup for a
small trusted team. Keep the repository private if you use it. The SQL file has a note on tightening
this with Supabase Auth if needed later.

### 4. Slack notifications (optional)

Once the board is on Supabase, it can post to a Slack channel when a ticket is created, moves
stage, gets a note, has a hand-off step ticked, or is deleted. Copy edits stay quiet.

1. In Slack go to api.slack.com/apps, Create New App, From scratch. Under Features choose
   Incoming Webhooks, switch it on, Add New Webhook to Workspace, pick the channel, copy the URL.
2. Open `supabase/slack-notifications.sql`, paste the webhook URL over `PASTE_SLACK_WEBHOOK_URL_HERE`
   and check the board address on the line below it.
3. Run the whole file in Supabase, SQL editor.

Do the sheet import before running this, or the import will announce every ticket. (Tickets that
arrive via import are skipped, but only if the script is already in place when they are created.)
To change the channel, edit the URL and run the file again. To switch notifications off, run
`drop trigger cards_notify_slack on public.cards;`.

## Working with the board

- New ticket from the top bar goes to Backlog. The "+ Add ticket" button at the foot of a column
  creates it in that column.
- Moving a ticket into any stage stamps that stage's date if it is empty. Brief prepared, Creative
  ready and Published feed the three date columns in the sheet on export.
- Pick who you are from the dropdown next to the notes box so notes carry your name.
- Ctrl or Cmd plus Enter posts a note.
- Escape closes the ticket.
- Collapse Rejected with the arrow in the column header to keep the board tight.

## Files

```
index.html          app shell
assets/             official wordmark (cream, Crater Brown, Burnt Umber) and favicons
css/styles.css      styles (Jawda palette, Playfair Display and Jost)
js/config.js        storage configuration
js/data.js          data model, sheet formulas, CSV import and export
js/storage.js       localStorage and Supabase adapters
js/app.js           board, ticket drawer, settings
supabase/schema.sql shared storage tables and policies
supabase/slack-notifications.sql  optional Slack alerts, runs inside Supabase
```

Jost stands in for Glacial Indifference, which is not on Google Fonts. To use the real brand font,
add the font files to a `fonts/` folder and swap the `@font-face` in `css/styles.css`.
