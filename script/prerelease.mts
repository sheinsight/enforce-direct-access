import { globby } from "globby";
import { type NormalizedPackageJson, readPackage } from "read-pkg";
import { writePackage } from "write-pkg";
import { dirname, join } from "node:path";
import enquirer from "enquirer";
import semver from "semver";
import { $ } from "execa";

interface Content {
  path: string;
  content: NormalizedPackageJson;
}

const root = await readPackage({ cwd: process.cwd() });

const $$ = $({
  stdout: process.stdout,
  stderr: process.stderr,
});

const stdout = await $`git rev-parse --short HEAD`;

const hash = stdout.stdout;

const choices = (
  [
    "major",
    "minor",
    "patch",
    "premajor",
    "preminor",
    "prepatch",
    "prerelease",
    "snapshot",
  ] as const
).map((type) => {
  if (type === "snapshot") {
    const next = `0.0.0-snapshot.${hash}`;
    return {
      name: next,
      message: "snapshot",
      hint: next,
      value: next,
    };
  }
  const value = semver.inc(root.version, type, "alpha")!;
  return {
    name: value,
    message: type,
    hint: value,
    value: value,
  };
});

const { v } = await enquirer.prompt<{ v: string }>({
  type: "select",
  name: "v",
  message: "What type of release?",
  choices: choices,
});

let packages = await globby("**/package.json", {
  ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/cjs/**"],
  absolute: true,
});

const published: Content[] = [];
for (const element of packages) {
  const content = await readPackage({
    cwd: dirname(element),
  });
  if (content.private === true) {
    continue;
  }
  published.push({
    path: element,
    content,
  });
}

const { isSure } = await enquirer.prompt<{ isSure: boolean }>({
  type: "confirm",
  initial: false,
  name: "isSure",
  message: `Are you sure to release? [ ${v} ]
${published.map((v) => `${v.content.name} In ${v.path}`).join("\n")}
`,
});

if (isSure) {
  for (const ele of published) {
    ele.content.version = v;

    if (ele.content.publishConfig === undefined) {
      throw new Error(`Please config publishConfig in ${ele.path}`);
    } else {
      if (v.includes("alpha")) {
        ele.content.publishConfig.tag = "alpha";
      } else if (v.includes("snapshot")) {
        ele.content.publishConfig.tag = "snapshot";
      } else {
        ele.content.publishConfig.tag = "latest";
      }
    }

    await writePackage(ele.path, ele.content);
  }

  root.version = v;

  await writePackage(`${join(process.cwd(), "package.json")}`, root);

  await $$`git add .`;
  const msg = `chore: release v${v}`;
  await $$`git commit -m ${msg}`;
  await $$`git tag v${v}`;
}
