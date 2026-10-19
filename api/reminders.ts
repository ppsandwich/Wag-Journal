import postgres from "postgres";
import webpush from "web-push";
import { timingSafeEqual } from "node:crypto";
import { day, addDays, occurrences, clock, labels } from "../src/lib/domain.js";
import type { Event, Routine, Preference } from "../src/lib/domain.js";
import type { IncomingMessage, ServerResponse } from "node:http";

/** Vercel Pro Cron calls this endpoint each minute with Authorization: Bearer CRON_SECRET.
 * A POST scheduler may use REMINDER_SECRET as a fallback.
 * Claim each endpoint/occurrence atomically. A failed send is retried until the occurrence expires.
 * Push is best-effort: a successful provider handoff is not proof of delivery to a phone.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const secret = process.env.CRON_SECRET || process.env.REMINDER_SECRET,
    provided = req.headers.authorization || "";
  const expected = secret ? `Bearer ${secret}` : "";
  if (
    !secret ||
    provided.length !== expected.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Unauthorised" }));
    return;
  }
  if (req.method !== "POST" && req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Use GET or POST" }));
    return;
  }
  if (!process.env.DATABASE_URL) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Database is not configured." }));
    return;
  }
  const sql = postgres(process.env.DATABASE_URL, { max: 2, prepare: false });
  let sent = 0,
    failed = 0;
  try {
    // Actual expiry and retention job. Backup expiry requires provider configuration and verification.
    await sql`delete from households where deletion_at < now()-interval '7 days'`;
    await sql`delete from history where created_at < now()-interval '30 days'`;
    await sql`delete from records where deleted_at < now()-interval '30 days'`;
    await sql`delete from reminder_deliveries where expires_at < now()-interval '7 days'`;
    const pendingDeletes =
      await sql`select user_id from account_deletions where auth_deleted=true and completed_at is null`;
    for (const pending of pendingDeletes)
      await sql`select anonymise_wag_account(${pending.user_id}::uuid)`;
    if (
      !process.env.VAPID_SUBJECT ||
      !process.env.VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY
    ) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          sent,
          failed,
          pushConfigured: false,
          maintenanceCompleted: true,
        }),
      );
      return;
    }
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    const households =
      await sql`select h.id,h.data from households h where h.deletion_at is null and exists(select 1 from push_subscriptions s where s.household_id=h.id)`;
    for (const household of households) {
      const zone = household.data.timezone;
      const today = day(new Date(), zone);
      const records =
        await sql`select kind,data,actor_id from records where household_id=${household.id} and deleted_at is null and (kind<>'event' or (data->>'at')::timestamptz>now()-interval '2 days')`;
      const events = records
          .filter((r) => r.kind === "event")
          .map((r) => r.data) as Event[],
        routines = records
          .filter((r) => r.kind === "routine")
          .map((r) => r.data) as Routine[];
      const plans = [
        ...occurrences(routines, events, addDays(today, -1), zone),
        ...occurrences(routines, events, today, zone),
      ];
      const subscriptions =
        await sql`select s.* from push_subscriptions s join memberships m on m.household_id=s.household_id and m.user_id=s.user_id where s.household_id=${household.id}`;
      for (const sub of subscriptions) {
        const pref = records.find(
          (r) => r.kind === "preference" && r.data.userId === sub.user_id,
        )?.data as Preference | undefined;
        const currentTime = new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone: zone,
        }).format(new Date());
        if (
          pref?.mutedUntil === "forever" ||
          (pref?.mutedUntil && Date.parse(pref.mutedUntil) > Date.now())
        )
          continue;
        if (pref?.quietStart && pref.quietEnd) {
          const quiet =
            pref.quietStart < pref.quietEnd
              ? currentTime >= pref.quietStart && currentTime < pref.quietEnd
              : currentTime >= pref.quietStart || currentTime < pref.quietEnd;
          if (quiet) continue;
        }
        for (const plan of plans) {
          if (plan.fulfilled) continue;
          const snooze = pref?.snoozes?.[plan.id],
            due = snooze || plan.at,
            age = Date.now() - Date.parse(due);
          if (age < 0 || age > 900000) continue;
          const id = `${sub.id}:${plan.id}:${snooze || "initial"}`;
          const claim =
            await sql`insert into reminder_deliveries(id,household_id,user_id,expires_at) values(${id},${household.id},${sub.user_id},${new Date(Date.parse(due) + 900000)}) on conflict(id) do update set claimed_at=now(),status='claimed' where reminder_deliveries.status='failed' or reminder_deliveries.status='claimed' and reminder_deliveries.claimed_at<now()-interval '2 minutes' returning id`;
          if (!claim.length) continue;
          // Recheck completion, household access and personal mute immediately before provider handoff.
          const valid =
            await sql`select h.id from households h join memberships m on m.household_id=h.id and m.user_id=${sub.user_id} where h.id=${household.id} and h.deletion_at is null and not exists(select 1 from records e where e.household_id=h.id and e.kind='event' and e.deleted_at is null and e.data->>'planId'=${plan.id})`;
          const fresh =
            await sql`select data from records where household_id=${household.id} and kind='preference' and actor_id=${sub.user_id} and deleted_at is null`;
          const freshPref = fresh[0]?.data as Preference | undefined;
          const scheduleRows =
            await sql`select kind,data from records where household_id=${household.id} and deleted_at is null and (kind='routine' or kind='event' and (data->>'at')::timestamptz>now()-interval '2 days')`;
          const currentRoutines = scheduleRows
            .filter((r) => r.kind === "routine")
            .map((r) => r.data) as Routine[];
          const currentEvents = scheduleRows
            .filter((r) => r.kind === "event")
            .map((r) => r.data) as Event[];
          const currentPlan = occurrences(
            currentRoutines,
            currentEvents,
            day(plan.at, zone),
            zone,
          ).find((p) => p.id === plan.id && p.at === plan.at && !p.fulfilled);

          const freshQuiet =
            freshPref?.quietStart &&
            freshPref.quietEnd &&
            (freshPref.quietStart < freshPref.quietEnd
              ? currentTime >= freshPref.quietStart &&
                currentTime < freshPref.quietEnd
              : currentTime >= freshPref.quietStart ||
                currentTime < freshPref.quietEnd);
          if (
            !valid.length ||
            !currentPlan ||
            freshPref?.mutedUntil === "forever" ||
            (freshPref?.mutedUntil &&
              Date.parse(freshPref.mutedUntil) > Date.now()) ||
            freshQuiet ||
            freshPref?.snoozes?.[plan.id] !== snooze
          ) {
            await sql`update reminder_deliveries set status='cancelled' where id=${id}`;
            continue;
          }
          try {
            await webpush.sendNotification(
              sub.subscription,
              JSON.stringify({
                title: "A little reminder from Wag Journal",
                body: `${labels[plan.item.type]} is planned for ${clock(plan.at, zone)}. Record it when it happens.`,
                tag: plan.id,
              }),
              {
                TTL: Math.max(1, Math.floor((900000 - age) / 1000)),
                timeout: 10000,
              },
            );
            await sql`update reminder_deliveries set status='sent',sent_at=now() where id=${id}`;
            sent++;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410)
              await sql`delete from push_subscriptions where id=${sub.id}`;
            await sql`update reminder_deliveries set status='failed' where id=${id}`;
            failed++;
          }
        }
      }
    }
    res.statusCode = 200;
    res.end(JSON.stringify({ sent, failed }));
  } catch {
    res.statusCode = 500;
    res.end(
      JSON.stringify({ error: "Reminder processing failed. Retry required." }),
    );
  } finally {
    await sql.end();
  }
}
