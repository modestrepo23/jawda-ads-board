# Jawda Ads Board

A Kanban board for Jawda's Meta ad creative pipeline. It replaces the row-per-ad tracking in the
"SILIBI Meta Ads Max Vol. 3" sheet with one ticket per ad ID, moved through stages from idea to
published, with the copy, links and hand-offs living on the ticket.

No build step, no framework. Open `index.html` and it works.

## What it does

- One ticket per ad ID. IDs auto-increment from the highest on the board (#1142, #1143 and so on).
- The ad name builds itself from the sheet formula: `#ID: Funnel / Angle / Product / Creative type / Format / AI`.
- The Meta UTM link builds itself from the landing page using the Triple Whale pattern
  (`utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content=...&fbadid={{ad.id}}`).
- Every field from the sheet has a place on the ticket: dates, angle, funnel, product, creative type,
  format, AI or non-AI, inspiration link, description, landing page, two primary texts, two headlines,
  both Canva links and learnings.
- Character counters on primary text (125, the safe length before mobile truncation) and headlines (40).
- Copy claims that need substantiation (fibre content, ethics, scarcity, ratings, opacity, crease
  resistance) are flagged on the ticket and on the card.
- Hand-off checklist: brief written, creative delivered, copy written, links and Canva checked,
  approved. Progress shows as a small rail on each card.
- Owner and due date per ticket, with overdue highlighting.
- Notes thread and an activity log on every ticket, so feedback stays with the ad.
- Drag and drop between columns, or use the next and back buttons in the ticket.
- Search and filters by angle, funnel, format, creative type and owner.
- Import the sheet tab as CSV. Export back to CSV in the sheet's exact column order.
- JSON backup and restore.
- Stages, team members and dropdown options are all editable in Settings.

## Pipeline

The board columns map to the sheet's column A and add the hand-off stages between them:

| Column | Meaning |
| --- | --- |
| Backlog | Ideas and angles not yet briefed |
| Brief prepared | Brief written, waiting on content |
| Awaiting creative | With studio, agency or editor |
| Creative ready | Asset delivered, needs copy |
| In progress | Copy, links and Canva being built |
| Awaiting approval | Ready for sign-off |
| Published | Live in Ads Manager |
| Retired | Switched off, kept for learnings |
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

## Working with the board

- New ticket from the top bar goes to Backlog. The "+ Add ticket" button at the foot of a column
  creates it in that column.
- Moving a ticket into Brief prepared, Creative ready or Published stamps the matching date if it is
  empty.
- Pick who you are from the dropdown next to the notes box. New tickets you create are assigned to you.
- Ctrl or Cmd plus Enter posts a note.
- Escape closes the ticket.
- Collapse Retired and Rejected with the arrow in the column header to keep the board tight.

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
```

Jost stands in for Glacial Indifference, which is not on Google Fonts. To use the real brand font,
add the font files to a `fonts/` folder and swap the `@font-face` in `css/styles.css`.
