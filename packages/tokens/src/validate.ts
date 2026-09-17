export interface DtcgToken {
  readonly $description?: string;
  readonly $type?: string;
  readonly $value: unknown;
}

export interface TokenValidationResult {
  readonly errors: readonly string[];
  readonly tokenCount: number;
}

function isToken(value: unknown): value is DtcgToken {
  return typeof value === "object" && value !== null && "$value" in value;
}

export function validateTokenTree(tree: unknown): TokenValidationResult {
  const errors: string[] = [];
  let tokenCount = 0;

  const visit = (value: unknown, path: string) => {
    if (isToken(value)) {
      tokenCount += 1;
      if (!("$type" in value) && path.split(".").length < 2) {
        errors.push(`${path}: token must inherit or declare a type`);
      }
      return;
    }

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`${path}: expected a token group or token`);
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (!key.startsWith("$")) visit(child, path ? `${path}.${key}` : key);
    }
  };

  visit(tree, "");
  if (tokenCount === 0) errors.push("No DTCG tokens found");

  return { errors, tokenCount };
}
