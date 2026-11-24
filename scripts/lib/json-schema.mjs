function matchesSchemaType(value, expectedType) {
  if (expectedType === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  if (expectedType === "array") {
    return Array.isArray(value);
  }
  if (expectedType === "integer") {
    return Number.isInteger(value);
  }
  if (expectedType === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  return typeof value === expectedType;
}

function decodeJsonPointerSegment(segment) {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveLocalSchemaRef(rootSchema, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    return null;
  }
  const segments = ref.slice(2).split("/").map(decodeJsonPointerSegment);
  let current = rootSchema;
  for (const seg of segments) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, seg)
    ) {
      return null;
    }
    current = current[seg];
  }
  return current && typeof current === "object" && !Array.isArray(current) ? current : null;
}

function validateObjectSchema(value, schema, label, errors, rootSchema, refStack) {
  for (const key of schema.required || []) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push(`[JSONスキーマ] ${label}: 必須フィールド '${key}' が欠落しています。`);
    }
  }

  if (schema.propertyNames && typeof schema.propertyNames === "object") {
    for (const key of Object.keys(value)) {
      collectSchemaErrors(
        key,
        schema.propertyNames,
        `${label} のキー '${key}'`,
        errors,
        rootSchema,
        refStack
      );
    }
  }

  const properties = schema.properties || {};
  for (const [key, propValue] of Object.entries(value)) {
    const childLabel = `${label}.${key}`;
    if (Object.prototype.hasOwnProperty.call(properties, key)) {
      collectSchemaErrors(propValue, properties[key], childLabel, errors, rootSchema, refStack);
      continue;
    }

    if (schema.additionalProperties === false) {
      errors.push(`[JSONスキーマ] ${label}: スキーマ未定義のプロパティ '${key}' は許可されていません。`);
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      collectSchemaErrors(
        propValue,
        schema.additionalProperties,
        childLabel,
        errors,
        rootSchema,
        refStack
      );
    }
  }
}

function validateArraySchema(value, schema, label, errors, rootSchema, refStack) {
  if (typeof schema.minItems === "number" && value.length < schema.minItems) {
    errors.push(`[JSONスキーマ] ${label}: 要素数は ${schema.minItems} 以上必要です（現在 ${value.length}）。`);
  }
  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
    errors.push(`[JSONスキーマ] ${label}: 要素数は ${schema.maxItems} 以下である必要があります（現在 ${value.length}）。`);
  }
  if (schema.items) {
    value.forEach((item, index) => {
      collectSchemaErrors(item, schema.items, `${label}[${index}]`, errors, rootSchema, refStack);
    });
  }
}

function validateStringSchema(value, schema, label, errors) {
  if (typeof schema.minLength === "number" && value.length < schema.minLength) {
    errors.push(`[JSONスキーマ] ${label}: ${schema.minLength} 文字以上必要です（現在 ${value.length}）。`);
  }
  if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
    errors.push(`[JSONスキーマ] ${label}: ${schema.maxLength} 文字以下である必要があります（現在 ${value.length}）。`);
  }
  if (typeof schema.pattern === "string") {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      errors.push(`[JSONスキーマ] ${label}: パターン /${schema.pattern}/ に一致しません（値: ${JSON.stringify(value)}）。`);
    }
  }
}

function validateNumberSchema(value, schema, label, errors) {
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    errors.push(`[JSONスキーマ] ${label}: 値は ${schema.minimum} 以上である必要があります（現在 ${value}）。`);
  }
  if (typeof schema.maximum === "number" && value > schema.maximum) {
    errors.push(`[JSONスキーマ] ${label}: 値は ${schema.maximum} 以下である必要があります（現在 ${value}）。`);
  }
}

function collectSchemaErrors(
  value,
  schema,
  label,
  errors,
  rootSchema = schema,
  refStack = new Set()
) {
  if (!schema || typeof schema !== "object") return;

  let activeSchema = schema;
  if (Object.prototype.hasOwnProperty.call(schema, "$ref")) {
    const ref = schema.$ref;
    if (refStack.has(ref)) {
      errors.push(`[JSONスキーマ] ${label}: スキーマ参照 '${ref}' が循環しています。`);
      return;
    }
    const resolved = resolveLocalSchemaRef(rootSchema, ref);
    if (!resolved) {
      errors.push(`[JSONスキーマ] ${label}: スキーマ参照 '${ref}' を解決できません。`);
      return;
    }
    const nextStack = new Set(refStack);
    nextStack.add(ref);
    collectSchemaErrors(value, resolved, label, errors, rootSchema, nextStack);

    const { $ref: _ignored, ...remaining } = schema;
    activeSchema = remaining;
  }

  if (activeSchema.type && !matchesSchemaType(value, activeSchema.type)) {
    errors.push(`[JSONスキーマ] ${label}: 型 '${activeSchema.type}' が期待されています。`);
    return;
  }

  if (Array.isArray(activeSchema.enum) && !activeSchema.enum.includes(value)) {
    errors.push(
      `[JSONスキーマ] ${label}: 許可された値 (${activeSchema.enum.join(" / ")}) のいずれかである必要があります（現在: ${JSON.stringify(value)}）。`
    );
  }

  if (activeSchema.type === "object") {
    validateObjectSchema(value, activeSchema, label, errors, rootSchema, refStack);
  } else if (activeSchema.type === "array") {
    validateArraySchema(value, activeSchema, label, errors, rootSchema, refStack);
  } else if (activeSchema.type === "string") {
    validateStringSchema(value, activeSchema, label, errors);
  } else if (activeSchema.type === "integer" || activeSchema.type === "number") {
    validateNumberSchema(value, activeSchema, label, errors);
  }
}

/**
 * 依存パッケージを使わずに data/schemas/*.schema.json の主要制約（ローカル $defs/$ref を含む）を検証し、エラー一覧を値で返す軽量 JSON Schema バリデータ。
 */
export function validateAgainstJsonSchema(value, schema, label = "value") {
  const errors = [];
  collectSchemaErrors(value, schema, label, errors, schema, new Set());
  return errors;
}
