import { sendPushNotifications } from "../_shared/push.js";


function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "private, no-store"
      }
    }
  );
}

function isCadreSession(session) {
  return Boolean(
    session &&
    session.type === "user" &&
    (
      session.role === "cadre" ||
      session.role === "admin"
    )
  );
}

function utf8ToBase64(value) {
  const bytes =
    new TextEncoder().encode(value);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function safePath(value) {
  const path =
    String(value || "").trim();

  if (
    !path.startsWith("content/") ||
    !path.endsWith(".md") ||
    path.includes("..") ||
    path.includes("\\")
  ) {
    return "";
  }

  return path;
}

async function githubRequest(
  url,
  token,
  options = {}
) {
  const response = await fetch(
    url,
    {
      ...options,
      headers: {
        "Accept":
          "application/vnd.github+json",
        "Authorization":
          `Bearer ${token}`,
        "X-GitHub-Api-Version":
          "2022-11-28",
        "User-Agent":
          "CI6-Connect",
        ...(options.headers || {})
      }
    }
  );

  const text =
    await response.text();

  let data = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      message: text
    };
  }

  return {
    response,
    data
  };
}

export async function onRequestPost(context) {
  const session =
    context.data?.session;

  if (!isCadreSession(session)) {
    return jsonResponse(
      {
        error:
          "Cette action est réservée aux cadres."
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
        error: "Requête invalide."
      },
      400
    );
  }

  const path =
    safePath(body.path);

  const markdown =
    String(body.markdown || "");

  const title =
    String(body.title || "Fiche")
      .trim()
      .slice(0, 120);

  if (!path) {
    return jsonResponse(
      {
        error:
          "Le chemin de la fiche est invalide."
      },
      400
    );
  }

  if (!markdown.trim()) {
    return jsonResponse(
      {
        error:
          "Le contenu de la fiche est vide."
      },
      400
    );
  }

  if (markdown.length > 500000) {
    return jsonResponse(
      {
        error:
          "La fiche est trop volumineuse."
      },
      413
    );
  }

  const token =
    context.env.GITHUB_TOKEN;

  const owner =
    context.env.GITHUB_OWNER ||
    "ci6egmln";

  const repository =
    context.env.GITHUB_REPO ||
    "CI6-Connect";

  const branch =
    context.env.GITHUB_BRANCH ||
    "main";

  if (!token) {
    return jsonResponse(
      {
        error:
          "Le secret GITHUB_TOKEN n’est pas configuré dans Cloudflare."
      },
      500
    );
  }

  const encodedPath =
    path
      .split("/")
      .map(encodeURIComponent)
      .join("/");

  const apiUrl =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${encodedPath}`;

  let sha = "";

  try {
    const current =
      await githubRequest(
        `${apiUrl}?ref=${encodeURIComponent(branch)}`,
        token,
        {
          method: "GET"
        }
      );

    if (current.response.ok) {
      sha =
        current.data.sha || "";
    } else if (
      current.response.status !== 404
    ) {
      return jsonResponse(
        {
          error:
            current.data.message ||
            "Impossible de lire la fiche dans GitHub."
        },
        current.response.status
      );
    }

    const username =
      session.username ||
      "cadre";

    const message =
      `${sha ? "Mise à jour" : "Création"} de la fiche « ${title || path} » — CI6 Connect — ${username}`;

    const payload = {
      message,
      content:
        utf8ToBase64(markdown),
      branch
    };

    if (sha) {
      payload.sha = sha;
    }

    const saved =
      await githubRequest(
        apiUrl,
        token,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify(payload)
        }
      );

    if (!saved.response.ok) {
      return jsonResponse(
        {
          error:
            saved.data.message ||
            "GitHub a refusé l’enregistrement."
        },
        saved.response.status
      );
    }

    let notification = null;

    if (body.notify === true) {
      const safeUrl = (() => {
        const value = String(body.notificationUrl || "/").trim();
        return value.startsWith("/") && !value.startsWith("//")
          ? value
          : "/";
      })();

      const actionLabel = sha ? "mise à jour" : "nouvelle fiche";
      const notificationTitle =
        String(body.notificationTitle || "").trim().slice(0, 100) ||
        `CI6 Connect — ${title}`;
      const notificationBody =
        String(body.notificationBody || "").trim().slice(0, 240) ||
        `Une ${actionLabel} est disponible : ${title}.`;

      try {
        notification = await sendPushNotifications(
          context.env,
          {
            audience: ["all", "eleves", "cadres"].includes(body.notificationAudience)
              ? body.notificationAudience
              : "all",
            notification: {
              title: notificationTitle,
              body: notificationBody,
              url: safeUrl,
              tag: `fiche:${path}`,
              renotify: true,
              urgent: Boolean(body.notificationUrgent)
            }
          }
        );
      } catch (notificationError) {
        console.error("Notification Push :", notificationError);
        notification = {
          sent: 0,
          failed: 0,
          removed: 0,
          error: String(notificationError?.message || notificationError)
        };
      }
    }

    return jsonResponse({
      success: true,
      path,
      commit:
        saved.data.commit?.html_url || "",
      notification,
      message:
        "La fiche a été enregistrée dans GitHub."
    });

  } catch (error) {
    console.error(
      "Publication GitHub :",
      error
    );

    return jsonResponse(
      {
        error:
          "Impossible de communiquer avec GitHub."
      },
      502
    );
  }
}
