import { ensureNotationSchema } from "../_shared/notations.js";

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "private, no-store",
        "X-Content-Type-Options":
          "nosniff"
      }
    }
  );
}

function adminSession(context) {
  const session =
    context.data?.session;

  if (
    !session ||
    session.type !== "user" ||
    session.role !== "admin"
  ) {
    return null;
  }

  return session;
}

async function ensureAuditTable(database) {
  await database
    .prepare(`
      CREATE TABLE IF NOT EXISTS administration_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        actor_username TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    .run();

  /*
   * Conservation limitée à trois mois.
   * La purge s’exécute à chaque consultation ou écriture
   * de cette fonction, sans tâche planifiée.
   */
  await database
    .prepare(`
      DELETE FROM administration_audit_log
      WHERE created_at < datetime('now', '-3 months')
    `)
    .run();
}

async function audit(
  database,
  actor,
  action,
  details
) {
  await ensureAuditTable(database);

  await database
    .prepare(`
      INSERT INTO administration_audit_log
      (
        action,
        actor_username,
        details
      )
      VALUES (?, ?, ?)
    `)
    .bind(
      action,
      actor || "",
      JSON.stringify(details || {})
    )
    .run();
}

async function activeAdministratorCount(database) {
  const row =
    await database
      .prepare(`
        SELECT COUNT(*) AS total
        FROM users
        WHERE role = 'admin'
          AND active = 1
      `)
      .first();

  return Number(row?.total || 0);
}

export async function onRequestGet(context) {
  const session =
    adminSession(context);

  if (!session) {
    return jsonResponse(
      {
        error:
          "Accès administrateur requis."
      },
      403
    );
  }

  try {
    await ensureAuditTable(
      context.env.DB
    );

    const [
      activeStudents,
      inactiveStudents,
      activeCadres,
      activeAdministrators,
      cadresResult
    ] = await Promise.all([
      context.env.DB
        .prepare(`
          SELECT COUNT(*) AS total
          FROM users
          WHERE role = 'eleve'
            AND active = 1
        `)
        .first(),
      context.env.DB
        .prepare(`
          SELECT COUNT(*) AS total
          FROM users
          WHERE role = 'eleve'
            AND active = 0
        `)
        .first(),
      context.env.DB
        .prepare(`
          SELECT COUNT(*) AS total
          FROM users
          WHERE role = 'cadre'
            AND active = 1
        `)
        .first(),
      context.env.DB
        .prepare(`
          SELECT COUNT(*) AS total
          FROM users
          WHERE role = 'admin'
            AND active = 1
        `)
        .first(),
      context.env.DB
        .prepare(`
          SELECT
            username,
            nom,
            role,
            active,
            created_at,
            updated_at
          FROM users
          WHERE role IN ('cadre','admin')
          ORDER BY
            CASE role
              WHEN 'admin' THEN 0
              ELSE 1
            END,
            nom COLLATE NOCASE,
            username
        `)
        .all()
    ]);

    return jsonResponse({
      success: true,
      summary: {
        activeStudents:
          Number(activeStudents?.total || 0),
        inactiveStudents:
          Number(inactiveStudents?.total || 0),
        activeCadres:
          Number(activeCadres?.total || 0),
        activeAdministrators:
          Number(activeAdministrators?.total || 0)
      },
      cadres:
        (cadresResult.results || [])
          .map(user => ({
            username:
              user.username,
            nom:
              user.nom || "",
            role:
              user.role,
            active:
              Number(user.active) === 1,
            createdAt:
              user.created_at,
            updatedAt:
              user.updated_at
          }))
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Impossible de charger la clôture de formation.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
}

export async function onRequestPost(context) {
  const session =
    adminSession(context);

  if (!session) {
    return jsonResponse(
      {
        error:
          "Accès administrateur requis."
      },
      403
    );
  }

  let body;

  try {
    body =
      await context.request.json();
  } catch {
    return jsonResponse(
      {
        error:
          "Requête JSON invalide."
      },
      400
    );
  }

  const action =
    String(body.action || "").trim();

  try {
    await ensureAuditTable(
      context.env.DB
    );

    if (action === "update_cadre") {
      const username =
        String(body.username || "").trim();

      const role =
        String(body.role || "").trim();

      const active =
        body.active === true;

      if (!/^[A-Z]{3}\d{3}$/.test(username.toUpperCase())) {
        return jsonResponse(
          {
            error:
              "Identifiant invalide."
          },
          400
        );
      }

      if (
        role !== "cadre" &&
        role !== "admin"
      ) {
        return jsonResponse(
          {
            error:
              "Rôle invalide."
          },
          400
        );
      }

      const current =
        await context.env.DB
          .prepare(`
            SELECT
              username,
              nom,
              role,
              active
            FROM users
            WHERE username = ?
              AND role IN ('cadre','admin')
            LIMIT 1
          `)
          .bind(username)
          .first();

      if (!current) {
        return jsonResponse(
          {
            error:
              "Compte cadre introuvable."
          },
          404
        );
      }

      const removingActiveAdmin =
        current.role === "admin" &&
        Number(current.active) === 1 &&
        (
          role !== "admin" ||
          !active
        );

      if (
        removingActiveAdmin &&
        await activeAdministratorCount(
          context.env.DB
        ) <= 1
      ) {
        return jsonResponse(
          {
            error:
              "Impossible de retirer ou désactiver le dernier administrateur actif."
          },
          403
        );
      }

      await context.env.DB
        .prepare(`
          UPDATE users
          SET
            role = ?,
            active = ?,
            session_version =
              session_version + 1,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE username = ?
        `)
        .bind(
          role,
          active ? 1 : 0,
          username
        )
        .run();

      await audit(
        context.env.DB,
        session.username,
        "cadre_access_review",
        {
          username,
          previousRole:
            current.role,
          newRole:
            role,
          previousActive:
            Number(current.active) === 1,
          newActive:
            active
        }
      );

      return jsonResponse({
        success: true,
        message:
          "Le rôle et l’accès du cadre ont été mis à jour."
      });
    }

    if (action === "deactivate_students") {
      const count =
        await context.env.DB
          .prepare(`
            SELECT COUNT(*) AS total
            FROM users
            WHERE role = 'eleve'
              AND active = 1
          `)
          .first();

      await context.env.DB.batch([
        context.env.DB
          .prepare(`
            UPDATE users
            SET
              active = 0,
              session_version =
                session_version + 1,
              updated_at =
                CURRENT_TIMESTAMP
            WHERE role = 'eleve'
          `),
        context.env.DB
          .prepare(`
            UPDATE discipline_students
            SET
              active = 0,
              updated_at =
                CURRENT_TIMESTAMP
          `),
        context.env.DB
          .prepare(`
            DELETE FROM push_subscriptions
            WHERE role = 'eleve'
          `)
      ]);

      await audit(
        context.env.DB,
        session.username,
        "students_deactivated",
        {
          affected:
            Number(count?.total || 0)
        }
      );

      return jsonResponse({
        success: true,
        message:
          `${Number(count?.total || 0)} compte(s) élève désactivé(s).`
      });
    }

    if (action === "delete_students") {
      if (
        String(body.confirmation || "")
          .trim()
          .toUpperCase() !==
        "CLOTURER LA FORMATION"
      ) {
        return jsonResponse(
          {
            error:
              "Confirmation incorrecte."
          },
          400
        );
      }

      await ensureNotationSchema(context.env.DB);

      const count =
        await context.env.DB
          .prepare(`
            SELECT COUNT(*) AS total
            FROM users
            WHERE role = 'eleve'
          `)
          .first();

      /*
       * Le journal administratif est écrit avant
       * la suppression. Il ne contient pas de mot
       * de passe ni de données disciplinaires détaillées.
       */
      await audit(
        context.env.DB,
        session.username,
        "training_closed",
        {
          deletedStudentAccounts:
            Number(count?.total || 0)
        }
      );

      await context.env.DB.batch([
        context.env.DB
          .prepare(`
            DELETE FROM notation_audit_log
          `),
        context.env.DB
          .prepare(`
            DELETE FROM notation_records
          `),
        context.env.DB
          .prepare(`
            DELETE FROM notation_students
          `),
        context.env.DB
          .prepare(`
            DELETE FROM discipline_audit_log
          `),
        context.env.DB
          .prepare(`
            DELETE FROM discipline_sanctions
          `),
        context.env.DB
          .prepare(`
            DELETE FROM discipline_students
          `),
        context.env.DB
          .prepare(`
            DELETE FROM fiche_consultations
            WHERE role = 'eleve'
               OR username IN (
                 SELECT username
                 FROM users
                 WHERE role = 'eleve'
               )
          `),
        context.env.DB
          .prepare(`
            DELETE FROM push_subscriptions
            WHERE role = 'eleve'
               OR username IN (
                 SELECT username
                 FROM users
                 WHERE role = 'eleve'
               )
          `),
        context.env.DB
          .prepare(`
            DELETE FROM users
            WHERE role = 'eleve'
          `)
      ]);

      return jsonResponse({
        success: true,
        message:
          `${Number(count?.total || 0)} compte(s) élève et leurs données ont été supprimés.`
      });
    }

    return jsonResponse(
      {
        error:
          "Action inconnue."
      },
      400
    );

  } catch (error) {
    return jsonResponse(
      {
        error:
          "L’opération de clôture a échoué.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
}
