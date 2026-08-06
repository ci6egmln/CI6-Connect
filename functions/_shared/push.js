import { sendWebPush } from "./web-push.js";

function audienceClause(audience) {
  if (audience === "eleves") return { sql: "role = 'eleve'", values: [] };
  if (audience === "cadres") return { sql: "role IN ('cadre','admin')", values: [] };
  if (audience === "admins") return { sql: "role = 'admin'", values: [] };
  return { sql: "role IN ('eleve','cadre','admin')", values: [] };
}

export async function sendPushNotifications(environment, options) {
  if (!environment.DB) {
    return { sent: 0, failed: 0, removed: 0, error: "Binding DB indisponible." };
  }

  const audience = audienceClause(options.audience);
  const result = await environment.DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE ${audience.sql}
  `).bind(...audience.values).all();

  const subscriptions = Array.isArray(result.results) ? result.results : [];
  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const subscription of subscriptions) {
    try {
      const response = await sendWebPush(environment, subscription, options.notification);
      if (response.ok) {
        sent += 1;
        await environment.DB.prepare(`
          UPDATE push_subscriptions
          SET updated_at = CURRENT_TIMESTAMP, last_error = NULL
          WHERE endpoint = ?
        `).bind(subscription.endpoint).run();
      } else if (response.status === 404 || response.status === 410) {
        removed += 1;
        await environment.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`)
          .bind(subscription.endpoint).run();
      } else {
        failed += 1;
        const detail = (await response.text()).slice(0, 300);
        await environment.DB.prepare(`
          UPDATE push_subscriptions
          SET last_error = ?, updated_at = CURRENT_TIMESTAMP
          WHERE endpoint = ?
        `).bind(`HTTP ${response.status} ${detail}`, subscription.endpoint).run();
      }
    } catch (error) {
      failed += 1;
      await environment.DB.prepare(`
        UPDATE push_subscriptions
        SET last_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE endpoint = ?
      `).bind(String(error?.message || error).slice(0, 300), subscription.endpoint).run();
    }
  }

  return { sent, failed, removed, total: subscriptions.length };
}
