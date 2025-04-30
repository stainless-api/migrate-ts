// @ts-check
"use strict";

const fs = require("fs");
const mm = require("micromatch");
const { findUpSync } = require("../../migrate.cjs");
const { dirname, relative, resolve } = require("path");

const matchers = [];

addIgnorePattern(".git", matchers);
addIgnorePattern("node_modules", matchers);

/**
 * Add glob patterns to ignore matched files and folders.
 * Creates glob patterns to approximate gitignore patterns.
 * @param {String} val - the glob or gitignore-style pattern to ignore
 * @see {@linkplain https://git-scm.com/docs/gitignore#_pattern_format}
 */
function addIgnorePattern(val, matchers) {
  if (val && typeof val === "string" && val[0] !== "#") {
    let pattern = val;
    if (pattern.indexOf("/") === -1) {
      matchers.push("**/" + pattern);
      matchers.push("**/" + pattern + "/**");
      matchers.push(pattern + "/**");
    } else if (pattern[pattern.length - 1] === "/") {
      matchers.push("**/" + pattern + "**");
      matchers.push(pattern + "**");
    }
    matchers.push(pattern);
  }
}

/**
 * Adds ignore patterns directly from function input
 * @param {String|Array<String>} input - the ignore patterns
 */
function addIgnoreFromInput(input) {
  let patterns = [];
  if (input) {
    patterns = patterns.concat(input);
  }
  patterns.forEach((p) => addIgnorePattern(p, matchers));
}

/**
 * Adds ignore patterns by reading files
 * @param {String|Array<String>} input - the paths to the ignore config files
 */
function addIgnoreFromFile(input) {
  let lines = [];
  let files = [];
  if (input) {
    files = files.concat(input);
  }

  files.forEach(function (config) {
    const stats = fs.statSync(config);
    if (stats.isFile()) {
      const content = fs.readFileSync(config, "utf8");
      lines = lines.concat(content.split(/\r?\n/));
    }
  });

  lines.forEach((l) => addIgnorePattern(l, matchers));
}

const gitMatcherCache = new Map();

function shouldIgnore(path) {
  let newMatchers = matchers;
  if (gitignore) {
    const gitignorePath = findUpSync(".gitignore", { cwd: path });
    if (gitignorePath) {
      let gitMatchers = gitMatcherCache.get(gitignorePath);
      if (!gitMatchers) {
        gitMatchers = [];
        gitMatcherCache.set(gitignorePath, gitMatchers);
        addIgnorePattern(".git", gitMatchers);
        fs.readFileSync(gitignorePath, "utf-8")
          .trim()
          .split(/\r?\n/g)
          .map((e) =>
            addIgnorePattern(
              e[0] === "/"
                ? relative(
                    dirname(process.cwd()),
                    dirname(gitignorePath)
                  ).replace(/.$/, "$&/") + e.slice(1)
                : e,
              gitMatchers
            )
          );
      }
      newMatchers = newMatchers.concat(gitMatchers);
    }
  }
  const matched = newMatchers.length
    ? mm.isMatch(path, newMatchers, { dot: true }) ||
      mm.isMatch(resolve(path), newMatchers, { dot: true })
    : false;
  return matched;
}

let gitignore;
exports.add = addIgnoreFromInput;
exports.addFromFile = addIgnoreFromFile;
exports.shouldIgnore = shouldIgnore;
exports.useGitIgnore = () => {
  gitignore = true;
};
