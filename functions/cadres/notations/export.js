import {
  ensureNotationSchema,
  notationJson,
  notationPermission,
  validPeloton
} from "../../_shared/notations.js";

function csv(value) {
  const text = String(value ?? "");
  return /[;"\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function compactDate() {
  return new Date().toISOString().slice(0, 10);
}

function physicalPreparationLabel(value) {
  return {
    limited: "Peu préparé",
    good: "Bien préparé",
    excellent: "Très bonne condition physique"
  }[String(value || "")] || "";
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) return notationJson({ error: "Liaison D1 indisponible." }, 500);
  await ensureNotationSchema(db);
  const permission = await notationPermission(context);

  if (!permission) return notationJson({ error: "Accès cadre requis." }, 403);
  if (!permission.isAdmin && !permission.scope) {
    return notationJson({ error: "Aucun peloton de notation n’est attribué à votre compte." }, 403);
  }

  const url = new URL(context.request.url);
  let scope = String(url.searchParams.get("scope") || permission.scope || "ALL").toUpperCase();

  if (!permission.isAdmin) scope = permission.scope;
  if (scope !== "ALL" && !validPeloton(scope)) return notationJson({ error: "Périmètre d’export invalide." }, 400);

  const statusSql = permission.isAdmin
    ? "r.status IN ('company_finalized','exported')"
    : "r.status IN ('platoon_validated','company_finalized','exported')";
  const bindings = [];
  let scopeSql = "";

  if (scope !== "ALL") {
    scopeSql = " AND s.peloton=?";
    bindings.push(scope);
  }

  try {
    const result = await db.prepare(`
      SELECT
        s.promotion, s.peloton, s.grade, s.nom, s.prenom,
        s.moyenne, s.classement, r.physical_preparation,
        r.robustness_level, r.setback_recovery_level, r.mission_adaptation_level,
        r.responsibility, r.responsibility_label, r.responsibility_level,
        r.literal, r.status,
        r.platoon_validated_by, r.platoon_validated_at,
        r.company_finalized_by, r.company_finalized_at,
        r.updated_by, r.updated_at
      FROM notation_students s
      JOIN notation_records r ON r.student_id=s.id
      WHERE s.active=1 AND ${statusSql}${scopeSql}
      ORDER BY s.peloton, s.classement, s.nom, s.prenom
    `).bind(...bindings).all();

    const rows = result.results || [];
    if (!rows.length) return notationJson({ error: "Aucune notation validée n’est disponible pour cet export." }, 404);

    const headers = [
      "promotion", "peloton", "grade", "nom", "prenom", "moyenne",
      "classement", "preparation_physique_initiale", "evolution_physique",
      "reaction_aux_difficultes", "adaptation_aux_moyens_disponibles",
      "responsabilite", "responsabilite_libre", "degre_implication", "litteral", "statut", "valide_par_commandant_peloton",
      "date_validation_peloton", "finalise_par_cdu", "date_finalisation_cdu",
      "derniere_modification_par", "derniere_modification"
    ];
    const lines = [headers.join(";")];

    rows.forEach(row => {
      lines.push([
        row.promotion, row.peloton, row.grade, row.nom, row.prenom,
        row.moyenne, row.classement, physicalPreparationLabel(row.physical_preparation),
        row.robustness_level, row.setback_recovery_level, row.mission_adaptation_level,
        row.responsibility, row.responsibility_label,
        row.responsibility ? row.responsibility_level : "",
        row.literal, row.status,
        row.platoon_validated_by, row.platoon_validated_at,
        row.company_finalized_by, row.company_finalized_at,
        row.updated_by, row.updated_at
      ].map(csv).join(";"));
    });

    const fileName = `notations-${scope === "ALL" ? "compagnie" : scope.toLowerCase()}-${compactDate()}.csv`;
    return new Response(`\uFEFF${lines.join("\r\n")}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return notationJson({
      error: "L’export des notations a échoué.",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}
