-- Jawda Ads Board: Slack notifications.
--
-- Posts to a Slack channel when a ticket is created, moves stage, gets a note,
-- has a hand-off step ticked, or is deleted. Copy edits and other field changes
-- stay quiet, so the channel is not flooded while people are writing.
--
-- Runs entirely inside Supabase. The Slack webhook URL lives in a private
-- schema that the board's public key cannot read.
--
-- Setup:
--   1. In Slack: api.slack.com/apps, Create New App, From scratch. Add the
--      Incoming Webhooks feature, switch it on, Add New Webhook to Workspace,
--      choose the channel. Copy the URL (starts https://hooks.slack.com/services/).
--   2. Paste that URL and your board's address into the two values just below.
--   3. Run this whole file in Supabase, SQL editor. Run it again any time to
--      change the URL or the board address.

create extension if not exists pg_net;

create schema if not exists private;

create table if not exists private.slack_config (
  id int primary key default 1 check (id = 1),
  webhook_url text not null,
  board_url text not null
);

insert into private.slack_config (id, webhook_url, board_url) values (
  1,
  'PASTE_SLACK_WEBHOOK_URL_HERE',
  'https://modestrepo23.github.io/jawda-ads-board/'
)
on conflict (id) do update set webhook_url = excluded.webhook_url, board_url = excluded.board_url;

-- Slack reads &, < and > as markup.
create or replace function private.slack_escape(t text) returns text
language sql immutable strict as $$
  select replace(replace(replace(t, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

-- Stage label as shown on the board, looked up from the board's own settings.
create or replace function private.stage_label(board text, key text) returns text
language sql stable as $$
  select coalesce(
    (select s->>'label'
       from public.board_settings bs, jsonb_array_elements(bs.data->'statuses') s
      where bs.board = stage_label.board and s->>'key' = stage_label.key
      limit 1),
    key);
$$;

-- Same formula as the board: #ID: Funnel / Angle / Product / Creative type / Format / AI
create or replace function private.ticket_name(d jsonb) returns text
language sql immutable as $$
  select case when nullif(trim(d->>'nameOverride'), '') is not null then trim(d->>'nameOverride')
    else '#' || (d->>'id') || coalesce(': ' || nullif(
      array_to_string(array_remove(array[
        nullif(trim(d->>'funnel'), ''), nullif(trim(d->>'angle'), ''), nullif(trim(d->>'product'), ''),
        nullif(trim(d->>'creativeType'), ''), nullif(trim(d->>'formatType'), ''), nullif(trim(d->>'ai'), '')
      ], null), ' / '), ''), '')
  end;
$$;

create or replace function private.notify_slack() returns trigger
language plpgsql security definer set search_path = public, private, net as $$
declare
  cfg private.slack_config%rowtype;
  d jsonb;            -- new data
  o jsonb;            -- old data
  headline text;
  detail text := '';
  who text;
  n_old int; n_new int;
  step_key text;
  steps text := '';
  step_labels jsonb := '{"brief":"Brief written","creative":"Creative delivered","copy":"Copy written","links":"Links and Canva checked","approved":"Approved"}'::jsonb;
  link text;
begin
  select * into cfg from private.slack_config where id = 1;
  if cfg.webhook_url is null or cfg.webhook_url like 'PASTE_%' then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    d := old.data;
    headline := 'Ticket deleted: ' || private.slack_escape(private.ticket_name(d));
  else
    d := new.data;
    o := case when tg_op = 'UPDATE' then old.data else null end;
    who := nullif(trim(d->>'owner'), '');

    if tg_op = 'INSERT' then
      -- A sheet import creates every ticket at once; stay quiet for those.
      if exists (select 1 from jsonb_array_elements(coalesce(d->'activity', '[]'::jsonb)) a
                 where a->>'text' = 'Imported from sheet') then
        return new;
      end if;
      headline := 'New ticket: ' || private.slack_escape(private.ticket_name(d));
      detail := 'Stage: ' || private.slack_escape(private.stage_label(new.board, d->>'status'))
             || coalesce(', owner ' || private.slack_escape(who), ', unassigned');

    elsif (d->>'status') is distinct from (o->>'status') then
      headline := private.slack_escape(private.ticket_name(d)) || ' moved to '
               || private.slack_escape(private.stage_label(new.board, d->>'status'));
      detail := 'From ' || private.slack_escape(private.stage_label(new.board, o->>'status'))
             || coalesce(', owner ' || private.slack_escape(who), '');
      if d->>'status' = 'published' then headline := ':white_check_mark: ' || headline; end if;

    else
      n_old := coalesce(jsonb_array_length(o->'comments'), 0);
      n_new := coalesce(jsonb_array_length(d->'comments'), 0);
      if n_new > n_old then
        headline := 'New note on ' || private.slack_escape(private.ticket_name(d));
        detail := private.slack_escape(coalesce(d->'comments'->(n_new - 1)->>'by', 'Someone')) || ': '
               || private.slack_escape(left(d->'comments'->(n_new - 1)->>'text', 300));
      else
        -- Hand-off steps ticked in this save.
        foreach step_key in array array['brief', 'creative', 'copy', 'links', 'approved'] loop
          if (d->'checklist'->>step_key)::boolean is true
             and coalesce((o->'checklist'->>step_key)::boolean, false) is false then
            steps := steps || case when steps = '' then '' else ', ' end || (step_labels->>step_key);
          end if;
        end loop;
        if steps <> '' then
          headline := private.slack_escape(private.ticket_name(d)) || ': ' || steps;
          detail := 'Stage: ' || private.slack_escape(private.stage_label(new.board, d->>'status'))
                 || coalesce(', owner ' || private.slack_escape(who), '');
        end if;
      end if;
    end if;
  end if;

  if headline is null then
    return coalesce(new, old);
  end if;

  link := '<' || cfg.board_url || '|Open the board>';

  perform net.http_post(
    url := cfg.webhook_url,
    body := jsonb_build_object(
      'text', headline,
      'blocks', jsonb_build_array(
        jsonb_build_object('type', 'section', 'text', jsonb_build_object('type', 'mrkdwn', 'text',
          '*' || headline || '*' || case when detail <> '' then E'\n' || detail else '' end)),
        jsonb_build_object('type', 'context', 'elements', jsonb_build_array(
          jsonb_build_object('type', 'mrkdwn', 'text', link)))
      )
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists cards_notify_slack on public.cards;
create trigger cards_notify_slack
  after insert or update or delete on public.cards
  for each row execute function private.notify_slack();
