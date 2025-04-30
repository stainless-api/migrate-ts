// @ts-check

/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const child_process = require("child_process");
const pc = require("picocolors");
const fs = require("graceful-fs");
const path = require("path");
const http = require("http");
const https = require("https");
const ignores = require("./ignoreFiles");

const tmp = require("tmp");
const { readdir, realpath } = require("fs/promises");
const { extname } = require("path");
tmp.setGracefulCleanup();

const availableCpus = Math.max(require("os").cpus().length - 1, 1);
const CHUNK_SIZE = 50;

function lineBreak(str) {
  return /\n$/.test(str) ? str : str + "\n";
}

const bufferedWrite = (function () {
  const buffer = [];
  let buffering = false;

  process.stdout.on("drain", () => {
    if (!buffering) return;
    while (buffer.length > 0 && process.stdout.write(buffer.shift()) !== false);
    if (buffer.length === 0) {
      buffering = false;
    }
  });
  return function write(msg) {
    if (buffering) {
      buffer.push(msg);
    }
    if (process.stdout.write(msg) === false) {
      buffering = true;
    }
  };
})();

const log = {
  ok(msg, verbose) {
    verbose >= 2 && bufferedWrite(pc.bgGreen(pc.white(" OKK ")) + " " + msg);
  },
  nochange(msg, verbose) {
    verbose >= 1 && bufferedWrite(pc.bgYellow(pc.white(" NOC ")) + " " + msg);
  },
  skip(msg, verbose) {
    verbose >= 1 && bufferedWrite(pc.bgYellow(pc.white(" SKIP ")) + " " + msg);
  },
  error(msg, verbose) {
    verbose >= 0 && bufferedWrite(pc.bgRed(pc.white(" ERR ")) + " " + msg);
  },
};

function report({ file, msg }) {
  bufferedWrite(lineBreak(`${pc.bgBlue(pc.white(" REP "))} ${file} ${msg}`));
}

function showFileStats(fileStats) {
  process.stdout.write(
    "Results: \n" +
      pc.red(fileStats.error + " errors\n") +
      pc.yellow(fileStats.nochange + " unmodified\n") +
      pc.yellow(fileStats.skip + " skipped\n") +
      pc.green(fileStats.ok + " ok\n")
  );
}

function showStats(stats) {
  const names = Object.keys(stats).sort();
  if (names.length) {
    process.stdout.write(pc.blue("Stats: \n"));
  }
  names.forEach((name) =>
    process.stdout.write(name + ": " + stats[name] + "\n")
  );
}
/**
 * @param {string} dir
 * @param {(arg0: string) => any} filter
 * @param {Set<string>} seen
 */
async function* dirFiles(dir, filter, seen) {
  // Create a queue for breadth-first traversal
  const queue = [dir];

  // Process directory by directory in breadth-first order
  while (queue.length > 0) {
    const currentDir = queue.shift() + "";

    try {
      const files = await readdir(currentDir);

      for (const file of files) {
        let name = path.join(currentDir, file);
        const realName = await realpath(name);

        if (seen.has(realName)) continue;
        seen.add(realName);

        const stats = await new Promise((resolve) =>
          fs.stat(name, (err, stats) => {
            if (err) {
              // probably a symlink issue
              process.stdout.write(
                'Skipping path "' + name + '" which does not exist.\n'
              );
              resolve(null);
            } else if (ignores.shouldIgnore(name)) {
              // ignore the path
              resolve(null);
            } else {
              resolve(stats);
            }
          })
        );

        if (!stats) continue;

        if (stats.isDirectory()) {
          // Add directory to queue instead of immediate recursion
          queue.push(name + "/");
        } else if (filter(name)) {
          yield name;
        }
      }
    } catch (error) {
      process.stderr.write(
        `Error reading directory ${currentDir}: ${error.message}\n`
      );
    }
  }
}

async function* getAllFiles(paths, filter) {
  const seen = new Set();
  // Create a queue for directories to process later
  const dirQueue = [];

  // First process all direct files from input paths
  for (const file of paths) {
    const stat = await new Promise((resolve) => {
      fs.lstat(file, (err, stat) => {
        if (err) {
          process.stderr.write(
            "Skipping path " + file + " which does not exist. \n"
          );
          resolve(null);
        } else {
          resolve(stat);
        }
      });
    });

    if (!stat) continue;

    if (stat.isDirectory()) {
      // Add to queue instead of immediate processing
      dirQueue.push(file);
    } else if (!filter(file) || ignores.shouldIgnore(file)) {
      // ignoring the file
    } else {
      yield file;
    }
  }

  // Then process all queued directories
  for (const dir of dirQueue) {
    yield* dirFiles(dir, filter, seen);
  }
}

function run(transformFile, paths, options) {
  const cpus = options.cpus
    ? Math.min(availableCpus, options.cpus)
    : availableCpus;
  const extensions =
    options.extensions && options.extensions.split(",").map((ext) => "." + ext);
  const fileCounters = { error: 0, ok: 0, nochange: 0, skip: 0 };
  const statsCounter = {};
  const startTime = process.hrtime();

  ignores.add(options.ignoreSet);
  ignores.add(options.ignorePattern);
  ignores.addFromFile(options.ignoreConfig);

  if (options.gitignore) {
    ignores.useGitIgnore();
  }

  if (/^http/.test(transformFile)) {
    return new Promise((resolve, reject) => {
      // call the correct `http` or `https` implementation
      (transformFile.indexOf("https") !== 0 ? http : https)
        .get(transformFile, (res) => {
          let contents = "";
          res
            .on("data", (d) => {
              contents += d.toString();
            })
            .on("end", () => {
              const ext = path.extname(transformFile);
              tmp.file(
                { prefix: "jscodeshift", postfix: ext },
                (err, path, fd) => {
                  if (err) return reject(err);
                  fs.write(fd, contents, function (err) {
                    if (err) return reject(err);
                    fs.close(fd, function (err) {
                      if (err) return reject(err);
                      transform(path).then(resolve, reject);
                    });
                  });
                }
              );
            });
        })
        .on("error", (e) => {
          reject(e);
        });
    });
  } else if (!fs.existsSync(transformFile)) {
    process.stderr.write(
      pc.bgRed(pc.white("ERROR")) +
        " Transform file " +
        transformFile +
        " does not exist \n"
    );
    return;
  } else {
    return transform(transformFile);
  }

  async function transform(transformFile) {
    const files = [];
    let lastLogged = 0;
    for await (const path of getAllFiles(
      paths,
      (name) => !extensions || extensions.indexOf(extname(name)) != -1
    )) {
      const now = performance.now();
      if (now - lastLogged > 10) {
        lastLogged = now;
        process.stderr.write(
          "\x1b[2KScanning " + path.slice(0, process.stdout.columns - 10) + "\r"
        );
      }
      files.push(path);
    }
    process.stderr.write("\x1b[2K");
    return Promise.resolve()
      .then(() => {
        const numFiles = files.length;

        if (numFiles === 0) {
          process.stdout.write("No files selected, nothing to do. \n");
          return [];
        }

        const processes = options.runInBand ? 1 : Math.min(numFiles, cpus);
        const chunkSize =
          processes > 1
            ? Math.min(Math.ceil(numFiles / processes), CHUNK_SIZE)
            : numFiles;

        let index = 0;
        // return the next chunk of work for a free worker
        function next() {
          if (!options.silent && !options.runInBand && index < numFiles) {
            /* process.stdout.write(
              "Sending " +
                Math.min(chunkSize, numFiles - index) +
                " files to free worker...\n"
            ); */
          }
          return files.slice(index, (index += chunkSize));
        }

        if (!options.silent) {
          process.stdout.write("Processing " + files.length + " files... \n");
          if (!options.runInBand) {
            process.stdout.write("Spawning " + processes + " workers...\n");
          }
          if (options.dry) {
            process.stdout.write(
              pc.green("Running in dry mode, no files will be written! \n")
            );
          }
        }

        const args = [transformFile, options.babel ? "babel" : "no-babel"];

        const workers = [];
        for (let i = 0; i < processes; i++) {
          workers.push(
            options.runInBand
              ? require("./Worker")(args)
              : child_process.fork(require.resolve("./Worker"), args)
          );
        }

        return workers.map((child) => {
          child.send({ files: next(), options });
          child.on("message", (message) => {
            switch (message.action) {
              case "status":
                fileCounters[message.status] += 1;
                log[message.status](lineBreak(message.msg), options.verbose);
                break;
              case "update":
                if (!statsCounter[message.name]) {
                  statsCounter[message.name] = 0;
                }
                statsCounter[message.name] += message.quantity;
                break;
              case "free":
                child.send({ files: next(), options });
                break;
              case "report":
                report(message);
                break;
              case "log":
                process.stdout.write(message.message);
                break;
            }
          });
          return new Promise((resolve) => child.on("disconnect", resolve));
        });
      })
      .then((pendingWorkers) =>
        Promise.all(pendingWorkers).then(() => {
          const endTime = process.hrtime(startTime);
          const timeElapsed = (endTime[0] + endTime[1] / 1e9).toFixed(3);
          if (!options.silent) {
            process.stdout.write("All done. \n");
            showFileStats(fileCounters);
            showStats(statsCounter);
            process.stdout.write(
              "Time elapsed: " + timeElapsed + " seconds \n"
            );

            if (options.failOnError && fileCounters.error > 0) {
              process.exit(1);
            }
          }
          return Object.assign(
            {
              stats: statsCounter,
              timeElapsed: timeElapsed,
            },
            fileCounters
          );
        })
      );
  }
}

exports.run = run;
