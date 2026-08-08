
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store"
    }
  });
}

function isCadreSession(session) {
  return Boolean(
    session &&
    session.type === "user" &&
    (["cadre", "cdu", "admin"].includes(session.role))
  );
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function extensionFromFile(file) {
  const match = String(file.name || "")
    .toLowerCase()
    .match(/\.(jpe?g|png|webp|gif)$/);

  if (match) {
    return match[1] === "jpeg" ? "jpg" : match[1];
  }

  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  }[file.type] || "";
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize)
    );
  }

  return btoa(binary);
}

async function githubRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "CI6-Connect",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  return { response, data };
}

export async function onRequestPost(context) {
  const session = context.data?.session;

  if (!isCadreSession(session)) {
    return jsonResponse(
      { error: "Cette action est réservée aux cadres." },
      403
    );
  }

  let formData;

  try {
    formData = await context.request.formData();
  } catch {
    return jsonResponse(
      { error: "Le formulaire transmis est invalide." },
      400
    );
  }

  const photo = formData.get("photo");
  const requestedName =
    String(formData.get("photoName") || "").trim();
  const fichePath =
    String(formData.get("fichePath") || "").trim();
  const ficheTitle =
    String(formData.get("ficheTitle") || "").trim();

  if (!photo || typeof photo.arrayBuffer !== "function") {
    return jsonResponse(
      { error: "Aucune photo valide n’a été transmise." },
      400
    );
  }

  if (!requestedName) {
    return jsonResponse(
      { error: "Le nom de la photo est obligatoire." },
      400
    );
  }

  const allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ]);

  if (!allowedTypes.has(photo.type)) {
    return jsonResponse(
      { error: "Format refusé. Utilisez JPG, PNG, WEBP ou GIF." },
      415
    );
  }

  if (photo.size > 5 * 1024 * 1024) {
    return jsonResponse(
      { error: "La photo dépasse la taille maximale de 5 Mo." },
      413
    );
  }

  const extension = extensionFromFile(photo);

  if (!extension) {
    return jsonResponse(
      { error: "L’extension de la photo n’a pas pu être déterminée." },
      400
    );
  }

  const ficheSlug = slugify(
    fichePath.split("/").pop()?.replace(/\.md$/i, "") ||
    ficheTitle ||
    "fiche"
  );

  const photoSlug = slugify(requestedName);

  if (!photoSlug) {
    return jsonResponse(
      { error: "Le nom de la photo ne contient aucun caractère utilisable." },
      400
    );
  }

  const token = context.env.GITHUB_TOKEN;
  const owner = context.env.GITHUB_OWNER || "ci6egmln";
  const repository = context.env.GITHUB_REPO || "CI6-Connect";
  const branch = context.env.GITHUB_BRANCH || "main";

  if (!token) {
    return jsonResponse(
      { error: "Le secret GITHUB_TOKEN n’est pas configuré." },
      500
    );
  }

  const baseFileName = `${ficheSlug}-${photoSlug}`;
  let suffix = 1;
  let finalFileName = "";
  let apiUrl = "";

  try {
    while (suffix <= 50) {
      finalFileName =
        suffix === 1
          ? `${baseFileName}.${extension}`
          : `${baseFileName}-${suffix}.${extension}`;

      const repositoryPath = `assets/photos/${finalFileName}`;

      const encodedPath = repositoryPath
        .split("/")
        .map(encodeURIComponent)
        .join("/");

      apiUrl =
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${encodedPath}`;

      const existing = await githubRequest(
        `${apiUrl}?ref=${encodeURIComponent(branch)}`,
        token,
        { method: "GET" }
      );

      if (existing.response.status === 404) {
        break;
      }

      if (!existing.response.ok) {
        return jsonResponse(
          {
            error:
              existing.data.message ||
              "Impossible de vérifier le nom de la photo dans GitHub."
          },
          existing.response.status
        );
      }

      suffix += 1;
    }

    if (suffix > 50) {
      return jsonResponse(
        { error: "Trop de photos portent déjà ce nom." },
        409
      );
    }

    const buffer = await photo.arrayBuffer();
    const username = session.username || "cadre";
    const repositoryPath = `assets/photos/${finalFileName}`;

    const saved = await githubRequest(apiUrl, token, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message:
          `Ajout de la photo « ${finalFileName} » — CI6 Connect — ${username}`,
        content: arrayBufferToBase64(buffer),
        branch
      })
    });

    if (!saved.response.ok) {
      return jsonResponse(
        {
          error:
            saved.data.message ||
            "GitHub a refusé l’enregistrement de la photo."
        },
        saved.response.status
      );
    }

    return jsonResponse({
      success: true,
      path: repositoryPath,
      fileName: finalFileName,
      commit: saved.data.commit?.html_url || "",
      message: "La photo a été enregistrée dans GitHub."
    });
  } catch (error) {
    console.error("Envoi de photo vers GitHub :", error);

    return jsonResponse(
      { error: "Impossible de communiquer avec GitHub." },
      502
    );
  }
}
