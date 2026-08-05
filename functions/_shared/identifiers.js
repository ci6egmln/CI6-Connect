export const IDENTIFIER_PATTERN = /^[A-Z]{3}\d{3}$/;

const IDENTIFIER_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function secureRandomIndex(length) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % length;
}

function normalizeLetters(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

export function cadrePrefix(displayName) {
  return (normalizeLetters(displayName) + "XXX").slice(0, 3);
}

function randomDigits() {
  let digits = "";
  for (let index = 0; index < 3; index += 1) {
    digits += String(secureRandomIndex(10));
  }
  return digits;
}

export function candidateIdentifier(role, displayName = "") {
  if (["cadre", "admin"].includes(role)) {
    return `${cadrePrefix(displayName)}${randomDigits()}`;
  }

  let letters = "";
  for (let index = 0; index < 3; index += 1) {
    letters += IDENTIFIER_LETTERS[secureRandomIndex(IDENTIFIER_LETTERS.length)];
  }
  return `${letters}${randomDigits()}`;
}

export async function generateUniqueIdentifier(
  db,
  role,
  displayName = "",
  reserved = new Set()
) {
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const candidate = candidateIdentifier(role, displayName);
    if (reserved.has(candidate)) continue;

    const existing = await db
      .prepare("SELECT 1 FROM users WHERE username = ? LIMIT 1")
      .bind(candidate)
      .first();

    if (!existing) {
      reserved.add(candidate);
      return candidate;
    }
  }

  throw new Error("Impossible de générer un identifiant unique.");
}
