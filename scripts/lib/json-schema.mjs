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

function validateObjectSchema(value, schema, label, errors) {
  for (const key of schema.required || []) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push(`[JSONスキーマ] ${label}: 必須フィールド '${key}' が欠落しています。`);
    }
  }

  if (schema.propertyNames && typeof schema.propertyNames === "object") {
    for (const key of Object.keys(value)) {
      collectSchemaErrors(key, schema.propertyNames, `${label} のキー '${key}'`, errors);
    }
  }

  const properties = schema.properties || {};
  for (const [key, propValue] of Object.entries(value)) {
    const childLabel = `${label}.${key}`;
    if (Object.prototype.hasOwnProperty.call(properties, key)) {
      collectSchemaErrors(propValue, properties[key], childLabel, errors);
      continue;
    }

    if (schema.additionalProperties === false) {
      errors.push(`[JSONスキーマ] ${label}: スキーマ未定義のプロパティ '${key}' は許可されていません。`);
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      collectSchemaErrors(propValue, schema.additionalProperties, childLabel, errors);
    }
  }
}

function validateArraySchema(value, schema, label, errors) {
  if (typeof schema.minItems === "number" && value.length < schema.minItems) {
    errors.push(`[JSONスキーマ] ${label}: 要素数は ${schema.minItems} 以上必要です（現在 ${value.length}）。`);
  }
  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
    errors.push(`[JSONスキーマ] ${label}: 要素数は ${schema.maxItems} 以下である必要があります（現在 ${value.length}）。`);
  }
  if (schema.items) {
    value.forEach((item, index) => {
      collectSchemaErrors(item, schema.items, `${label}[${index}]`, errors);
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

function collectSchemaErrors(value, schema, label, errors) {
  if (!schema || typeof schema !== "object") return;

  if (schema.type && !matchesSchemaType(value, schema.type)) {
    errors.push(`[JSONスキーマ] ${label}: 型 '${schema.type}' が期待されています。`);
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(
      `[JSONスキーマ] ${label}: 許可された値 (${schema.enum.join(" / ")}) のいずれかである必要があります（現在: ${JSON.stringify(value)}）。`
    );
  }

  if (schema.type === "object") {
    validateObjectSchema(value, schema, label, errors);
  } else if (schema.type === "array") {
    validateArraySchema(value, schema, label, errors);
  } else if (schema.type === "string") {
    validateStringSchema(value, schema, label, errors);
  } else if (schema.type === "integer" || schema.type === "number") {
    validateNumberSchema(value, schema, label, errors);
  }
}

/**
 * 依存パッケージを使わずに data/schemas/*.schema.json の主要制約を検証し、エラー一覧を値で返す軽量 JSON Schema バリデータ。
 */
export function validateAgainstJsonSchema(value, schema, label = "value") {
  const errors = [];
  collectSchemaErrors(value, schema, label, errors);
  return errors;
}
