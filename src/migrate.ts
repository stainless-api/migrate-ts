#!/usr/bin/env node
import * as t from "@babel/types";
import * as parser from "@babel/parser";
import traverse, {
  type Node,
  type NodePath,
  type Scope,
} from "@babel/traverse";
import generate from "@babel/generator";
import MagicString from "magic-string";
import { readFileSync } from "node:fs";
import { basename, dirname, relative } from "node:path";
export { findUpSync } from "find-up-simple";

interface FileInfo {
  /** The path to the current file. */
  path: string;
  /** The source code of the current file. */
  source: string;
}

function lookupBinding(scope: Scope, name: string): unknown {
  const b = scope?.getBinding(name) || "$global$" + name;
  return b;
}

function findLastIndex<T>(
  arr: T[],
  callback: (item: T, i: number, arr: T[]) => boolean
): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (callback(arr[i]!, i, arr)) return i;
  }
  return -1;
}

const regexp = (str: TemplateStringsArray, ...params: (string | RegExp)[]) =>
  new RegExp(
    String.raw(
      str,
      ...params.map((e) =>
        typeof e === "string"
          ? e.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d")
          : e.source
      )
    )
  );

import type { DiffType } from "@std/internal/types";
import pc from "picocolors";
import { diff } from "@std/internal/diff";
import jsTokens, { type JSXToken, type Token } from "js-tokens";
function createSign(diffType: DiffType): string {
  switch (diffType) {
    case "added":
      return "+";
    case "removed":
      return "-";
    default:
      return " ";
  }
}
function createColor(
  diffType: DiffType,
  background = false
): (s: string) => string {
  switch (diffType) {
    case "added":
      return (s) =>
        background ? pc.bgGreen(pc.white(s)) : pc.green(pc.bold(s));
    case "removed":
      return (s) => (background ? pc.bgRed(pc.white(s)) : pc.red(pc.bold(s)));
    default:
      return pc.white;
  }
}

/**
 * RegExp to test for the three types of brackets.
 */
import {
  isStrictReservedWord,
  isKeyword,
} from "@babel/helper-validator-identifier";
import type { Formatter } from "picocolors/types.js";
const sometimesKeywords = new Set(["as", "async", "from", "get", "of", "set"]);
const colorize = function (token: Token | JSXToken): Formatter {
  if (token.type === "IdentifierName" || token.type === "JSXIdentifier") {
    if (
      isKeyword(token.value) ||
      isStrictReservedWord(token.value, true) ||
      sometimesKeywords.has(token.value)
    ) {
      return pc.cyan;
    }

    return pc.blue;
  }

  switch (token.type) {
    case "NumericLiteral":
      return pc.yellow;

    case "StringLiteral":
    case "JSXString":
    case "NoSubstitutionTemplate":
      return pc.yellow;

    case "RegularExpressionLiteral":
      return pc.magenta;

    case "Punctuator":
    case "JSXPunctuator":
      return String;

    case "MultiLineComment":
    case "SingleLineComment":
      return pc.gray;

    case "Invalid":
    case "JSXInvalid":
      return String;

    default:
      return String;
  }
};
/** Ways that lines in a diff can be different. */
export type DiffType = "removed" | "common" | "added";

/**
 * Represents the result of a diff operation.
 *
 * @typeParam T The type of the value in the diff result.
 */
export interface DiffResult<T> {
  /** The type of the diff. */
  type: DiffType;
  /** The value of the diff. */
  value: T;
  /** The details of the diff. */
  details?: DiffResult<T>[];
}

/**
 * Interface for skipped lines in diff output
 */
interface SkippedLines {
  type: "skipped";
  value: string;
  skippedLineCount: number;
}

export function print(file: string, source: string, out: string): string {
  const diffResult = diff(source.split("\n"), out.split("\n"));

  // Filter common lines that are far from changes
  const filteredDiffResult = filterCommonLines<string>(diffResult, 5);

  const highlightedLines: string[] = [""];
  for (const token of jsTokens(source, { jsx: file.endsWith("x") })) {
    const color = colorize(token);
    const lines = token.value.split("\n");
    highlightedLines[highlightedLines.length - 1] += color(lines.shift() || "");
    while (lines.length) {
      highlightedLines.push("");
      highlightedLines[highlightedLines.length - 1] += color(
        lines.shift() || ""
      );
    }
  }

  const gutterSize = highlightedLines.length.toString().length;
  let lineNo = 0;

  const diffMessages = filteredDiffResult.map((result) => {
    if (result.type === "skipped") {
      // For skipped lines, advance the line counter and create a visual indicator
      if ((result as SkippedLines).skippedLineCount) {
        lineNo += (result as SkippedLines).skippedLineCount;
      }
      return `${pc.dim("   " + "…".padStart(gutterSize) + "▕")} ${pc.dim(
        result.value
      )}\n`;
    }

    if (result.type !== "added") lineNo++;
    const color = createColor(result.type);
    const colorBg = createColor(result.type, true);

    return `${colorBg(
      " " +
        createSign(result.type) +
        " " +
        (result.type === "added"
          ? "~".repeat((lineNo + "").length)
          : lineNo + ""
        ).padStart(gutterSize) +
        "▕"
    )} ${
      result.type === "common"
        ? highlightedLines[lineNo - 1]
        : color(result.value)
    }\n`;
  });

  const title = " changes for " + file + ": ";
  return `\n${pc.dim("┌" + "─".repeat(title.length) + "┐")}\n${pc.dim(
    "│"
  )}${pc.bold(title)}${pc.dim("│")}\n${pc.dim(
    "└" + "─".repeat(title.length) + "┘"
  )}\n${diffMessages.join("")}\n`;
}

/**
 * Filters common lines from diff results that are more than maxDistance
 * away from any added or removed line.
 *
 * @param diffResult - The original diff result array
 * @param maxDistance - Maximum distance (in lines) from a change to keep common lines
 * @returns A filtered diff result with skipped line indicators
 */
function filterCommonLines<T>(
  diffResult: DiffResult<T>[],
  maxDistance: number
): (DiffResult<T> | SkippedLines)[] {
  // First pass: mark the lines that are within maxDistance of a change
  const nearChange = new Array(diffResult.length).fill(false);

  // Find all changed lines (added or removed)
  const changedIndices = diffResult
    .map((result, index) => (result.type !== "common" ? index : -1))
    .filter((index) => index !== -1);

  // No changes? Return the original
  if (changedIndices.length === 0) {
    return diffResult;
  }

  // Mark lines that are within maxDistance of any change
  for (let i = 0; i < diffResult.length; i++) {
    // Skip if it's already a change
    if (diffResult[i]!.type !== "common") {
      nearChange[i] = true;
      continue;
    }

    // Check distance to nearest change
    const distanceToChange = Math.min(
      ...changedIndices.map((changeIndex) => Math.abs(i - changeIndex))
    );

    if (distanceToChange <= maxDistance) {
      nearChange[i] = true;
    }
  }

  // Build the filtered result
  const filteredResult: (DiffResult<T> | SkippedLines)[] = [];
  let skippedLines = 0;
  let consecutiveSkipped: DiffResult<T>[] = [];

  for (let i = 0; i < diffResult.length; i++) {
    if (nearChange[i] || diffResult[i]!.type !== "common") {
      // If we skipped lines before this, add an ellipsis marker with line count
      if (skippedLines > 0) {
        // Calculate how many line numbers we're skipping (for correct numbering)
        // We need to count removed lines but not added lines
        const skippedLineCount = consecutiveSkipped.filter(
          (item) => item.type !== "added"
        ).length;

        filteredResult.push({
          type: "skipped",
          value: `${skippedLines} line${skippedLines > 1 ? "s" : ""} skipped`,
          skippedLineCount: skippedLineCount,
        });
        skippedLines = 0;
        consecutiveSkipped = [];
      }
      filteredResult.push(diffResult[i]!);
    } else {
      skippedLines++;
      consecutiveSkipped.push(diffResult[i]!);
    }
  }

  // If we ended with skipped lines, add the ellipsis marker
  if (skippedLines > 0) {
    // Calculate how many line numbers we're skipping
    const skippedLineCount = consecutiveSkipped.filter(
      (item) => item.type !== "added"
    ).length;

    filteredResult.push({
      type: "skipped",
      value: `${skippedLines} line${skippedLines > 1 ? "s" : ""} skipped`,
      skippedLineCount: skippedLineCount,
    });
  }

  return filteredResult;
}
export default function transformer(file: FileInfo, _: unknown, options: any) {
  let pkg: string,
    githubRepo: string,
    clientClass: string,
    baseClientClass: string | undefined,
    methods: {
      base: string;
      name: string;
      oldName: string | undefined;
      oldBase: string | undefined;
      oldParams:
        | (
            | {
                type: "param";
                key: string;
                location: string;
              }
            | { type: "params"; maybeOverload: boolean }
            | { type: "options" }
          )[]
        | undefined;
      params:
        | (
            | {
                type: "param";
                key: string;
                location: string;
              }
            | { type: "params"; maybeOverload: false }
            | { type: "options" }
          )[]
        | undefined;
    }[];

  ({ pkg, githubRepo, clientClass, baseClientClass, methods } =
    options.migrationConfig);
  const magicString = new MagicString(file.source);
  const tsParser = file.path.match(/\.[mc]?([tj]sx?)$/i)?.[1];
  if (tsParser && basename(file.path).includes(".d.")) return;
  function removeNode(path: {
    getPrevSibling(): { node: Node | undefined } | undefined;
    getNextSibling(): { node: Node | undefined } | undefined;
    node: Node;
    parent: Node | undefined;
  }) {
    if (t.isStatement(path.node)) {
      magicString.remove(path.node.start!, path.node.end!);
      return;
    }
    const prev = path.getPrevSibling()?.node;
    const next = path.getNextSibling()?.node;
    if (prev) {
      magicString.remove(prev.end!, path.node.end!);
    } else if (next) {
      magicString.remove(path.node.start!, next.start!);
    } else {
      magicString.remove(path.node.start!, path.node.end!);
    }
    const trailingComma = Number(path.parent?.extra?.["trailingComma"]);
    if (!next && trailingComma) {
      magicString.remove(trailingComma, trailingComma + 1);
    }
  }
  if (!regexp`client|${pkg}|${clientClass}`.test(file.source)) return;
  const parsed = parser.parse(file.source, {
    sourceFilename: file.path,
    sourceType: "module",
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    startLine: 1,
    tokens: true,
    plugins: (
      [
        "asyncGenerators",
        "decoratorAutoAccessors",
        "bigInt",
        "classPrivateMethods",
        "classPrivateProperties",
        "classProperties",
        "decorators-legacy",
        "doExpressions",
        "dynamicImport",
        "exportDefaultFrom",
        "exportNamespaceFrom",
        "functionBind",
        "functionSent",
        "importAttributes",
        "importMeta",
        "nullishCoalescingOperator",
        "numericSeparator",
        "objectRestSpread",
        "optionalCatchBinding",
        "optionalChaining",
        ["pipelineOperator", { proposal: "minimal" }],
        "throwExpressions",
        tsParser?.[0] === "t" && "typescript",
        (tsParser?.[0] !== "t" || tsParser?.at(-1) === "x") && "jsx",
        tsParser?.[0] !== "t" &&
          file.source.slice(0, 1000).includes("@flow") &&
          "flow",
        "deprecatedImportAssert",
      ] satisfies (parser.ParserPlugin | false)[] as (
        | parser.ParserPlugin
        | false
      )[]
    ).filter((e): e is parser.ParserPlugin => !!e),
  });
  const importBindings = new Map<
    unknown,
    [
      t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier,
      string
    ]
  >();
  let importIdx = parsed.program.interpreter?.end || 0;
  let addedHashbangNewline = false;
  if (importIdx && file.source[importIdx] === "\n") {
    importIdx++;
    addedHashbangNewline = true;
  }
  let hasRequire = false,
    hasImport = false;
  function importName(name: string, from: string, asName?: string) {
    for (const [, [specifier, source]] of importBindings) {
      if (source.replace(/^node:/, "") !== from.replace(/^node:/, "")) continue;
      if (
        specifier.type === "ImportNamespaceSpecifier" ||
        (from === "node:fs" &&
          (specifier.type === "ImportDefaultSpecifier" ||
            (specifier.type === "ImportSpecifier" &&
              (specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : specifier.imported.value) === "default")))
      )
        return specifier.local.name + "." + name;
      if (
        specifier.type === "ImportDefaultSpecifier" &&
        (name === "default" || (name === clientClass && from === pkg))
      )
        return specifier.local.name;
      if (specifier.type === "ImportSpecifier") {
        const imported =
          specifier.imported.type === "Identifier"
            ? specifier.imported.name
            : specifier.imported.value;
        if (
          imported === name ||
          (imported === "default" && name === clientClass && from === pkg)
        )
          return specifier.local.name;
      }
    }
    const newName = claim(asName || name);
    magicString.appendLeft(
      importIdx,
      (importIdx && !addedHashbangNewline ? "\n" : "") +
        (hasRequire && !hasImport
          ? `const { ${name}${
              newName !== name ? `: ${newName}` : ""
            } } = require(${JSON.stringify(from)});\n`
          : name === "default"
          ? `import ${newName} from ${JSON.stringify(from)};\n`
          : `import { ${name}${
              newName !== name ? ` as ${newName}` : ""
            } } from ${JSON.stringify(from)};\n`)
    );
    if (importIdx) addedHashbangNewline = true;
    importBindings.set(Symbol(), [
      t.importSpecifier(t.identifier(newName), t.identifier(name)),
      from,
    ]);
    return newName;
  }
  const ids = new Set<string>();
  function claim(name: string) {
    let i = 0;
    let newName = name;
    while (ids.has(newName)) newName = name + "_" + (i || "");
    return newName;
  }
  traverse.default(parsed, {
    CallExpression(path) {
      if (
        !(
          path.node.callee.type === "Identifier" &&
          path.node.callee.name === "require" &&
          path.node.arguments[0]?.type === "StringLiteral" &&
          regexp`^(${pkg}|fs|node:fs|node-fetch)($|\/)`.test(
            path.node.arguments[0].value as string
          )
        )
      )
        return;
      hasRequire = true;
      const { parent } = path;
      let property =
        parent && parent.type === "MemberExpression"
          ? parent.property
          : undefined;
      if (
        property &&
        !(property.type === "Identifier" || property.type === "StringLiteral")
      )
        return;

      let importSource = path.node.arguments[0].value;
      if (regexp`^${pkg}\/src($|\/)`.test(importSource)) {
        importSource = importSource
          .replace(/\.ts$/, "")
          .replace(regexp`^(${pkg})\/src($|\/)`, "$1$2");
        magicString.overwrite(
          path.node.arguments[0].start!,
          path.node.arguments[0].end!,
          JSON.stringify(importSource)
        );
      }

      let declarator: NodePath | null =
        parent && parent.type === "MemberExpression"
          ? path.parentPath.parentPath
          : path.parentPath;
      if (declarator?.type === "ExpressionStatement") {
        if (
          regexp`^${pkg}\/(_?shims($|\/)|core(\.m?js)?$)`.test(importSource)
        ) {
          removeNode(declarator);
        }
        return;
      }
      if (!(declarator && declarator.node.type === "VariableDeclarator"))
        return;
      let declaration: NodePath | null = declarator.parentPath;
      if (!(declaration && declaration.node.type === "VariableDeclaration"))
        return;

      let removedDeclarator = false;
      if (regexp`^${pkg}\/(_?shims($|\/)|core(\.m?js)?$)`.test(importSource)) {
        removeNode(declarator);
        removedDeclarator = true;
      }
      if (declaration.node.declarations.length === 1 && removedDeclarator) {
        removeNode(declaration);
      }
      const pattern = declarator.node.id;
      if (property) {
        if (pattern.type !== "Identifier") return;
        const s = t.importSpecifier(
          pattern,
          t.identifier(
            property.type === "Identifier" ? property.name : property.value
          )
        );
        importBindings.set(lookupBinding(path.scope, pattern.name), [
          s,
          importSource,
        ]);
        return;
      }
      if (pattern.type === "Identifier") {
        const s = t.importNamespaceSpecifier(pattern);
        importBindings.set(lookupBinding(path.scope, pattern.name), [
          s,
          importSource,
        ]);
      } else if (pattern.type === "ObjectPattern") {
        pattern.properties.forEach((prop, i) => {
          if (
            prop.type !== "ObjectProperty" ||
            prop.value.type !== "Identifier" ||
            prop.key.type !== "Identifier"
          )
            return;
          const s = t.importSpecifier(prop.value, prop.key);
          importBindings.set(lookupBinding(path.scope, prop.value.name), [
            s,
            importSource,
          ]);
          if (
            regexp`^${pkg}(\/(index|uploads)(\.m?js)?)?$`.test(importSource) &&
            prop.key.name === "fileFromPath"
          ) {
            removeNode({
              node: prop,
              getNextSibling: () => ({ node: pattern.properties[i + 1] }),
              getPrevSibling: () => ({ node: pattern.properties[i - 1] }),
              parent: pattern,
            });
          }
        });
      } else {
        return;
      }
    },
    ReferencedIdentifier(path) {
      ids.add(path.node.name);
    },
  });
  traverse.default(parsed, {
    enter(path) {
      if (path.type !== "Program") path.skip();
      if (
        !(
          path.node.type === "ImportDeclaration" &&
          (hasImport = true) &&
          regexp`^(${pkg}|fs|node:fs|node-fetch)($|\/)`.test(
            path.node.source.value
          )
        )
      )
        return;
      let importSource = path.node.source.value;
      if (regexp`^${pkg}\/src($|\/)`.test(importSource)) {
        importSource = importSource
          .replace(/\.ts$/, "")
          .replace(regexp`^(${pkg})\/src($|\/)`, "$1$2");
        magicString.overwrite(
          path.node.source.start!,
          path.node.source.end!,
          JSON.stringify(importSource)
        );
      }
      const { specifiers } = path.node;
      const ogSpecifiersLength = specifiers!.length;
      const isIndex = regexp`^${pkg}(\/index(\.m?js)?)?$`.test(importSource);
      const isUploads = regexp`^${pkg}(\/uploads(\.m?js)?)?$`.test(
        importSource
      );
      const removedNames: string[] = [];
      for (let i = 0; i < specifiers.length; i++) {
        const e = specifiers[i]!;
        importBindings.set(lookupBinding(path.scope, e.local!.name), [
          e,
          importSource,
        ]);
        if ("imported" in e) {
          if (
            (isIndex || isUploads) &&
            (e.imported.type === "Identifier"
              ? e.imported.name
              : e.imported.value) === "fileFromPath"
          ) {
            removeNode({
              node: e,
              getNextSibling: () => ({ node: specifiers[i + 1] }),
              getPrevSibling: () => ({ node: specifiers[i - 1] }),
              parent: path.node,
            });
            specifiers.splice(i, 1);
            i--;
          } else if (
            isUploads &&
            [
              "BlobPart",
              "BlobLike",
              "FileLike",
              "ResponseLike",
              "isResponseLike",
              "isBlobLike",
              "isFileLike",
              "isUploadable",
              "isMultipartBody",
              "maybeMultipartFormRequestOptions",
              "multipartFormRequestOptions",
              "createForm",
            ].includes(
              e.imported.type === "Identifier"
                ? e.imported.name
                : e.imported.value
            )
          ) {
            removedNames.push(
              e.imported.type === "Identifier"
                ? e.imported.name
                : e.imported.value
            );
            removeNode({
              node: e,
              getNextSibling: () => ({ node: specifiers[i + 1] }),
              getPrevSibling: () => ({ node: specifiers[i - 1] }),
              parent: path.node,
            });
            specifiers.splice(i, 1);
            i--;
          }
        }
      }
      if (removedNames?.length) {
        const indent =
          file.source.slice(0, path.node.start!).match(/[ \t]+$/) ?? "";
        magicString.appendLeft(
          path.node.start!,
          "/*\n" +
            (
              "The following exports have been removed as they were not intended to be a part of the public API:\n\n" +
              `import { ${removedNames.join(", ")} } from ${JSON.stringify(
                importSource
              )}` +
              "\n\nIf you were relying on these, you should switch to the built-in global versions of the types, and write\n" +
              "your own type assertion functions if necessary."
            )
              .replace(/^/gm, indent + " * ")
              .trimEnd() +
            "\n" +
            indent +
            " */\n" +
            indent
        );
      }
      if (
        regexp`^(${pkg})($|\/)`.test(path.node.source.value) &&
        !path.node.specifiers!.length &&
        ogSpecifiersLength
      ) {
        removeNode(path);
      } else if (
        regexp`^${pkg}\/(_?shims($|\/)|core(\.m?js)?$)`.test(
          path.node.source.value + ""
        )
      ) {
        removeNode(path);
      }
    },
  });
  const clientBindings = new Set();
  traverse.default(parsed, {
    ReferencedIdentifier(path) {
      let import_ = importBindings.get(
        lookupBinding(path.scope, path.node.name)
      );
      if (!import_) return;
      const [importSpecifier, file] = import_;
      const isIndex = regexp`^${pkg}(\/index(\.m?js)?)?$`.test(file);
      let ref: NodePath, name;
      if (importSpecifier.type === "ImportNamespaceSpecifier") {
        if (
          path.parent.type === "MemberExpression" &&
          (path.parent.property.type === "Identifier" ||
            path.parent.property.type === "StringLiteral")
        ) {
          ref = path.parentPath;
          name =
            path.parent.property.type === "Identifier"
              ? path.parent.property.name
              : path.parent.property.value;
        } else if (path.parent.type === "NewExpression" && isIndex) {
          name = clientClass;
          magicString.appendRight(path.node.end!, "." + name);
          ref = path;
        } else {
          return;
        }
      } else if (importSpecifier.type === "ImportDefaultSpecifier") {
        ref = path;
        name = "default";
      } else if (importSpecifier.type === "ImportSpecifier") {
        ref = path;
        name =
          importSpecifier.imported.type === "Identifier"
            ? importSpecifier.imported.name
            : importSpecifier.imported.value;
      } else {
        return;
      }
      let isClientClass =
        isIndex && (name === clientClass || name === "default");
      const isApiClient =
        regexp`^${pkg}\/core(\.m?js)?$`.test(file) && name === "APIClient";
      const isFileFromPath =
        regexp`^${pkg}(\/(uploads|index)(\.m?js)?)?$`.test(file) &&
        name === "fileFromPath";
      if (isApiClient) {
        magicString.overwrite(
          ref.node.start!,
          ref.node.end!,
          importName(baseClientClass ?? clientClass, pkg)
        );
        isClientClass = true;
      }
      if (
        isFileFromPath ||
        (isClientClass &&
          ref.parent.type === "MemberExpression" &&
          (ref.parent.property.type === "Identifier"
            ? ref.parent.property.name
            : ref.parent.property.type === "StringLiteral" &&
              ref.parent.property.value) === "fileFromPath")
      ) {
        const toReplace = isFileFromPath ? ref.node : ref.parent;
        magicString.overwrite(
          toReplace.start!,
          toReplace.end!,
          importName("createReadStream", "node:fs")
        );
      }
      if (isClientClass && ref.parent.type === "NewExpression") {
        if (
          ref.parent.arguments[0] &&
          ref.parent.arguments[0].type === "ObjectExpression"
        ) {
          let fetchProp: t.ObjectProperty | undefined;
          let fixedAgent = false;
          (
            ref.parent as t.NewExpression & {
              arguments: [t.ObjectExpression];
            }
          ).arguments[0].properties.forEach((e) => {
            if (!("key" in e && "value" in e)) return;
            const name =
              "name" in e.key ? e.key.name : "value" in e.key && e.key.value;
            if (name === "httpAgent") {
              fixedAgent = true;
              const agent = e.value;
              e.key = t.identifier("fetchOptions");
              e.value = t.objectExpression([
                t.addComment(
                  t.addComment(
                    t.objectProperty(t.identifier("agent"), agent),
                    "leading",
                    ` If you were only using httpAgent to configure proxies, check [our docs](${githubRepo}#configuring-proxies) for up-to-date instructions.`,
                    true
                  ),
                  "leading",
                  " Using node-fetch is not recommended, but it is required to use legacy node:http Agents.",
                  true
                ),
              ]);
            } else if (name === "fetch") {
              fetchProp = e;
            }
          });
          if (fixedAgent) {
            if (fetchProp) {
              t.addComment(
                fetchProp,
                "leading",
                " If the custom fetch function you are using isn't derived from node-fetch, your agent option was being ignored, and fetchOptions can safely be removed.",
                true
              );
            } else {
              ref.parent.arguments[0].properties.push(
                t.objectProperty(
                  t.identifier("fetch"),
                  t.identifier(importName("default", "node-fetch", "nodeFetch"))
                )
              );
            }
            magicString.overwrite(
              ref.parent.arguments[0].start!,
              ref.parent.arguments[0].end!,
              generate.default(ref.parent.arguments[0], {}).code
            );
          }
        }
        const clientVariable =
          ref.parentPath?.parent.type === "AssignmentExpression" &&
          ref.parentPath?.parent.left.type === "Identifier"
            ? ref.parentPath?.parent.left.name
            : ref.parentPath?.parent.type === "VariableDeclarator" &&
              ref.parentPath?.parent.id.type === "Identifier"
            ? ref.parentPath?.parent.id.name
            : undefined;
        if (clientVariable) {
          clientBindings.add(
            lookupBinding(ref.parentPath!.parentPath!.scope!, clientVariable)
          );
        }
      }
    },
  });
  function fixCalls(
    path: NodePath<t.Identifier | t.JSXIdentifier | t.ThisExpression>
  ) {
    let keys: string[] = [
      path.node.type === "ThisExpression" ? "this" : path.node.name,
    ];
    let n: NodePath<t.MemberExpression>;
    let p: NodePath | null = path;
    while (
      p &&
      p.parent.type === "MemberExpression" &&
      p.parent.object === p.node
    ) {
      if (p.parent.property.type === "Identifier") {
        keys.push(p.parent.property.name);
      } else if (p.parent.property.type === "StringLiteral") {
        keys.push(p.parent.property.value);
      } else {
        break;
      }
      p = p.parentPath;
    }
    if (p?.type !== "MemberExpression") return;
    n = p as NodePath<t.MemberExpression>;
    let classKeyIndex: number | undefined;
    if (keys.length) {
      let joinedKeys;
      if (
        path.node.type === "Identifier" &&
        clientBindings.has(lookupBinding(path.scope, path.node.name))
      ) {
        joinedKeys = keys.slice(1, -1).join(".");
        classKeyIndex = 0
      } else {
        classKeyIndex = keys.findIndex(
          (e) =>
            e === "client" ||
            e.toLowerCase().includes(clientClass.toLowerCase())
        );
        if (classKeyIndex === -1) return;
        joinedKeys = keys.slice(classKeyIndex + 1, -1).join(".");
      }
      const method = methods.find(
        (e) =>
          (e.base === joinedKeys || e.oldBase === joinedKeys) &&
          (e.name === keys.at(-1) || e.oldName === keys.at(-1))
      );
      if (method) {
        if (method.oldName && keys.at(-1) === method.oldName) {
          magicString.overwrite(
            n.node.property.start!,
            n.node.property.end!,
            n.node.property.type === "Identifier"
              ? method.name
              : JSON.stringify(method.name)
          );
        }

        if (method.oldBase && joinedKeys === method.oldBase) {
          magicString.overwrite(
            n.node.start!,
            n.node.end!,
            (classKeyIndex !== undefined ? keys[classKeyIndex]! + '.' : '') + method.base + '.' + method.name,
          );
        }

        const { oldParams } = method;
        const parentNode = n.parent;
        if (oldParams && parentNode.type === "CallExpression") {
          let args = parentNode.arguments.filter((e): e is t.Expression => {
            if (
              e.type !== "SpreadElement" &&
              e.type !== "ArgumentPlaceholder"
            ) {
              // make sure the type is Expression
              void (e satisfies t.Expression);
              return true;
            } else {
              return false;
            }
          });
          if (args.length !== parentNode.arguments.length) return;
          args = args.map((e, i) => {
            const old = oldParams[i];
            return old &&
              old.type === "param" &&
              old.location === "path" &&
              e.type === "CallExpression" &&
              e.callee.type === "Identifier" &&
              e.callee.name === "encodeURIComponent" &&
              e.arguments[0] &&
              e.arguments[0].type !== "SpreadElement" &&
              e.arguments[0].type !== "ArgumentPlaceholder"
              ? e.arguments[0]
              : e;
          });
          let options = args[oldParams.length - 1];
          const paramIndex =
            oldParams.at(-2)?.type === "params" ? oldParams.length - 2 : -1;
          const p = oldParams[paramIndex];
          const paramsInfo = p?.type === "params" && p;
          let params = args[paramIndex];
          let positionals = Object.fromEntries(
            oldParams.flatMap((e, i) =>
              e.type !== "param"
                ? []
                : [[e.key, args[i] || t.identifier("undefined")]]
            )
          );
          if (
            params &&
            !options &&
            paramsInfo &&
            paramsInfo.maybeOverload &&
            params.type === "ObjectExpression" &&
            params.properties.length &&
            params.properties.every((e) =>
              [
                "method",
                "path",
                "query",
                "body",
                "headers",
                "maxRetries",
                "stream",
                "timeout",
                "httpAgent",
                "signal",
                "idempotencyKey",
                "__binaryRequest",
                "__binaryResponse",
              ].includes(
                "key" in e
                  ? ("name" in e.key
                      ? e.key.name
                      : "value" in e.key && e.key.value) + ""
                  : ""
              )
            )
          ) {
            options = params;
            params = t.identifier("undefined");
          }
          args = method.params!.map((e) => {
            if (e.type === "param") {
              const value = positionals[e.key!];
              delete positionals[e.key!];
              return value || t.identifier("undefined");
            } else if (e.type === "params") {
              if (!Object.keys(positionals).length) {
                return params || t.identifier("undefined");
              }
              return t.objectExpression([
                ...(params &&
                params.type !== "NullLiteral" &&
                !(params.type === "Identifier" && params.name === "undefined")
                  ? params.type === "ObjectExpression"
                    ? params.properties
                    : [t.spreadElement(params)]
                  : []),
                ...Object.entries(positionals).map(([key, val]) =>
                  t.objectProperty(t.identifier(key), val)
                ),
              ]);
            } else {
              return options || t.identifier("undefined");
            }
          });
          const lastDefined = findLastIndex(
            args,
            (e) => e && !(e.type === "Identifier" && e.name === "undefined")
          );
          if (lastDefined != -1) args = args.slice(0, lastDefined + 1);
          magicString.overwrite(
            parentNode.arguments[0]!.start!,
            parentNode.arguments.at(-1)!.end!,
            args.map((arg) => generate.default(arg).code).join(", ")
          );
        }
      }
    }
  }
  traverse.default(parsed, {
    ReferencedIdentifier: fixCalls,
    ThisExpression: fixCalls,
  });
  return magicString.toString();
}

if (typeof require !== "undefined" && require.main === module) {
  /**
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   */

  const Runner = require("./jscodeshift/src/Runner.js");

  const pkg = require("../package.json");

  const defaultExtensions = [
    "js",
    "jsx",
    "es6",
    "es",
    "mjs",
    "cjs",
    "ts",
    "tsx",
  ]
    .sort()
    .join(",");

  const parser = require("./argsParser.cjs").options({
    cpus: {
      display_index: 1,
      abbr: "c",
      aliases: ["-j"],
      help: "start at most N child processes to process source files",
      defaultHelp: "max(all - 1, 1)",
      metavar: "N",
      process: Number,
    },
    verbose: {
      display_index: 16,
      abbr: "v",
      choices: [0, 1, 2],
      default: 0,
      help: "show more information about the transform process",
      metavar: "N",
      process: Number,
    },
    dry: {
      display_index: 2,
      abbr: "d",
      aliases: ["--dry-run", "--dryRun", "--dryrun"],
      flag: true,
      default: false,
      help: "dry run (no changes are made to files)",
    },
    print: {
      display_index: 11,
      abbr: "p",
      flag: true,
      help: "print transformed files to stdout, useful for development",
      defaultHelp: "true if dry run",
    },
    extensions: {
      display_index: 3,
      default: defaultExtensions,
      help: "transform files with these file extensions (comma separated list)",
      metavar: "EXT",
    },
    ignorePattern: {
      display_index: 7,
      full: "ignore-pattern",
      aliases: ["ignore"],
      list: true,
      help: "ignore files that match a provided glob expression",
      metavar: "GLOB",
    },
    ignoreConfig: {
      display_index: 6,
      full: "ignore-config",
      list: true,
      help: "ignore files if they match patterns sourced from a configuration file (e.g. a .gitignore)",
      metavar: "FILE",
    },
    gitignore: {
      display_index: 8,
      flag: true,
      default: true,
      help: "ignore files using the current directory's .gitignore file",
    },
    runInBand: {
      display_index: 12,
      flag: true,
      default: false,
      full: "run-in-band",
      help: "run serially in the current process",
    },
    silent: {
      display_index: 13,
      abbr: "s",
      flag: true,
      default: false,
      help: "do not write to stdout or stderr",
    },
    failOnError: {
      display_index: 4,
      flag: true,
      help: "Return a non-zero code when there are errors",
      full: "fail-on-error",
      default: false,
    },
    version: {
      display_index: 17,
      help: "print version and exit",
      callback: function () {
        return `${pkg.name}: ${pkg.version}`;
      },
    },
    stdin: {
      display_index: 14,
      help: "read file/directory list from stdin",
      flag: true,
      default: false,
    },
    migrationConfig: {
      hidden: true,
    },
  });

  let options, positionalArguments;
  try {
    ({ options, positionalArguments } = parser.parse());
    if (!options.migrationConfig) {
      process.stderr.write("Error: A migration config must be provided.\n");
      process.exit(1);
    }
    options.migrationConfig = JSON.parse(
      readFileSync(options.migrationConfig, "utf-8")
    );
    options.print ??= options.dry;
    if (positionalArguments.length === 0 && !options.stdin) {
      process.stderr.write(
        "Error: You have to provide at least one file/directory to transform." +
          "\n\n---\n\n" +
          parser.getHelpText()
      );
      process.exit(1);
    }
  } catch (e: any) {
    const exitCode = e.exitCode === undefined ? 1 : e.exitCode;
    (exitCode ? process.stderr : process.stdout).write(e.message + "\n");
    process.exit(exitCode);
  }
  function run(paths: string[], options: any) {
    delete options.babel;
    delete options.transform;
    delete options.parser;
    delete options.parserConfig;
    Runner.run(__filename, paths, options);
  }

  if (options.stdin) {
    let buffer = "";
    process.stdin.on("data", (data) => (buffer += data));
    process.stdin.on("end", () => run(buffer.split("\n"), options));
  } else {
    run(positionalArguments, options);
  }
}
