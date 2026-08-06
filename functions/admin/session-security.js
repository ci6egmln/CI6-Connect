function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store"
    }
  });
}

async function ensureAuditTable(database) {
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS administration_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

function parseDetails(value) {
  try {
    const details = JSON.parse(String(value || "{}"));
    return details && typeof details === "object"
      ? details
      : {};
  } catch {
    return {};
  }
}

export async function onRequestGet(context) {
  try {
    await ensureAuditTable(context.env.DB);

    const result = await context.env.DB.prepare(`
      SELECT
        audit.id,
        audit.actor_username,
        audit.details,
        audit.created_at,
        users.nom AS account_name,
        students.nom AS student_name,
        students.prenom AS student_first_name,
        students.peloton AS student_platoon
      FROM administration_audit_log audit
      LEFT JOIN users
        ON users.username = audit.actor_username
      LEFT JOIN discipline_students students
        ON students.nigend = audit.actor_username
      WHERE audit.action = 'simultaneous_login'
      ORDER BY audit.created_at DESC, audit.id DESC
      LIMIT 100
    `).all();

    const events = (result.results || []).map(row => {
      const details = parseDetails(row.details);
      const studentIdentity = [
        row.student_name,
        row.student_first_name
      ].filter(Boolean).join(" ");

      return {
        id: Number(row.id),
        username: row.actor_username,
        displayName:
          studentIdentity || row.account_name || "",
        peloton: row.student_platoon || "",
        previousDeviceType:
          details.previousDeviceType ||
          "Appareil non identifié",
        previousBrowser:
          details.previousBrowser ||
          "Navigateur non identifié",
        previousStartedAt:
          details.previousStartedAt || null,
        previousLastSeenAt:
          details.previousLastSeenAt || null,
        newDeviceType:
          details.newDeviceType ||
          "Appareil non identifié",
        newBrowser:
          details.newBrowser ||
          "Navigateur non identifié",
        occurredAt: row.created_at
      };
    });

    return jsonResponse({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    console.error("Journal des sessions :", error);

    return jsonResponse(
      {
        error:
          "Impossible de charger le journal des connexions simultanées."
      },
      500
    );
  }
}
