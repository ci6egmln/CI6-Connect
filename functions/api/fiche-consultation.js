function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

function cleanText(value, maximumLength) {
  return String(value || "")
    .trim()
    .slice(0, maximumLength);
}

function validConsultationId(value) {
  return /^[a-zA-Z0-9_-]{10,100}$/.test(value);
}

export async function onRequestPost(context) {
  const session = context.data.session;

  /*
   * La journalisation nominative ne concerne
   * que les comptes individuels.
   */
  if (!session || session.type !== "user") {
    return jsonResponse({
      ignored: true,
      reason: "individual_account_required"
    });
  }

  let body;

  try {
    body = await context.request.json();
  } catch {
    return jsonResponse(
      {
        error: "Requête invalide."
      },
      400
    );
  }

  const action = cleanText(body.action, 20);

  if (action === "open") {
    const consultationId =
      cleanText(body.consultationId, 100);

    const ficheId =
      cleanText(body.ficheId, 150);

    const ficheTitle =
      cleanText(body.ficheTitle, 250);

    const fichePath =
      cleanText(body.fichePath, 500);

    const ficheVersion =
      cleanText(body.ficheVersion || "1", 50);

    const promotion =
      cleanText(body.promotion, 100);

    if (
      !validConsultationId(consultationId) ||
      !ficheId ||
      !ficheTitle
    ) {
      return jsonResponse(
        {
          error:
            "Informations de consultation incomplètes."
        },
        400
      );
    }

    try {
      await context.env.DB
        .prepare(`
          INSERT INTO fiche_consultations (
            id,
            username,
            role,
            fiche_id,
            fiche_title,
            fiche_path,
            fiche_version,
            promotion,
            opened_at,
            closed_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)
        `)
        .bind(
          consultationId,
          session.username,
          session.role,
          ficheId,
          ficheTitle,
          fichePath || null,
          ficheVersion || "1",
          promotion || null
        )
        .run();

      return jsonResponse({
        success: true,
        action: "open",
        consultationId
      });

    } catch (error) {
      /*
       * Un doublon d’identifiant ne doit pas
       * créer une deuxième consultation.
       */
      if (
        String(error.message || "")
          .toLowerCase()
          .includes("unique")
      ) {
        return jsonResponse({
          success: true,
          duplicate: true,
          consultationId
        });
      }

      return jsonResponse(
        {
          error:
            "Impossible d’enregistrer l’ouverture."
        },
        500
      );
    }
  }

  if (action === "close") {
    const consultationId =
      cleanText(body.consultationId, 100);

    if (!validConsultationId(consultationId)) {
      return jsonResponse(
        {
          error:
            "Identifiant de consultation invalide."
        },
        400
      );
    }

    try {
      const result = await context.env.DB
        .prepare(`
          UPDATE fiche_consultations
          SET closed_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND username = ?
            AND closed_at IS NULL
        `)
        .bind(
          consultationId,
          session.username
        )
        .run();

      return jsonResponse({
        success: true,
        action: "close",
        consultationId,
        updated:
          Number(result.meta?.changes || 0) > 0
      });

    } catch {
      return jsonResponse(
        {
          error:
            "Impossible d’enregistrer la fermeture."
        },
        500
      );
    }
  }

  return jsonResponse(
    {
      error: "Action inconnue."
    },
    400
  );
}
