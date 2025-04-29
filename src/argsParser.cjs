/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

function throwError(exitCode, message, helpText) {
  const error = new Error(
    helpText ? `${message}\n\n---\n\n${helpText}` : message
  );
  error.exitCode = exitCode;
  throw error;
}

function formatOption(option) {
  let text = "  ";
  text += option.abbr ? `-${option.abbr}, ` : "    ";
  text += `--${option.flag ? "(no-)" : ""}${option.full}`;
  if (option.choices) {
    text += `=${option.choices.join("|")}`;
  } else if (option.metavar) {
    text += `=${option.metavar}`;
  }
  if (option.list) {
    text += " ...";
  }
  if (option.defaultHelp || option.default !== undefined || option.help) {
    text += "  ";
    if (text.length < 34) {
      text += " ".repeat(34 - text.length);
    }
    const textLength = text.length;
    if (option.help) {
      text += option.help;
    }
    if (option.defaultHelp || option.default !== undefined) {
      if (option.help) {
        text += "\n";
      }
      text += `${" ".repeat(textLength)}(default: ${
        option.defaultHelp || option.default
      })`;
    }
  }

  return text;
}

function getHelpText(options) {
  const opts = Object.keys(options)
    .filter((k) => !options[k].hidden)
    .map((k) => options[k])
    .sort((a, b) => a.display_index - b.display_index);

  const text = `
Usage: migrate [OPTION]... PATH...
   or: migrate [OPTION]... --stdin < file_list.txt

Apply migration logic to everything in PATH.
If --stdin is set, each line of the standard input is used as a path.

Options:
"..." behind an option means that it can be supplied multiple times.
All options are also passed to the transformer, which means you can supply custom options that are not listed here.

${opts.map(formatOption).join("\n")}
`;
  return text.trimStart();
}

function validateOptions(parsedOptions, options) {
  const errors = [];
  for (const optionName in options) {
    const option = options[optionName];
    if (option.choices && !option.choices.includes(parsedOptions[optionName])) {
      errors.push(
        `Error: --${
          option.full
        } must be one of the values ${option.choices.join(",")}`
      );
    }
  }
  if (errors.length > 0) {
    throwError(1, errors.join("\n"), getHelpText(options));
  }
}

function prepareOptions(options) {
  options.help = {
    display_index: 5,
    abbr: "h",
    help: "print this help and exit",
    callback() {
      return getHelpText(options);
    },
  };

  const preparedOptions = {};

  for (const optionName of Object.keys(options)) {
    const option = options[optionName];
    if (!option.full) {
      option.full = optionName;
    }
    option.key = optionName;

    preparedOptions["--" + option.full] = option;
    if (option.abbr) {
      preparedOptions["-" + option.abbr] = option;
    }
    if (option.aliases) {
      for (const alias of option.aliases) preparedOptions[alias] = option;
    }
    if (option.flag) {
      preparedOptions["--no-" + option.full] = option;
    }
  }

  return preparedOptions;
}

function isOption(value) {
  return /^--?/.test(value);
}

function parse(options, args = process.argv.slice(2)) {
  const missingValue = Symbol();
  const preparedOptions = prepareOptions(options);

  const parsedOptions = {};
  const positionalArguments = [];

  for (const optionName in options) {
    const option = options[optionName];
    if (option.default !== undefined) {
      parsedOptions[optionName] = option.default;
    } else if (option.list) {
      parsedOptions[optionName] = [];
    }
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (isOption(arg)) {
      let optionName = arg;
      let value = null;
      let option = null;
      if (optionName.includes("=")) {
        const index = arg.indexOf("=");
        optionName = arg.slice(0, index);
        value = arg.slice(index + 1);
      }
      if (preparedOptions.hasOwnProperty(optionName)) {
        option = preparedOptions[optionName];
      } else {
        throwError(1, `Unknown flag: ${optionName}`, getHelpText(options));
      }

      if (option.callback) {
        throwError(0, option.callback());
      } else if (option.flag) {
        if (optionName.startsWith("--no-")) {
          value = false;
        } else if (value !== null) {
          value = value === "1";
        } else {
          value = true;
        }
        parsedOptions[option.key] = value;
      } else {
        if (value === null && i < args.length - 1 && !isOption(args[i + 1])) {
          // consume next value
          value = args[i + 1];
          i += 1;
        }
        if (value !== null) {
          if (option.process) {
            value = option.process(value);
          }
          if (option.list) {
            parsedOptions[option.key].push(value);
          } else {
            parsedOptions[option.key] = value;
          }
        } else {
          parsedOptions[option.key] = missingValue;
        }
      }
    } else {
      positionalArguments.push(/^\d+$/.test(arg) ? Number(arg) : arg);
    }
  }

  for (const optionName in parsedOptions) {
    if (parsedOptions[optionName] === missingValue) {
      throwError(
        1,
        `Missing value: --${
          preparedOptions[optionName]?.full ?? optionName
        } requires a value`,
        getHelpText(options)
      );
    }
  }

  const result = {
    positionalArguments,
    options: parsedOptions,
  };

  validateOptions(parsedOptions, options);

  return result;
}

module.exports = {
  /**
   * `options` is an object of objects. Each option can have the following
   * properties:
   *
   *   - full: The name of the option to be used in the command line (if
   *           different than the property name.
   *   - abbr: The short version of the option, a single character
   *   - flag: Whether the option takes an argument or not.
   *   - default: The default value to use if option is not supplied
   *   - choices: Restrict possible values to these values
   *   - help: The help text to print
   *   - metavar: Value placeholder to use in the help
   *   - callback: If option is supplied, call this function and exit
   *   - process: Pre-process value before returning it
   */
  options(options) {
    return {
      parse(args) {
        return parse(options, args);
      },
      getHelpText() {
        return getHelpText(options);
      },
    };
  },
};
