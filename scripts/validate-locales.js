#!/usr/bin/env node
"use strict";

/**
 * Validates locales/*.json:
 *   1. No duplicate keys within the same object scope (JSON.parse silently
 *      keeps only the last occurrence, so a plain parse can't catch this —
 *      this script walks the raw text with its own minimal JSON parser).
 *   2. Every locale has the same set of dotted key paths as locales/en.json
 *      (the reference), in both directions (missing / extra).
 *
 * Exits 0 with a success message when everything is clean, 1 otherwise,
 * printing every violation found (not just the first).
 */

const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "locales");
const REFERENCE_LOCALE = "en.json";

// --- minimal JSON parser that also reports duplicate object keys ---------

function parseJsonTrackingDuplicates(text, fileName) {
  let i = 0;
  const duplicates = [];

  function error(message) {
    const line = text.slice(0, i).split("\n").length;
    throw new Error(`${fileName}: ${message} (near line ${line})`);
  }

  function skipWhitespace() {
    while (i < text.length && /\s/.test(text[i])) i++;
  }

  function parseString() {
    if (text[i] !== '"') error("expected string");
    i++;
    let result = "";
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\\") {
        const next = text[i + 1];
        const escapes = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
        if (next === "u") {
          result += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16));
          i += 6;
        } else if (next in escapes) {
          result += escapes[next];
          i += 2;
        } else {
          error(`invalid escape sequence \\${next}`);
        }
      } else {
        result += text[i];
        i++;
      }
    }
    if (text[i] !== '"') error("unterminated string");
    i++;
    return result;
  }

  function parseNumber() {
    const start = i;
    while (i < text.length && /[-+0-9.eE]/.test(text[i])) i++;
    return Number(text.slice(start, i));
  }

  function parseLiteral() {
    if (text.startsWith("true", i)) {
      i += 4;
      return true;
    }
    if (text.startsWith("false", i)) {
      i += 5;
      return false;
    }
    if (text.startsWith("null", i)) {
      i += 4;
      return null;
    }
    error(`unexpected token '${text[i]}'`);
  }

  function parseArray(pathPrefix) {
    i++; // [
    const result = [];
    skipWhitespace();
    if (text[i] === "]") {
      i++;
      return result;
    }
    let index = 0;
    for (;;) {
      skipWhitespace();
      result.push(parseValue(`${pathPrefix}[${index}]`));
      index++;
      skipWhitespace();
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "]") {
        i++;
        break;
      }
      error("expected ',' or ']' in array");
    }
    return result;
  }

  function parseObject(pathPrefix) {
    i++; // {
    const result = {};
    const seenKeys = new Set();
    skipWhitespace();
    if (text[i] === "}") {
      i++;
      return result;
    }
    for (;;) {
      skipWhitespace();
      const key = parseString();
      const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      if (seenKeys.has(key)) {
        duplicates.push(fullPath);
      }
      seenKeys.add(key);
      skipWhitespace();
      if (text[i] !== ":") error(`expected ':' after key "${key}"`);
      i++;
      skipWhitespace();
      result[key] = parseValue(fullPath);
      skipWhitespace();
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "}") {
        i++;
        break;
      }
      error(`expected ',' or '}' after value for key "${key}"`);
    }
    return result;
  }

  function parseValue(pathPrefix) {
    skipWhitespace();
    const c = text[i];
    if (c === "{") return parseObject(pathPrefix);
    if (c === "[") return parseArray(pathPrefix);
    if (c === '"') return parseString();
    if (c === "-" || /[0-9]/.test(c)) return parseNumber();
    return parseLiteral();
  }

  skipWhitespace();
  const value = parseValue("");
  skipWhitespace();
  if (i !== text.length) error("unexpected trailing content");

  return { value, duplicates };
}

// --- key-set flattening ----------------------------------------------------

function flattenKeys(value, prefix, out) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of Object.keys(value)) {
      flattenKeys(value[key], prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.add(prefix);
  }
  return out;
}

// --- main --------------------------------------------------------------

function main() {
  const files = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith(".json"));
  const violations = [];
  const parsed = {};

  for (const file of files) {
    const fullPath = path.join(LOCALES_DIR, file);
    const text = fs.readFileSync(fullPath, "utf8");
    try {
      const { value, duplicates } = parseJsonTrackingDuplicates(text, file);
      parsed[file] = value;
      for (const dupPath of duplicates) {
        violations.push(`${file}: duplicate key "${dupPath}"`);
      }
    } catch (err) {
      violations.push(err.message);
    }
  }

  if (!parsed[REFERENCE_LOCALE]) {
    violations.push(`${REFERENCE_LOCALE} not found or failed to parse — cannot check key parity`);
  } else {
    const referenceKeys = flattenKeys(parsed[REFERENCE_LOCALE], "", new Set());

    for (const file of files) {
      if (file === REFERENCE_LOCALE || !parsed[file]) continue;
      const fileKeys = flattenKeys(parsed[file], "", new Set());

      for (const key of referenceKeys) {
        if (!fileKeys.has(key)) violations.push(`${file}: missing key "${key}"`);
      }
      for (const key of fileKeys) {
        if (!referenceKeys.has(key)) violations.push(`${file}: extra key "${key}" not present in ${REFERENCE_LOCALE}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error(`Locale validation failed with ${violations.length} issue(s):\n`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }

  console.log(`Locale validation passed — ${files.length} file(s) checked, no duplicate or mismatched keys.`);
}

if (require.main === module) {
  main();
}

module.exports = { parseJsonTrackingDuplicates, flattenKeys };
