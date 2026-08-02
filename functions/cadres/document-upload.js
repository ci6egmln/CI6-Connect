
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
    (session.role === "cadre" || session.role === "admin")
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

function extensionFromDocument(file) {
  const match = String(file.name || "")
    .toLowerCase()
    .match(/\.([a-z0-9]{1,8})$/);

  return match ? match[1] : "";
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

  const document = formData.get("document");
  const requestedName =
    String(formData.get("documentName") || "").trim();
  const fichePath =
    String(formData.get("fichePath") || "").trim();
  const ficheTitle =
    String(formData.get("ficheTitle") || "").trim();

  if (!document || typeof document.arrayBuffer !== "function") {
    return jsonResponse(
      { error: "Aucun document valide n’a été transmise." },
      400
    );
  }

  if (!requestedName) {
    return jsonResponse(
      { error: "Le nom du document est obligatoire." },
      400
    );
  }

  const allowedExtensions = new Set([
    "pdf","doc","docx","xls","xlsx","ods","odt",
    "ppt","pptx","csv","txt","zip"
  ]);

  if (!allowedTypes.has(document.type)) {
    return jsonResponse(
      { error: "Format refusé. Utilisez JPG, PNG, WEBP ou GIF." },
      415
    );
  }

  if (document.size > 5 * 1024 * 1024) {
    return jsonResponse(
      { error: "Le document dépasse la taille maximale de 5 Mo." },
      413
    );
  }

  const extension = extensionFromFile(document);

  if (!extension) {
    return jsonResponse(
      { error: "L’extension du document n’a pas pu être déterminée." },
      400
    );
  }

  const ficheSlug = slugify(
    fichePath.split("/").pop()?.replace(/\.md$/i, "") ||
    ficheTitle ||
    "fiche"
  );

  const documentSlug = slugify(requestedName);

  if (!documentSlug) {
    return jsonResponse(
      { error: "Le nom du document ne contient aucun caractère utilisable." },
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

  const baseFileName = `${ficheSlug}-${documentSlug}`;
  let suffix = 1;
  let finalFileName = "";
  let apiUrl = "";

  try {
    while (suffix <= 50) {
      finalFileName =
        suffix === 1
          ? `${baseFileName}.${extension}`
          : `${baseFileName}-${suffix}.${extension}`;

      const repositoryPath = `assets/documents/${finalFileName}`;

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
              "Impossible de vérifier le nom du document dans GitHub."
          },
          existing.response.status
        );
      }

      suffix += 1;
    }

    if (suffix > 50) {
      return jsonResponse(
        { error: "Trop de documents portent déjà ce nom." },
        409
      );
    }

    const buffer = await document.arrayBuffer();
    const username = session.username || "cadre";
    const repositoryPath = `assets/documents/${finalFileName}`;

    const saved = await githubRequest(apiUrl, token, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message:
          `Ajout du document « ${finalFileName} » — CI6 Connect — ${username}`,
        content: arrayBufferToBase64(buffer),
        branch
      })
    });

    if (!saved.response.ok) {
      return jsonResponse(
        {
          error:
            saved.data.message ||
            "GitHub a refusé l’enregistrement du document."
        },
        saved.response.status
      );
    }

    return jsonResponse({
      success: true,
      path: repositoryPath,
      fileName: finalFileName,
      commit: saved.data.commit?.html_url || "",
      message: "Le document a été enregistré dans GitHub."
    });
  } catch (error) {
    console.error("Envoi de document vers GitHub :", error);

    return jsonResponse(
      { error: "Impossible de communiquer avec GitHub." },
      502
    );
  }
}
