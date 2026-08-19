import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import manifest from "../package.json" with { type: "json" }

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporary = mkdtempSync(join(tmpdir(), "phreshos-react-package-"))
const cache = join(temporary, "npm-cache")

try {
  const output = execFileSync(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", temporary],
    {
      cwd: repository,
      encoding: "utf8",
      env: { ...process.env, npm_config_cache: cache }
    }
  )
  const packed = JSON.parse(output)[0]
  const paths = new Set(packed.files.map(file => file.path))

  assert(paths.has("dist/main.js"), "the package has no JavaScript entry point")
  assert(paths.has("dist/main.d.ts"), "the package has no declaration entry point")
  assert(paths.has("LICENSE"), "the package has no license")
  assert(paths.has("README.md"), "the package has no README")
  assert(paths.has("package.json"), "the package has no manifest")

  for (const path of paths) {
    assert(
      path === "LICENSE" || path === "README.md" || path === "package.json" || path.startsWith("dist/"),
      `private repository material entered the package: ${path}`
    )
  }

  const consumer = join(temporary, "consumer")
  const archive = join(temporary, packed.filename)

  mkdirSync(consumer)
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }, null, 2)
  )
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      archive,
      `@phreshos/client@${manifest.devDependencies["@phreshos/client"]}`,
      `@phreshos/core@${manifest.devDependencies["@phreshos/core"]}`,
      `react@${manifest.devDependencies.react}`,
      `@types/react@${manifest.devDependencies["@types/react"]}`
    ],
    {
      cwd: consumer,
      stdio: "inherit",
      env: { ...process.env, npm_config_cache: cache }
    }
  )

  writeFileSync(
    join(consumer, "runtime.mjs"),
    `import assert from "node:assert/strict"

const messages = []
const parent = { postMessage: message => messages.push(message) }
globalThis.window = { parent, addEventListener() {} }

const sdk = await import("@phreshos/react")

for (const name of [
  "CurrentProvider",
  "HostProvider",
  "useColor",
  "useDesktopSize",
  "useHostTheme",
  "useObserve",
  "useObserveAnswers",
  "useObserveAsks",
  "useParent",
  "usePointerPosition",
  "useProcess",
  "useProcessState",
  "useProgram",
  "useProgramState",
  "useScale",
  "useServiceState",
  "useSubscribe",
  "useWindowState"
]) assert.equal(typeof sdk[name], "function", name)

assert.equal(messages.length, 1)
assert.equal(messages[0][0], "boundary")
assert.equal(messages[0][1], "document")
assert.equal(typeof messages[0][2], "string")
`
  )
  execFileSync(process.execPath, [join(consumer, "runtime.mjs")], {
    cwd: consumer,
    stdio: "inherit"
  })

  writeFileSync(
    join(consumer, "consumer.tsx"),
    `import { current, host } from "@phreshos/client"
import {
  CurrentProvider,
  HostProvider,
  useColor,
  useHostTheme,
  useProcess,
  useProcessState,
  useScale,
  useServiceState,
  useDesktopSize
} from "@phreshos/react"

function Content() {
  const theme = useHostTheme()
  const desktop = useDesktopSize()
  const process = useProcess()
  const state = useProcessState(process)
  const service = useServiceState(host.service({ program: "counter", endpoint: "server", name: "state" }))
  const spacing = useScale(theme.spacing)
  const accent = useColor(theme.accent)
  return <span style={{ color: accent.base, padding: spacing.small }}>{desktop.width + Number(state?.clientExists) + Number(service?.disabled)}</span>
}

const tree = (
  <CurrentProvider provide={["process"]} fallback={null}>
    <HostProvider provide={["theme", "desktopSize"]} fallback={null}>
      <Content />
    </HostProvider>
  </CurrentProvider>
)

void current
void tree
`
  )
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          lib: ["DOM", "ESNext"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          strict: true,
          target: "ESNext"
        },
        include: ["consumer.tsx"]
      },
      null,
      2
    )
  )

  const typescript = resolve(repository, "node_modules/typescript/bin/tsc")
  assert(readFileSync(typescript).length > 0, "TypeScript is not installed")
  execFileSync(process.execPath, [typescript, "-p", join(consumer, "tsconfig.json")], {
    cwd: consumer,
    stdio: "inherit"
  })
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
