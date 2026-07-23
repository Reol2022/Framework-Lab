import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { ErrorObject, ValidateFunction } from "ajv";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020") as new (options: {
  allErrors: boolean;
  strict: boolean;
}) => { compile(schema: object): ValidateFunction };
const addFormats = require("ajv-formats") as (ajv: object) => void;

const validators = new Map<string, ValidateFunction>();

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "校验失败"}`)
    .join("; ");
}

export async function validateWithSchema(
  labRoot: string,
  schemaFile: string,
  value: unknown,
): Promise<void> {
  const schemaPath = path.resolve(labRoot, "schemas", schemaFile);
  const cached = validators.get(schemaPath);
  let validate: ValidateFunction;

  if (cached) {
    validate = cached;
  } else {
    const schema = JSON.parse(await readFile(schemaPath, "utf8")) as object;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    validate = ajv.compile(schema);
    validators.set(schemaPath, validate);
  }

  if (!validate(value)) {
    throw new Error(`${schemaFile} 校验失败：${formatErrors(validate.errors)}`);
  }
}
