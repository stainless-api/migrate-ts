import { describe, test } from "node:test";
import transform from "../src/migrate.ts";
import { equal } from "node:assert/strict";
import { dedent } from "ts-dedent";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const migrationConfig = JSON.parse(
  readFileSync(
    fileURLToPath(import.meta.resolve("./migrationConfig.json")),
    "utf-8"
  )
);

describe("it rewrites imports from src", () => {
  test("esm import", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: 'import { OpenAI } from "openai/src";',
        },
        undefined,
        { migrationConfig }
      ),
      'import { OpenAI } from "openai";'
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: 'import { OpenAI } from "openai/src/index";',
        },
        undefined,
        { migrationConfig }
      ),
      'import { OpenAI } from "openai/index";'
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: 'import { OpenAI } from "openai/src/index.js";',
        },
        undefined,
        { migrationConfig }
      ),
      'import { OpenAI } from "openai/index.js";'
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: 'import { OpenAI } from "openai/src/index.mjs";',
        },
        undefined,
        { migrationConfig }
      ),
      'import { OpenAI } from "openai/index.mjs";'
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: 'import { OpenAI } from "openai/src/index.ts";',
        },
        undefined,
        { migrationConfig }
      ),
      'import { OpenAI } from "openai/index";'
    );
  });
  test("cjs require", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: 'const { OpenAI } = require("openai/src");',
        },
        undefined,
        { migrationConfig }
      ),
      'const { OpenAI } = require("openai");'
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: 'const { OpenAI } = require("openai/src/index");',
        },
        undefined,
        { migrationConfig }
      ),
      'const { OpenAI } = require("openai/index");'
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: 'const { OpenAI } = require("openai/src/index.js");',
        },
        undefined,
        { migrationConfig }
      ),
      'const { OpenAI } = require("openai/index.js");'
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: 'const { OpenAI } = require("openai/src/index.mjs");',
        },
        undefined,
        { migrationConfig }
      ),
      'const { OpenAI } = require("openai/index.mjs");'
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: 'const { OpenAI } = require("openai/src/index.ts");',
        },
        undefined,
        { migrationConfig }
      ),
      'const { OpenAI } = require("openai/index");'
    );
  });
});

describe("it rewrites fileFromPath to createReadStream", () => {
  test("esm import, class prop", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { createReadStream } from "node:fs";
        import { OpenAI } from "openai";
        const f = createReadStream("file")
      `
    );
  });
  test("cjs require, class prop", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        const { createReadStream } = require("node:fs");
        const { OpenAI } = require("openai");
        const f = createReadStream("file")
      `
    );
  });
  test("esm with #!", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          #!/usr/bin/env node
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
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
      transform(
        {
          path: "index.ts",
          source: dedent`
          #!/usr/bin/env node
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
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
      transform(
        {
          path: "index.ts",
          source: dedent`
          import * as OpenAI from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { createReadStream } from "node:fs";
        import * as OpenAI from "openai";
        const f = createReadStream("file")
      `
    );
  });
  test("cjs ns require", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const OpenAI = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        const { createReadStream } = require("node:fs");
        const OpenAI = require("openai");
        const f = createReadStream("file")
      `
    );
  });
  test("esm import generates import", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { fileFromPath } from "openai";
          const f = fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { createReadStream } from "node:fs";

        const f = createReadStream("file")
      `
    );
  });
  test("cjs require generate require", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const { fileFromPath } = require("openai");
          const f = fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        const { createReadStream } = require("node:fs");
        const {  } = require("openai");
        const f = createReadStream("file")
      `
    );
  });
  test("mixed import/require generates imports", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const OpenAI = require("openai")
          import { fileFromPath } from "openai/uploads";
          const f = fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { createReadStream } from "node:fs";
        const OpenAI = require("openai")
        
        const f = createReadStream("file")
      `
    );
  });
  test("esm reuses fs import", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { createReadStream } from "node:fs";
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { createReadStream } from "node:fs";
        import { OpenAI } from "openai";
        const f = createReadStream("file")
      `
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { createReadStream as x } from "node:fs";
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { createReadStream as x } from "node:fs";
        import { OpenAI } from "openai";
        const f = x("file")
      `
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import * as fs from "node:fs";
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import * as fs from "node:fs";
        import { OpenAI } from "openai";
        const f = fs.createReadStream("file")
      `
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import fs from "node:fs";
          import { OpenAI } from "openai";
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import fs from "node:fs";
        import { OpenAI } from "openai";
        const f = fs.createReadStream("file")
      `
    );
  });
  test("cjs reuses fs require", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const { createReadStream } = require("node:fs");
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        const { createReadStream } = require("node:fs");
        const { OpenAI } = require("openai");
        const f = createReadStream("file")
      `
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const crs = require("node:fs").createReadStream;
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        const crs = require("node:fs").createReadStream;
        const { OpenAI } = require("openai");
        const f = crs("file")
      `
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const { createReadStream: x } = require("node:fs");
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        const { createReadStream: x } = require("node:fs");
        const { OpenAI } = require("openai");
        const f = x("file")
      `
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const fs = require("node:fs");
          const { OpenAI } = require("openai");
          const f = OpenAI.fileFromPath("file")
        `,
        },
        undefined,
        { migrationConfig }
      ),
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
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { toFile, isUploadable, BlobLike, type BlobPart, } from "openai/uploads";
        `,
        },
        undefined,
        { migrationConfig }
      ),
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
      transform(
        {
          path: "index.ts",
          source: dedent`
          import "openai/shims/web";
          import OpenAI from "openai";
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        
        import OpenAI from "openai";
      `
    );
  });
  test("cjs require", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          require("openai/shims/web");
          const { OpenAI } = require("openai");
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        
        const { OpenAI } = require("openai");
      `
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const _ = require("openai/shims/web"), { OpenAI } = require("openai");
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        const { OpenAI } = require("openai");
      `
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const { OpenAI } = require("openai"), {} = require("openai/shims/web");
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        const { OpenAI } = require("openai");
      `
    );
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const _ = require("openai/shims/web");
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        
      `
    );
  });
});

describe("it turns new ModuleNamespace() into new ModuleNamespace.OpenAI()", () => {
  test("esm import", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import * as OpenAI from "openai";
          new OpenAI();
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import * as OpenAI from "openai";
        new OpenAI.OpenAI();
      `
    );
  });
  test("cjs require", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const OpenAI = require("openai");
          new OpenAI();
        `,
        },
        undefined,
        { migrationConfig }
      ),
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
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { APIClient } from "openai/core";
          new APIClient();
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { OpenAI } from "openai";

        new OpenAI();
      `
    );
  });
  test("cjs require", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          const Core = require("openai/core");
          new Core.APIClient();
        `,
        },
        undefined,
        { migrationConfig }
      ),
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
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { OpenAI } from "openai";
          new OpenAI({ httpAgent: new SomeAgent() });
        `,
        },
        undefined,
        { migrationConfig }
      ),
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
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { OpenAI } from "openai";
          new OpenAI({ httpAgent: new SomeAgent(), fetch: customFetch });
        `,
        },
        undefined,
        { migrationConfig }
      ),
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
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { OpenAI } from "openai";
          new OpenAI({ no: {formatting : [changes,here,]} });
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { OpenAI } from "openai";
        new OpenAI({ no: {formatting : [changes,here,]} });
      `
    );
  });
});

describe("it renames del -> delete", () => {
  test("basic", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { OpenAI } from "openai";
          const x = new OpenAI();
          x.files.del();
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { OpenAI } from "openai";
        const x = new OpenAI();
        x.files.delete();
      `
    );
  });
  test("unrelated files.del() call", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          DriveService.files.del();
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        DriveService.files.del();
      `
    );
  });
  test("name heuristic", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          openai.files.del();
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        openai.files.delete();
      `
    );
  });
  test("name heuristic (class)", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          this.openai.files.del();
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        this.openai.files.delete();
      `
    );
  });
  test("name heuristic (class, private)", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
            class X {
              #openai
              constructor() {
                this.#openai.files.delete();
              }
            }
          `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        class X {
          #openai
          constructor() {
            this.#openai.files.delete();
          }
        }
      `
    );
  });
  test("name heuristic (client)", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          client.files.del();
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        client.files.delete();
      `
    );
  });
  test("name heuristic (client, class)", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          this.client.files.del();
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        this.client.files.delete();
      `
    );
  });
  test("name heuristic (client, class, private)", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
            class X {
              #client
              constructor() {
                this.#client.files.delete();
              }
            }
          `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        class X {
          #client
          constructor() {
            this.#client.files.delete();
          }
        }
      `
    );
  });
});

describe("it fixes path params", () => {
  test("basic", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { OpenAI } from "openai";
          const x = new OpenAI();
          x.vectorStores.files.del('a', 'b');
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { OpenAI } from "openai";
        const x = new OpenAI();
        x.vectorStores.files.delete('b', {
          vector_store_id: 'a'
        });
      `
    );
  });
  test("with encodeURIComponent", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { OpenAI } from "openai";
          const x = new OpenAI();
          x.vectorStores.files.del(encodeURIComponent('a'), encodeURIComponent('b'));
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { OpenAI } from "openai";
        const x = new OpenAI();
        x.vectorStores.files.delete('b', {
          vector_store_id: 'a'
        });
      `
    );
  });
});

describe("it stops using overloads", () => {
  test("basic", () => {
    equal(
      transform(
        {
          path: "index.ts",
          source: dedent`
          import { OpenAI } from "openai";
          const x = new OpenAI();
          x.vectorStores.fileBatches.listFiles('a', 'b', {timeout: 1});
        `,
        },
        undefined,
        { migrationConfig }
      ),
      dedent`
        import { OpenAI } from "openai";
        const x = new OpenAI();
        x.vectorStores.fileBatches.listFiles('b', {
          vector_store_id: 'a'
        }, {
          timeout: 1
        });
      `
    );
  });
});
