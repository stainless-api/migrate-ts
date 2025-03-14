import { describe, test } from "node:test";
import createTransformer from "../src/migrate.ts";
import { equal } from "node:assert/strict";
import { dedent } from "ts-dedent";

const transformer = createTransformer({
  pkg: "openai",
  githubRepo: "https://github.com/openai/openai-node/blob/alpha",
  clientClass: "OpenAI",
  methods: [],
});

describe("it rewrites imports from src", () => {
  test("esm import", () => {
    equal(
      transformer({
        path: "index.ts",
        source: 'import { OpenAI } from "openai/src";',
      }),
      'import { OpenAI } from "openai";'
    );
    equal(
      transformer({
        path: "index.ts",
        source: 'import { OpenAI } from "openai/src/index";',
      }),
      'import { OpenAI } from "openai/index";'
    );
    equal(
      transformer({
        path: "index.ts",
        source: 'import { OpenAI } from "openai/src/index.js";',
      }),
      'import { OpenAI } from "openai/index.js";'
    );
    equal(
      transformer({
        path: "index.ts",
        source: 'import { OpenAI } from "openai/src/index.mjs";',
      }),
      'import { OpenAI } from "openai/index.mjs";'
    );
    equal(
      transformer({
        path: "index.ts",
        source: 'import { OpenAI } from "openai/src/index.ts";',
      }),
      'import { OpenAI } from "openai/index";'
    );
  });
  test("cjs require", () => {
    equal(
      transformer({
        path: "index.ts",
        source: 'const { OpenAI } = require("openai/src");',
      }),
      'const { OpenAI } = require("openai");'
    );
    equal(
      transformer({
        path: "index.ts",
        source: 'const { OpenAI } = require("openai/src/index");',
      }),
      'const { OpenAI } = require("openai/index");'
    );
    equal(
      transformer({
        path: "index.ts",
        source: 'const { OpenAI } = require("openai/src/index.js");',
      }),
      'const { OpenAI } = require("openai/index.js");'
    );
    equal(
      transformer({
        path: "index.ts",
        source: 'const { OpenAI } = require("openai/src/index.mjs");',
      }),
      'const { OpenAI } = require("openai/index.mjs");'
    );
    equal(
      transformer({
        path: "index.ts",
        source: 'const { OpenAI } = require("openai/src/index.ts");',
      }),
      'const { OpenAI } = require("openai/index");'
    );
  });
});

describe("it rewrites fileFromPath to createReadStream", () => {
  test("esm import, class prop", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        import { createReadStream } from "node:fs";
        import { OpenAI } from "openai";
        const f = createReadStream("file")
      `
    );
  });
  test("cjs require, class prop", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        const { createReadStream } = require("node:fs");
        const { OpenAI } = require("openai");
        const f = createReadStream("file")
      `
    );
  });
  test("esm with #!", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          #!/usr/bin/env node
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        #!/usr/bin/env node
        import { createReadStream } from "node:fs";
        import { OpenAI } from "openai";
        const f = createReadStream("file")
      `
    );
  });
  test("cjs with #!", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          #!/usr/bin/env node
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        #!/usr/bin/env node
        const { createReadStream } = require("node:fs");
        const { OpenAI } = require("openai");
        const f = createReadStream("file")
      `
    );
  });
  test("esm ns import", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import * as OpenAI from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        import { createReadStream } from "node:fs";
        import * as OpenAI from "openai";
        const f = createReadStream("file")
      `
    );
  });
  test("cjs ns require", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const OpenAI = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        const { createReadStream } = require("node:fs");
        const OpenAI = require("openai");
        const f = createReadStream("file")
      `
    );
  });
  test("esm import generates import", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import { fileFromPath } from "openai";
          const f = fileFromPath("file")
        `,
      }),
      dedent`
        import { createReadStream } from "node:fs";

        const f = createReadStream("file")
      `
    );
  });
  test("cjs require generate require", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const { fileFromPath } = require("openai");
          const f = fileFromPath("file")
        `,
      }),
      dedent`
        const { createReadStream } = require("node:fs");
        const {  } = require("openai");
        const f = createReadStream("file")
      `
    );
  });
  test("mixed import/require generates imports", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const OpenAI = require("openai")
          import { fileFromPath } from "openai/uploads";
          const f = fileFromPath("file")
        `,
      }),
      dedent`
        import { createReadStream } from "node:fs";
        const OpenAI = require("openai")
        
        const f = createReadStream("file")
      `
    );
  });
  test("esm reuses fs import", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import { createReadStream } from "node:fs";
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        import { createReadStream } from "node:fs";
        import { OpenAI } from "openai";
        const f = createReadStream("file")
      `
    );
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import { createReadStream as x } from "node:fs";
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        import { createReadStream as x } from "node:fs";
        import { OpenAI } from "openai";
        const f = x("file")
      `
    );
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import * as fs from "node:fs";
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        import * as fs from "node:fs";
        import { OpenAI } from "openai";
        const f = fs.createReadStream("file")
      `
    );
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import fs from "node:fs";
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        import fs from "node:fs";
        import { OpenAI } from "openai";
        const f = fs.createReadStream("file")
      `
    );
  });
  test("cjs reuses fs require", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const { createReadStream } = require("node:fs");
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        const { createReadStream } = require("node:fs");
        const { OpenAI } = require("openai");
        const f = createReadStream("file")
      `
    );
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const crs = require("node:fs").createReadStream;
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        const crs = require("node:fs").createReadStream;
        const { OpenAI } = require("openai");
        const f = crs("file")
      `
    );
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const { createReadStream: x } = require("node:fs");
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        const { createReadStream: x } = require("node:fs");
        const { OpenAI } = require("openai");
        const f = x("file")
      `
    );
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const fs = require("node:fs");
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
      }),
      dedent`
        const fs = require("node:fs");
        const { OpenAI } = require("openai");
        const f = fs.createReadStream("file")
      `
    );
  });
});

describe("it removes imports from uploads that were intended to be internal", () => {
  // not implemented for CJS, most of these were TS types and assertion functions so should be ~no require usage
  test("esm import", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import { toFile, isUploadable, BlobLike, type BlobPart, } from "openai/uploads";
        `,
      }),
      dedent`
        /*
         * The following exports have been removed as they were not intended to be a part of the public API:
         * 
         * import { isUploadable, BlobLike, BlobPart } from "openai/uploads"
         * 
         * If you were relying on these, you should switch to the built-in global versions of the types, and write
         * your own type assertion functions if necessary.
         */
        import { toFile, } from "openai/uploads";
      `
    );
  });
});

describe("it removes shim imports", () => {
  test("esm import", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import "openai/shims/web";
          import OpenAI from "openai";
        `,
      }),
      dedent`
        
        import OpenAI from "openai";
      `
    );
  });
  test("cjs require", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          require("openai/shims/web");
          const { OpenAI } = require("openai");
        `,
      }),
      dedent`
        
        const { OpenAI } = require("openai");
      `
    );
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const _ = require("openai/shims/web"), { OpenAI } = require("openai");
        `,
      }),
      dedent`
        const { OpenAI } = require("openai");
      `
    );
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const { OpenAI } = require("openai"), {} = require("openai/shims/web");
        `,
      }),
      dedent`
        const { OpenAI } = require("openai");
      `
    );
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const _ = require("openai/shims/web");
        `,
      }),
      dedent`
        
      `
    );
  });
});

describe("it turns new ModuleNamespace() into new ModuleNamespace.OpenAI()", () => {
  test("esm import", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import * as OpenAI from "openai";
          new OpenAI();
        `,
      }),
      dedent`
        import * as OpenAI from "openai";
        new OpenAI.OpenAI();
      `
    );
  });
  test("cjs require", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const OpenAI = require("openai");
          new OpenAI();
        `,
      }),
      dedent`
        const OpenAI = require("openai");
        new OpenAI.OpenAI();
      `
    );
  });
});

describe("it turns new APIClient() into new OpenAI()", () => {
  test("esm import", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import { APIClient } from "openai/core";
          new APIClient();
        `,
      }),
      dedent`
        import { OpenAI } from "openai";

        new OpenAI();
      `
    );
  });
  test("cjs require", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          const Core = require("openai/core");
          new Core.APIClient();
        `,
      }),
      dedent`
        const { OpenAI } = require("openai");

        new OpenAI();
      `
    );
  });
});

describe("it updates OpenAI class options", () => {
  test("httpAgent", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import { OpenAI } from "openai";
          new OpenAI({ httpAgent: new SomeAgent() });
        `,
      }),
      dedent`
        import nodeFetch from "node-fetch";
        import { OpenAI } from "openai";
        new OpenAI({
          fetchOptions: {
            // Using node-fetch is not recommended, but it is required to use legacy node:http Agents.
            // If you were only using httpAgent to configure proxies, check [our docs](https://github.com/openai/openai-node/blob/alpha#configuring-proxies) for up-to-date instructions.
            agent: new SomeAgent()
          },
          fetch: nodeFetch
        });
      `
    );
  });
  test("httpAgent with existing fetch", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import { OpenAI } from "openai";
          new OpenAI({ httpAgent: new SomeAgent(), fetch: customFetch });
        `,
      }),
      dedent`
        import { OpenAI } from "openai";
        new OpenAI({
          fetchOptions: {
            // Using node-fetch is not recommended, but it is required to use legacy node:http Agents.
            // If you were only using httpAgent to configure proxies, check [our docs](https://github.com/openai/openai-node/blob/alpha#configuring-proxies) for up-to-date instructions.
            agent: new SomeAgent()
          },
          // If the custom fetch function you are using isn't derived from node-fetch, your agent option was being ignored, and fetchOptions can safely be removed.
          fetch: customFetch
        });
      `
    );
  });
  test("no change", () => {
    equal(
      transformer({
        path: "index.ts",
        source: dedent`
          import { OpenAI } from "openai";
          new OpenAI({ no: {formatting : [changes,here,]} });
        `,
      }),
      dedent`
        import { OpenAI } from "openai";
        new OpenAI({ no: {formatting : [changes,here,]} });
      `
    );
  });
});
