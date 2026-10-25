# Sources, dependencies, and licences

This inventory is based on the committed `package-lock.json` package metadata and the
container image declarations in `docker-compose.yml` as of 24 October 2026. It is an
engineering inventory, not legal advice; the student must recheck upstream terms before
submission or redistribution.

## Runtime and development dependencies

| Package | Licence | Use |
|---|---|---|
| `@aws-sdk/client-s3` | Apache-2.0 | S3-compatible storage client |
| `@aws-sdk/s3-request-presigner` | Apache-2.0 | Signed storage download links |
| `fastify` | MIT | HTTP server and routing |
| `js-yaml` | MIT | Connector manifest loading |
| `knex` | MIT | SQL query builder and migrations |
| `pg` | MIT | PostgreSQL driver |
| `pino` | MIT | Structured application logging |
| `@types/jest` | MIT | Jest type declarations |
| `@types/js-yaml` | MIT | YAML type declarations |
| `@types/node` | MIT | Node.js type declarations |
| `@types/pg` | MIT | PostgreSQL type declarations |
| `eslint` | MIT | Linting |
| `jest` | MIT | Test runner |
| `supertest` | MIT | HTTP integration-test utilities |
| `ts-jest` | MIT | TypeScript Jest transform |
| `typescript` | Apache-2.0 | TypeScript compiler |
| `typescript-eslint` | MIT | TypeScript ESLint integration |

## Complete locked npm dependency inventory

The following list contains every package entry in the lockfile with its declared
licence and locked version. No AGPL-licensed npm dependency was found. The `exit` package
is MIT licensed, verified from its upstream license and `npm view exit licenses`.
Transitive metadata counts: 510 package entries; MIT 398,
Apache-2.0 42, ISC 35, BSD-3-Clause 21, BSD-2-Clause 8, BlueOak-1.0.0 1,
Python-2.0 1, CC-BY-4.0 1, `(MIT OR CC0-1.0)` 2, and 0BSD 1.

| Locked package | Version | Licence |
|---|---:|---|
| `@aws-sdk/checksums` | 3.1001.5 | Apache-2.0 |
| `@aws-sdk/client-s3` | 3.1156.0 | Apache-2.0 |
| `@aws-sdk/core` | 3.978.5 | Apache-2.0 |
| `@aws-sdk/credential-provider-env` | 3.972.76 | Apache-2.0 |
| `@aws-sdk/credential-provider-http` | 3.972.78 | Apache-2.0 |
| `@aws-sdk/credential-provider-ini` | 3.973.21 | Apache-2.0 |
| `@aws-sdk/credential-provider-login` | 3.972.83 | Apache-2.0 |
| `@aws-sdk/credential-provider-node` | 3.972.88 | Apache-2.0 |
| `@aws-sdk/credential-provider-process` | 3.972.76 | Apache-2.0 |
| `@aws-sdk/credential-provider-sso` | 3.973.20 | Apache-2.0 |
| `@aws-sdk/credential-provider-web-identity` | 3.972.82 | Apache-2.0 |
| `@aws-sdk/middleware-sdk-s3` | 3.972.81 | Apache-2.0 |
| `@aws-sdk/nested-clients` | 3.997.50 | Apache-2.0 |
| `@aws-sdk/s3-request-presigner` | 3.1156.0 | Apache-2.0 |
| `@aws-sdk/signature-v4-multi-region` | 3.996.49 | Apache-2.0 |
| `@aws-sdk/token-providers` | 3.1155.0 | Apache-2.0 |
| `@aws-sdk/types` | 3.975.0 | Apache-2.0 |
| `@aws-sdk/xml-builder` | 3.972.41 | Apache-2.0 |
| `@aws/lambda-invoke-store` | 0.3.0 | Apache-2.0 |
| `@babel/code-frame` | 7.29.7 | MIT |
| `@babel/compat-data` | 7.29.7 | MIT |
| `@babel/core` | 7.29.7 | MIT |
| `@babel/core/node_modules/semver` | 6.3.1 | ISC |
| `@babel/generator` | 7.29.8 | MIT |
| `@babel/helper-compilation-targets` | 7.29.7 | MIT |
| `@babel/helper-compilation-targets/node_modules/semver` | 6.3.1 | ISC |
| `@babel/helper-globals` | 7.29.7 | MIT |
| `@babel/helper-module-imports` | 7.29.7 | MIT |
| `@babel/helper-module-transforms` | 7.29.7 | MIT |
| `@babel/helper-plugin-utils` | 7.29.7 | MIT |
| `@babel/helper-string-parser` | 7.29.7 | MIT |
| `@babel/helper-validator-identifier` | 7.29.7 | MIT |
| `@babel/helper-validator-option` | 7.29.7 | MIT |
| `@babel/helpers` | 7.29.10 | MIT |
| `@babel/parser` | 7.29.9 | MIT |
| `@babel/plugin-syntax-async-generators` | 7.8.4 | MIT |
| `@babel/plugin-syntax-bigint` | 7.8.3 | MIT |
| `@babel/plugin-syntax-class-properties` | 7.12.13 | MIT |
| `@babel/plugin-syntax-class-static-block` | 7.14.5 | MIT |
| `@babel/plugin-syntax-import-attributes` | 7.29.7 | MIT |
| `@babel/plugin-syntax-import-meta` | 7.10.4 | MIT |
| `@babel/plugin-syntax-json-strings` | 7.8.3 | MIT |
| `@babel/plugin-syntax-jsx` | 7.29.7 | MIT |
| `@babel/plugin-syntax-logical-assignment-operators` | 7.10.4 | MIT |
| `@babel/plugin-syntax-nullish-coalescing-operator` | 7.8.3 | MIT |
| `@babel/plugin-syntax-numeric-separator` | 7.10.4 | MIT |
| `@babel/plugin-syntax-object-rest-spread` | 7.8.3 | MIT |
| `@babel/plugin-syntax-optional-catch-binding` | 7.8.3 | MIT |
| `@babel/plugin-syntax-optional-chaining` | 7.8.3 | MIT |
| `@babel/plugin-syntax-private-property-in-object` | 7.14.5 | MIT |
| `@babel/plugin-syntax-top-level-await` | 7.14.5 | MIT |
| `@babel/plugin-syntax-typescript` | 7.29.7 | MIT |
| `@babel/template` | 7.29.7 | MIT |
| `@babel/traverse` | 7.29.10 | MIT |
| `@babel/types` | 7.29.8 | MIT |
| `@bcoe/v8-coverage` | 0.2.3 | MIT |
| `@eslint-community/eslint-utils` | 4.10.1 | MIT |
| `@eslint-community/eslint-utils/node_modules/eslint-visitor-keys` | 3.4.3 | Apache-2.0 |
| `@eslint-community/regexpp` | 4.12.2 | MIT |
| `@eslint/config-array` | 0.21.2 | Apache-2.0 |
| `@eslint/config-helpers` | 0.4.2 | Apache-2.0 |
| `@eslint/core` | 0.17.0 | Apache-2.0 |
| `@eslint/eslintrc` | 3.3.7 | MIT |
| `@eslint/js` | 9.39.5 | MIT |
| `@eslint/object-schema` | 2.1.7 | Apache-2.0 |
| `@eslint/plugin-kit` | 0.4.1 | Apache-2.0 |
| `@fastify/ajv-compiler` | 4.0.7 | MIT |
| `@fastify/ajv-compiler/node_modules/ajv` | 8.20.0 | MIT |
| `@fastify/ajv-compiler/node_modules/ajv/node_modules/fast-uri` | 3.1.9 | BSD-3-Clause |
| `@fastify/ajv-compiler/node_modules/json-schema-traverse` | 1.0.0 | MIT |
| `@fastify/deepmerge` | 3.2.2 | MIT |
| `@fastify/error` | 4.2.1 | MIT |
| `@fastify/fast-json-stringify-compiler` | 5.1.1 | MIT |
| `@fastify/forwarded` | 3.1.1 | MIT |
| `@fastify/merge-json-schemas` | 0.2.2 | MIT |
| `@fastify/proxy-addr` | 5.1.2 | MIT |
| `@humanfs/core` | 0.19.2 | Apache-2.0 |
| `@humanfs/node` | 0.16.8 | Apache-2.0 |
| `@humanfs/types` | 0.15.0 | Apache-2.0 |
| `@humanwhocodes/module-importer` | 1.0.1 | Apache-2.0 |
| `@humanwhocodes/retry` | 0.4.3 | Apache-2.0 |
| `@istanbuljs/load-nyc-config` | 1.1.0 | ISC |
| `@istanbuljs/load-nyc-config/node_modules/argparse` | 1.0.10 | MIT |
| `@istanbuljs/load-nyc-config/node_modules/find-up` | 4.1.0 | MIT |
| `@istanbuljs/load-nyc-config/node_modules/js-yaml` | 3.15.2 | MIT |
| `@istanbuljs/load-nyc-config/node_modules/locate-path` | 5.0.0 | MIT |
| `@istanbuljs/load-nyc-config/node_modules/p-limit` | 2.3.0 | MIT |
| `@istanbuljs/load-nyc-config/node_modules/p-locate` | 4.1.0 | MIT |
| `@istanbuljs/load-nyc-config/node_modules/resolve-from` | 5.0.0 | MIT |
| `@istanbuljs/schema` | 0.1.6 | MIT |
| `@jest/console` | 29.7.0 | MIT |
| `@jest/core` | 29.7.0 | MIT |
| `@jest/environment` | 29.7.0 | MIT |
| `@jest/expect` | 29.7.0 | MIT |
| `@jest/expect-utils` | 29.7.0 | MIT |
| `@jest/fake-timers` | 29.7.0 | MIT |
| `@jest/globals` | 29.7.0 | MIT |
| `@jest/reporters` | 29.7.0 | MIT |
| `@jest/schemas` | 29.6.3 | MIT |
| `@jest/source-map` | 29.6.3 | MIT |
| `@jest/test-result` | 29.7.0 | MIT |
| `@jest/test-sequencer` | 29.7.0 | MIT |
| `@jest/transform` | 29.7.0 | MIT |
| `@jest/types` | 29.6.3 | MIT |
| `@jridgewell/gen-mapping` | 0.3.13 | MIT |
| `@jridgewell/remapping` | 2.3.5 | MIT |
| `@jridgewell/resolve-uri` | 3.1.2 | MIT |
| `@jridgewell/sourcemap-codec` | 1.6.0 | MIT |
| `@jridgewell/trace-mapping` | 0.3.31 | MIT |
| `@noble/hashes` | 1.8.0 | MIT |
| `@paralleldrive/cuid2` | 2.3.1 | MIT |
| `@pinojs/redact` | 0.4.0 | MIT |
| `@sinclair/typebox` | 0.27.12 | MIT |
| `@sinonjs/commons` | 3.0.1 | BSD-3-Clause |
| `@sinonjs/fake-timers` | 10.3.0 | BSD-3-Clause |
| `@smithy/core` | 3.36.2 | Apache-2.0 |
| `@smithy/credential-provider-imds` | 4.5.2 | Apache-2.0 |
| `@smithy/fetch-http-handler` | 5.8.0 | Apache-2.0 |
| `@smithy/node-http-handler` | 4.12.1 | Apache-2.0 |
| `@smithy/signature-v4` | 5.7.4 | Apache-2.0 |
| `@smithy/types` | 4.19.0 | Apache-2.0 |
| `@types/babel__core` | 7.20.5 | MIT |
| `@types/babel__generator` | 7.27.0 | MIT |
| `@types/babel__template` | 7.4.4 | MIT |
| `@types/babel__traverse` | 7.28.0 | MIT |
| `@types/estree` | 1.0.9 | MIT |
| `@types/graceful-fs` | 4.1.9 | MIT |
| `@types/istanbul-lib-coverage` | 2.0.6 | MIT |
| `@types/istanbul-lib-report` | 3.0.3 | MIT |
| `@types/istanbul-reports` | 3.0.4 | MIT |
| `@types/jest` | 29.5.14 | MIT |
| `@types/js-yaml` | 4.0.9 | MIT |
| `@types/json-schema` | 7.0.15 | MIT |
| `@types/node` | 22.20.5 | MIT |
| `@types/pg` | 8.23.1 | MIT |
| `@types/stack-utils` | 2.0.3 | MIT |
| `@types/yargs` | 17.0.35 | MIT |
| `@types/yargs-parser` | 21.0.3 | MIT |
| `@typescript-eslint/eslint-plugin` | 8.72.0 | MIT |
| `@typescript-eslint/eslint-plugin/node_modules/ignore` | 7.0.13 | MIT |
| `@typescript-eslint/parser` | 8.72.0 | MIT |
| `@typescript-eslint/project-service` | 8.72.0 | MIT |
| `@typescript-eslint/scope-manager` | 8.72.0 | MIT |
| `@typescript-eslint/tsconfig-utils` | 8.72.0 | MIT |
| `@typescript-eslint/type-utils` | 8.72.0 | MIT |
| `@typescript-eslint/types` | 8.72.0 | MIT |
| `@typescript-eslint/typescript-estree` | 8.72.0 | MIT |
| `@typescript-eslint/typescript-estree/node_modules/balanced-match` | 4.0.4 | MIT |
| `@typescript-eslint/typescript-estree/node_modules/brace-expansion` | 5.0.12 | MIT |
| `@typescript-eslint/typescript-estree/node_modules/minimatch` | 10.2.6 | BlueOak-1.0.0 |
| `@typescript-eslint/utils` | 8.72.0 | MIT |
| `@typescript-eslint/visitor-keys` | 8.72.0 | MIT |
| `@typescript-eslint/visitor-keys/node_modules/eslint-visitor-keys` | 5.0.1 | Apache-2.0 |
| `abstract-logging` | 2.0.1 | MIT |
| `acorn` | 8.19.0 | MIT |
| `acorn-jsx` | 5.3.2 | MIT |
| `ajv` | 6.15.0 | MIT |
| `ajv-formats` | 3.0.1 | MIT |
| `ajv-formats/node_modules/ajv` | 8.20.0 | MIT |
| `ajv-formats/node_modules/fast-uri` | 3.1.9 | BSD-3-Clause |
| `ajv-formats/node_modules/json-schema-traverse` | 1.0.0 | MIT |
| `ansi-escapes` | 4.3.2 | MIT |
| `ansi-regex` | 5.0.1 | MIT |
| `ansi-styles` | 4.3.0 | MIT |
| `anymatch` | 3.1.3 | ISC |
| `argparse` | 2.0.1 | Python-2.0 |
| `asap` | 2.0.6 | MIT |
| `asynckit` | 0.4.0 | MIT |
| `atomic-sleep` | 1.0.0 | MIT |
| `avvio` | 9.3.1 | MIT |
| `babel-jest` | 29.7.0 | MIT |
| `babel-plugin-istanbul` | 6.1.1 | BSD-3-Clause |
| `babel-plugin-istanbul/node_modules/istanbul-lib-instrument` | 5.2.1 | BSD-3-Clause |
| `babel-plugin-istanbul/node_modules/semver` | 6.3.1 | ISC |
| `babel-plugin-jest-hoist` | 29.6.3 | MIT |
| `babel-preset-current-node-syntax` | 1.2.0 | MIT |
| `babel-preset-jest` | 29.6.3 | MIT |
| `balanced-match` | 1.0.2 | MIT |
| `baseline-browser-mapping` | 2.11.30 | Apache-2.0 |
| `bowser` | 2.14.1 | MIT |
| `brace-expansion` | 1.1.21 | MIT |
| `braces` | 3.0.3 | MIT |
| `browserslist` | 4.29.4 | MIT |
| `bs-logger` | 0.2.6 | MIT |
| `bser` | 2.1.2 | MIT |
| `buffer-from` | 1.1.2 | MIT |
| `call-bind-apply-helpers` | 1.0.2 | MIT |
| `call-bound` | 1.0.4 | MIT |
| `callsites` | 3.1.0 | MIT |
| `camelcase` | 5.3.1 | MIT |
| `caniuse-lite` | 1.0.30001817 | CC-BY-4.0 |
| `chalk` | 4.1.2 | MIT |
| `char-regex` | 1.0.2 | MIT |
| `ci-info` | 3.9.0 | MIT |
| `cjs-module-lexer` | 1.4.3 | MIT |
| `cliui` | 8.0.1 | ISC |
| `co` | 4.6.0 | MIT |
| `collect-v8-coverage` | 1.0.3 | MIT |
| `color-convert` | 2.0.1 | MIT |
| `color-name` | 1.1.4 | MIT |
| `colorette` | 2.0.19 | MIT |
| `combined-stream` | 1.0.8 | MIT |
| `commander` | 10.0.1 | MIT |
| `component-emitter` | 1.3.1 | MIT |
| `concat-map` | 0.0.1 | MIT |
| `convert-source-map` | 2.0.0 | MIT |
| `cookie` | 2.0.1 | MIT |
| `cookie-signature` | 1.2.2 | MIT |
| `cookiejar` | 2.1.4 | MIT |
| `create-jest` | 29.7.0 | MIT |
| `cross-spawn` | 7.0.6 | MIT |
| `debug` | 4.4.3 | MIT |
| `dedent` | 1.7.2 | MIT |
| `deep-is` | 0.1.4 | MIT |
| `deepmerge` | 4.3.1 | MIT |
| `delayed-stream` | 1.0.0 | MIT |
| `dequal` | 2.0.3 | MIT |
| `detect-newline` | 3.1.0 | MIT |
| `dezalgo` | 1.0.4 | ISC |
| `diff-sequences` | 29.6.3 | MIT |
| `dunder-proto` | 1.0.1 | MIT |
| `electron-to-chromium` | 1.5.461 | ISC |
| `emittery` | 0.13.1 | MIT |
| `emoji-regex` | 8.0.0 | MIT |
| `error-ex` | 1.3.4 | MIT |
| `es-define-property` | 1.0.1 | MIT |
| `es-errors` | 1.3.0 | MIT |
| `es-object-atoms` | 1.1.2 | MIT |
| `es-set-tostringtag` | 2.1.0 | MIT |
| `escalade` | 3.2.0 | MIT |
| `escape-string-regexp` | 4.0.0 | MIT |
| `eslint` | 9.39.5 | MIT |
| `eslint-scope` | 8.4.0 | BSD-2-Clause |
| `eslint-visitor-keys` | 4.2.1 | Apache-2.0 |
| `esm` | 3.2.25 | MIT |
| `espree` | 10.4.0 | BSD-2-Clause |
| `esprima` | 4.0.1 | BSD-2-Clause |
| `esquery` | 1.7.0 | BSD-3-Clause |
| `esrecurse` | 4.3.0 | BSD-2-Clause |
| `estraverse` | 5.3.0 | BSD-2-Clause |
| `esutils` | 2.0.3 | BSD-2-Clause |
| `execa` | 5.1.1 | MIT |
| `exit` | 0.1.2 | MIT |
| `expect` | 29.7.0 | MIT |
| `fast-decode-uri-component` | 1.0.1 | MIT |
| `fast-deep-equal` | 3.1.3 | MIT |
| `fast-json-stable-stringify` | 2.1.0 | MIT |
| `fast-json-stringify` | 7.1.2 | MIT |
| `fast-json-stringify/node_modules/ajv` | 8.20.0 | MIT |
| `fast-json-stringify/node_modules/ajv/node_modules/fast-uri` | 3.1.9 | BSD-3-Clause |
| `fast-json-stringify/node_modules/json-schema-traverse` | 1.0.0 | MIT |
| `fast-levenshtein` | 2.0.6 | MIT |
| `fast-querystring` | 1.1.2 | MIT |
| `fast-safe-stringify` | 2.1.1 | MIT |
| `fast-uri` | 4.2.3 | BSD-3-Clause |
| `fastify` | 5.12.7 | MIT |
| `fastq` | 1.20.3 | ISC |
| `fb-watchman` | 2.0.4 | MIT |
| `file-entry-cache` | 8.0.0 | MIT |
| `fill-range` | 7.1.1 | MIT |
| `find-my-way` | 9.10.0 | MIT |
| `find-up` | 5.0.0 | MIT |
| `flat-cache` | 4.0.1 | MIT |
| `flatted` | 3.4.4 | ISC |
| `form-data` | 4.0.6 | MIT |
| `formidable` | 3.5.4 | MIT |
| `fs.realpath` | 1.0.0 | ISC |
| `fsevents` | 2.3.3 | MIT |
| `function-bind` | 1.1.2 | MIT |
| `gensync` | 1.0.0-beta.2 | MIT |
| `get-caller-file` | 2.0.5 | ISC |
| `get-intrinsic` | 1.3.0 | MIT |
| `get-package-type` | 0.1.0 | MIT |
| `get-proto` | 1.0.1 | MIT |
| `get-stream` | 6.0.1 | MIT |
| `getopts` | 2.3.0 | MIT |
| `glob` | 7.2.3 | ISC |
| `glob-parent` | 6.0.2 | ISC |
| `globals` | 14.0.0 | MIT |
| `gopd` | 1.2.0 | MIT |
| `graceful-fs` | 4.2.11 | ISC |
| `handlebars` | 4.7.10 | MIT |
| `has-flag` | 4.0.0 | MIT |
| `has-symbols` | 1.1.0 | MIT |
| `has-tostringtag` | 1.0.2 | MIT |
| `hasown` | 2.0.4 | MIT |
| `html-escaper` | 2.0.2 | MIT |
| `human-signals` | 2.1.0 | Apache-2.0 |
| `ignore` | 5.3.2 | MIT |
| `import-fresh` | 3.3.1 | MIT |
| `import-local` | 3.2.0 | MIT |
| `imurmurhash` | 0.1.4 | MIT |
| `inflight` | 1.0.6 | ISC |
| `inherits` | 2.0.4 | ISC |
| `interpret` | 2.2.0 | MIT |
| `ipaddr.js` | 2.5.0 | MIT |
| `is-arrayish` | 0.2.1 | MIT |
| `is-core-module` | 2.17.0 | MIT |
| `is-extglob` | 2.1.1 | MIT |
| `is-fullwidth-code-point` | 3.0.0 | MIT |
| `is-generator-fn` | 2.1.0 | MIT |
| `is-glob` | 4.0.3 | MIT |
| `is-number` | 7.0.0 | MIT |
| `is-stream` | 2.0.1 | MIT |
| `isexe` | 2.0.0 | ISC |
| `istanbul-lib-coverage` | 3.2.2 | BSD-3-Clause |
| `istanbul-lib-instrument` | 6.0.3 | BSD-3-Clause |
| `istanbul-lib-report` | 3.0.1 | BSD-3-Clause |
| `istanbul-lib-source-maps` | 4.0.1 | BSD-3-Clause |
| `istanbul-reports` | 3.2.0 | BSD-3-Clause |
| `jest` | 29.7.0 | MIT |
| `jest-changed-files` | 29.7.0 | MIT |
| `jest-circus` | 29.7.0 | MIT |
| `jest-cli` | 29.7.0 | MIT |
| `jest-config` | 29.7.0 | MIT |
| `jest-diff` | 29.7.0 | MIT |
| `jest-docblock` | 29.7.0 | MIT |
| `jest-each` | 29.7.0 | MIT |
| `jest-environment-node` | 29.7.0 | MIT |
| `jest-get-type` | 29.6.3 | MIT |
| `jest-haste-map` | 29.7.0 | MIT |
| `jest-leak-detector` | 29.7.0 | MIT |
| `jest-matcher-utils` | 29.7.0 | MIT |
| `jest-message-util` | 29.7.0 | MIT |
| `jest-mock` | 29.7.0 | MIT |
| `jest-pnp-resolver` | 1.2.3 | MIT |
| `jest-regex-util` | 29.6.3 | MIT |
| `jest-resolve` | 29.7.0 | MIT |
| `jest-resolve-dependencies` | 29.7.0 | MIT |
| `jest-runner` | 29.7.0 | MIT |
| `jest-runtime` | 29.7.0 | MIT |
| `jest-snapshot` | 29.7.0 | MIT |
| `jest-util` | 29.7.0 | MIT |
| `jest-validate` | 29.7.0 | MIT |
| `jest-validate/node_modules/camelcase` | 6.3.0 | MIT |
| `jest-watcher` | 29.7.0 | MIT |
| `jest-worker` | 29.7.0 | MIT |
| `jest-worker/node_modules/supports-color` | 8.1.1 | MIT |
| `js-tokens` | 4.0.0 | MIT |
| `js-yaml` | 4.3.2 | MIT |
| `jsesc` | 3.1.0 | MIT |
| `json-buffer` | 3.0.1 | MIT |
| `json-parse-even-better-errors` | 2.3.1 | MIT |
| `json-schema-ref-resolver` | 3.0.1 | MIT |
| `json-schema-traverse` | 0.4.1 | MIT |
| `json-stable-stringify-without-jsonify` | 1.0.1 | MIT |
| `json5` | 2.2.3 | MIT |
| `keyv` | 4.5.4 | MIT |
| `kleur` | 3.0.3 | MIT |
| `knex` | 3.3.0 | MIT |
| `knex/node_modules/debug` | 4.3.4 | MIT |
| `knex/node_modules/ms` | 2.1.2 | MIT |
| `knex/node_modules/resolve-from` | 5.0.0 | MIT |
| `leven` | 3.1.0 | MIT |
| `levn` | 0.4.1 | MIT |
| `light-my-request` | 6.8.0 | BSD-3-Clause |
| `lines-and-columns` | 1.2.4 | MIT |
| `locate-path` | 6.0.0 | MIT |
| `lodash` | 4.18.1 | MIT |
| `lodash.memoize` | 4.1.2 | MIT |
| `lodash.merge` | 4.6.2 | MIT |
| `lru-cache` | 5.1.1 | ISC |
| `make-dir` | 4.0.0 | MIT |
| `make-error` | 1.3.6 | ISC |
| `makeerror` | 1.0.12 | BSD-3-Clause |
| `math-intrinsics` | 1.1.0 | MIT |
| `merge-stream` | 2.0.0 | MIT |
| `methods` | 1.1.2 | MIT |
| `micromatch` | 4.0.8 | MIT |
| `mime` | 2.6.0 | MIT |
| `mime-db` | 1.52.0 | MIT |
| `mime-types` | 2.1.35 | MIT |
| `mimic-fn` | 2.1.0 | MIT |
| `minimatch` | 3.1.5 | ISC |
| `minimist` | 1.2.8 | MIT |
| `ms` | 2.1.3 | MIT |
| `natural-compare` | 1.4.0 | MIT |
| `neo-async` | 2.6.2 | MIT |
| `node-int64` | 0.4.0 | MIT |
| `node-releases` | 2.0.59 | MIT |
| `normalize-path` | 3.0.0 | MIT |
| `npm-run-path` | 4.0.1 | MIT |
| `object-inspect` | 1.13.4 | MIT |
| `on-exit-leak-free` | 2.1.2 | MIT |
| `once` | 1.4.0 | ISC |
| `onetime` | 5.1.2 | MIT |
| `optionator` | 0.9.4 | MIT |
| `p-limit` | 3.1.0 | MIT |
| `p-locate` | 5.0.0 | MIT |
| `p-try` | 2.2.0 | MIT |
| `parent-module` | 1.0.1 | MIT |
| `parse-json` | 5.2.0 | MIT |
| `path-exists` | 4.0.0 | MIT |
| `path-is-absolute` | 1.0.1 | MIT |
| `path-key` | 3.1.1 | MIT |
| `path-parse` | 1.0.7 | MIT |
| `pg` | 8.23.1 | MIT |
| `pg-cloudflare` | 1.4.1 | MIT |
| `pg-connection-string` | 2.6.2 | MIT |
| `pg-int8` | 1.0.1 | ISC |
| `pg-pool` | 3.14.0 | MIT |
| `pg-protocol` | 1.16.1 | MIT |
| `pg-types` | 2.2.0 | MIT |
| `pg/node_modules/pg-connection-string` | 2.14.1 | MIT |
| `pgpass` | 1.0.5 | MIT |
| `picocolors` | 1.1.1 | ISC |
| `picomatch` | 2.3.2 | MIT |
| `pino` | 9.14.0 | MIT |
| `pino-abstract-transport` | 2.0.0 | MIT |
| `pino-std-serializers` | 7.1.0 | MIT |
| `pirates` | 4.0.7 | MIT |
| `pkg-dir` | 4.2.0 | MIT |
| `pkg-dir/node_modules/find-up` | 4.1.0 | MIT |
| `pkg-dir/node_modules/locate-path` | 5.0.0 | MIT |
| `pkg-dir/node_modules/p-limit` | 2.3.0 | MIT |
| `pkg-dir/node_modules/p-locate` | 4.1.0 | MIT |
| `postgres-array` | 2.0.0 | MIT |
| `postgres-bytea` | 1.0.1 | MIT |
| `postgres-date` | 1.0.7 | MIT |
| `postgres-interval` | 1.2.0 | MIT |
| `prelude-ls` | 1.2.1 | MIT |
| `pretty-format` | 29.7.0 | MIT |
| `pretty-format/node_modules/ansi-styles` | 5.2.0 | MIT |
| `process-warning` | 5.1.1 | MIT |
| `prompts` | 2.4.2 | MIT |
| `punycode` | 2.3.1 | MIT |
| `pure-rand` | 6.1.0 | MIT |
| `qs` | 6.16.1 | BSD-3-Clause |
| `quick-format-unescaped` | 4.0.4 | MIT |
| `react-is` | 18.3.1 | MIT |
| `real-require` | 0.2.0 | MIT |
| `rechoir` | 0.8.0 | MIT |
| `require-directory` | 2.1.1 | MIT |
| `require-from-string` | 2.0.2 | MIT |
| `resolve` | 1.22.13 | MIT |
| `resolve-cwd` | 3.0.0 | MIT |
| `resolve-cwd/node_modules/resolve-from` | 5.0.0 | MIT |
| `resolve-from` | 4.0.0 | MIT |
| `resolve.exports` | 2.0.4 | MIT |
| `ret` | 0.5.1 | MIT |
| `reusify` | 1.1.0 | MIT |
| `rfdc` | 1.4.1 | MIT |
| `safe-regex2` | 5.1.2 | MIT |
| `safe-stable-stringify` | 2.5.0 | MIT |
| `secure-json-parse` | 4.1.1 | BSD-3-Clause |
| `semver` | 7.8.5 | ISC |
| `set-cookie-parser` | 3.1.4 | MIT |
| `shebang-command` | 2.0.0 | MIT |
| `shebang-regex` | 3.0.0 | MIT |
| `side-channel` | 1.1.1 | MIT |
| `side-channel-list` | 1.0.1 | MIT |
| `side-channel-map` | 1.0.1 | MIT |
| `side-channel-weakmap` | 1.0.2 | MIT |
| `signal-exit` | 3.0.7 | ISC |
| `sisteransi` | 1.0.5 | MIT |
| `slash` | 3.0.0 | MIT |
| `sonic-boom` | 4.2.1 | MIT |
| `source-map` | 0.6.1 | BSD-3-Clause |
| `source-map-support` | 0.5.13 | MIT |
| `split2` | 4.2.0 | ISC |
| `sprintf-js` | 1.0.3 | BSD-3-Clause |
| `stack-utils` | 2.0.6 | MIT |
| `stack-utils/node_modules/escape-string-regexp` | 2.0.0 | MIT |
| `string-length` | 4.0.2 | MIT |
| `string-width` | 4.2.3 | MIT |
| `strip-ansi` | 6.0.1 | MIT |
| `strip-bom` | 4.0.0 | MIT |
| `strip-final-newline` | 2.0.0 | MIT |
| `strip-json-comments` | 3.1.1 | MIT |
| `superagent` | 10.4.1 | MIT |
| `supertest` | 7.3.1 | MIT |
| `supports-color` | 7.2.0 | MIT |
| `supports-preserve-symlinks-flag` | 1.0.0 | MIT |
| `tarn` | 3.1.2 | MIT |
| `test-exclude` | 6.0.0 | ISC |
| `thread-stream` | 3.2.0 | MIT |
| `tildify` | 2.0.0 | MIT |
| `tinyglobby` | 0.2.17 | MIT |
| `tinyglobby/node_modules/fdir` | 6.5.0 | MIT |
| `tinyglobby/node_modules/picomatch` | 4.0.7 | MIT |
| `tmpl` | 1.0.5 | BSD-3-Clause |
| `to-regex-range` | 5.0.1 | MIT |
| `toad-cache` | 3.7.4 | MIT |
| `ts-api-utils` | 2.5.0 | MIT |
| `ts-jest` | 29.4.15 | MIT |
| `ts-jest/node_modules/type-fest` | 4.41.0 | (MIT OR CC0-1.0) |
| `tslib` | 2.8.1 | 0BSD |
| `type-check` | 0.4.0 | MIT |
| `type-detect` | 4.0.8 | MIT |
| `type-fest` | 0.21.3 | (MIT OR CC0-1.0) |
| `typescript` | 5.9.3 | Apache-2.0 |
| `typescript-eslint` | 8.72.0 | MIT |
| `uglify-js` | 3.19.3 | BSD-2-Clause |
| `undici-types` | 6.21.0 | MIT |
| `update-browserslist-db` | 1.3.4 | MIT |
| `uri-js` | 4.4.1 | BSD-2-Clause |
| `v8-to-istanbul` | 9.3.0 | ISC |
| `walker` | 1.0.8 | Apache-2.0 |
| `which` | 2.0.2 | ISC |
| `word-wrap` | 1.2.5 | MIT |
| `wordwrap` | 1.0.0 | MIT |
| `wrap-ansi` | 7.0.0 | MIT |
| `wrappy` | 1.0.2 | ISC |
| `write-file-atomic` | 4.0.2 | ISC |
| `xtend` | 4.0.2 | MIT |
| `y18n` | 5.0.8 | ISC |
| `yallist` | 3.1.1 | ISC |
| `yargs` | 17.7.3 | MIT |
| `yargs-parser` | 21.1.1 | ISC |
| `yocto-queue` | 0.1.0 | MIT |

## Container images and separately containerized platforms

| Image | Declared upstream licence | Role and scope |
|---|---|---|
| `node:22-slim` | Node.js MIT; Debian base contains separately licensed OS packages | API and bootstrap runtime image |
| `chrislusf/seaweedfs:4.48` | Apache-2.0 | Local S3-compatible storage service |
| `postgres:16` / `postgres:16.10-alpine` | PostgreSQL License | Application and local Lemmy databases |
| `dessalines/lemmy:0.19.12` | AGPL-3.0 | Optional, separately containerized local Lemmy instance |
| `ghost:6.0.10-alpine` | MIT for Ghost; base image contains separately licensed OS packages | Optional, separately containerized local Ghost instance |
| `asonix/pictrs:0.5.19` | AGPL-3.0 | Optional image service required by local Lemmy |

The shipped API image is the Node.js application plus its npm dependencies; it does not
bundle the separately running Lemmy or pictrs images. Therefore the local Compose stack
includes AGPL services, but the shipped API dependency inventory above contains no AGPL
package. Verify current image tags and upstream licence notices before distributing images.

## APIs, fixtures, and model use

- Slack Web API and Hashnode GraphQL are accessed as external destination APIs; no platform
  SDK is included. Their terms apply to any production integration.
- Discourse, Lemmy, Dev.to, Ghost, and webhook scenarios use local service instances or
  local mocks. The certification evidence names only the local Lemmy and Ghost hosts.
- `tests/fixtures/rule-cases.json` and `samples/catalogue/catalogue-1000.csv` are deterministic
  project-authored fixtures, not external datasets.
- No foundation model or downloaded model weights are bundled. `LLM_PROVIDER=mock` is the
  default; external Gemini/Groq services or local Ollama are optional and subject to their
  respective terms.
- Node.js built-ins are part of the Node.js runtime and are not additional npm packages.

## Upstream references

- [Node.js licence](https://github.com/nodejs/node/blob/main/LICENSE)
- [SeaweedFS licence](https://github.com/seaweedfs/seaweedfs/blob/master/LICENSE)
- [Lemmy licence](https://github.com/LemmyNet/lemmy/blob/main/LICENSE)
- [Ghost licence](https://github.com/TryGhost/Ghost/blob/main/LICENSE)
- [PostgreSQL licence](https://www.postgresql.org/about/licence/)
- [pictrs licence](https://git.asonix.dog/asonix/pict-rs/src/branch/main/LICENSE)
