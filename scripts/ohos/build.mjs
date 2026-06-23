#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createPackage } from "@electron/asar";
import JSON5 from "json5";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const defaultElectronTemplateUrl =
  "https://yx-web-nosdn.netease.im/package/1781678745932/v34.8.2-20260527.1-release.zip?download=v34.8.2-20260527.1-release.zip";

const electronTemplateUrl = process.env.OHOS_ELECTRON_TEMPLATE_URL || defaultElectronTemplateUrl;
const releaseRoot = path.join(repoRoot, "release");
const ohosProjectRoot = path.join(releaseRoot, "ohos-hap");
const templateArchivePath = path.join(releaseRoot, fileNameFromUrl(electronTemplateUrl));
const templateExtractDir = path.join(releaseRoot, "ohos-template-extracted");
const appStagingDir = path.join(releaseRoot, "ohos-app-staging");

const devecoStudioHome = resolveOptionalPath(
  process.env.DEVECO_STUDIO_HOME ||
    findFirstExistingPath([
      "/Applications/DevEco-Studio.app",
      "/Applications/DevEco Studio.app",
    ]),
);
const inferredDevecoSdkHome = devecoStudioHome
  ? path.join(devecoStudioHome, "Contents/sdk")
  : "";
const devecoSdkHome = resolveOptionalPath(process.env.DEVECO_SDK_HOME || inferredDevecoSdkHome);
const ohosBaseSdkHome = resolveOptionalPath(
  process.env.OHOS_BASE_SDK_HOME ||
    findFirstExistingPath([
      path.join(devecoSdkHome, "default/openharmony"),
      path.join(devecoSdkHome, "openharmony"),
      devecoSdkHome,
    ]),
);
const ohpm = findExecutable("OHPM", [
  path.join(devecoStudioHome, "Contents/tools/ohpm/bin/ohpm"),
  "ohpm",
]);
const hdc = findExecutable("HDC", [
  path.join(ohosBaseSdkHome, "toolchains/hdc"),
  path.join(devecoSdkHome, "default/hms/toolchains/hdc"),
  path.join(devecoStudioHome, "Contents/sdk/default/openharmony/toolchains/hdc"),
  path.join(devecoStudioHome, "Contents/sdk/default/hms/toolchains/hdc"),
  "hdc",
]);

const moduleName = process.env.OHOS_MODULE_NAME || "electron";
const abilityName = process.env.OHOS_ABILITY_NAME || "EntryAbility";
const nativeAbi = process.env.OHOS_NATIVE_ABI || "arm64-v8a";
const artifactArch = process.env.OHOS_ARTIFACT_ARCH || "arm64";
const nodeNimInstallPlatform = process.env.OHOS_NODE_NIM_PLATFORM || "ohos";
const nodeNimInstallArch = process.env.OHOS_NODE_NIM_ARCH || "arm64";
const launchWaitMs = Number(process.env.OHOS_LAUNCH_WAIT_MS || "8000");
const hilogTimeoutMs = Number(process.env.OHOS_HILOG_TIMEOUT_MS || "8000");
const maxCapturedOutputBytes = Number(process.env.OHOS_MAX_CAPTURED_OUTPUT_BYTES || "1048576");

const appDir = path.join(
  ohosProjectRoot,
  "web_engine/src/main/resources/resfile/resources/app",
);
const appAsarPath = path.join(path.dirname(appDir), "app.asar");
const moduleRoot = path.join(ohosProjectRoot, moduleName);
const nativeLibDir = path.join(moduleRoot, `libs/${nativeAbi}`);
const copiedNodeNimDependencies = [];
const copiedNativeLibraries = [];
const temporarySigningDirs = [];

let buildConfig = null;
let nodeNimNativeLibDir = "";
let currentSigningConfig = null;

function resolveOptionalPath(value) {
  if (!value) {
    return "";
  }
  if (isAbsoluteOrWindowsPath(value)) {
    return value;
  }
  return path.resolve(repoRoot, value);
}

function isAbsoluteOrWindowsPath(value) {
  return path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(String(value));
}

function isPathLike(value) {
  return isAbsoluteOrWindowsPath(value) || String(value).includes("/") || String(value).includes("\\");
}

function findFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const resolved = resolveOptionalPath(candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return "";
}

function findExecutable(envName, candidates) {
  if (process.env[envName]) {
    const value = process.env[envName];
    return isPathLike(value) ? resolveOptionalPath(value) : value;
  }
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const resolved = resolveOptionalPath(candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return candidates.at(-1) || envName.toLowerCase();
}

function shouldProvideDevecoSdkHome() {
  return Boolean(devecoSdkHome && fs.existsSync(devecoSdkHome));
}

function log(message, data) {
  console.log(`\n[ohos-build] ${message}`);
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function ensureExists(target) {
  if (!fs.existsSync(target)) {
    throw new Error(`Missing required path: ${target}`);
  }
}

function ensureFile(target) {
  ensureExists(target);
  if (!fs.statSync(target).isFile()) {
    throw new Error(`Expected file: ${target}`);
  }
}

function ensureExecutable(target) {
  if (isPathLike(target)) {
    ensureExists(target);
  }
}

function ensureToolExecutable(target, toolName, envName) {
  if (isPathLike(target)) {
    ensureExecutable(target);
    return;
  }

  const pathDirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const existsInPath = pathDirs.some((dir) => fs.existsSync(path.join(dir, target)));
  if (!existsInPath) {
    throw new Error(
      `Cannot find ${toolName}. Set ${envName} to the executable path or add ${target} to PATH.`,
    );
  }
}

function remove(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(src, dest) {
  remove(dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function copyOptionalDir(src, dest) {
  if (fs.existsSync(src)) {
    copyDir(src, dest);
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function readJson5(target) {
  return JSON5.parse(fs.readFileSync(target, "utf8"));
}

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function readText(target) {
  return fs.readFileSync(target, "utf8");
}

function fileNameFromUrl(value) {
  const parsed = new URL(value);
  const downloadName = parsed.searchParams.get("download");
  const fallbackName = path.basename(parsed.pathname);
  return sanitizeFileName(downloadName || fallbackName || "download.bin");
}

function sanitizeFileName(value) {
  return value.replace(/[^\w.+-]/g, "_");
}

function packagePath(root, packageName) {
  return path.join(root, "node_modules", ...packageName.split("/"));
}

function resolveDependencyDir(fromDir, packageName) {
  let current = fromDir;
  while (true) {
    const candidate = packagePath(current, packageName);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function collectProductionDependencies(packageRoot) {
  const deps = new Map();

  function visit(currentPackageRoot) {
    const packageJsonPath = path.join(currentPackageRoot, "package.json");
    const packageJson = readJson(packageJsonPath);

    for (const packageName of Object.keys(packageJson.dependencies || {})) {
      const depDir = resolveDependencyDir(currentPackageRoot, packageName);
      if (!depDir) {
        throw new Error(
          `Missing production dependency "${packageName}" required by ${packageJsonPath}`,
        );
      }

      const existing = deps.get(packageName);
      if (existing) {
        if (existing !== depDir) {
          log("skip duplicate production dependency name", {
            packageName,
            existing,
            skipped: depDir,
          });
        }
        continue;
      }

      deps.set(packageName, depDir);
      visit(depDir);
    }
  }

  visit(packageRoot);
  return deps;
}

function run(command, args, options = {}) {
  console.log(`[run] ${[command, ...args].join(" ")}`);
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: createToolEnv(options.env),
      shell: false,
      stdio: options.quiet ? "pipe" : "inherit",
    });
    let stdout = "";
    let stderr = "";
    let timeout = null;

    function appendOutput(current, chunk) {
      const next = current + chunk.toString();
      if (next.length <= maxCapturedOutputBytes) {
        return next;
      }
      return next.slice(next.length - maxCapturedOutputBytes);
    }

    if (options.quiet) {
      child.stdout.on("data", (chunk) => {
        stdout = appendOutput(stdout, chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr = appendOutput(stderr, chunk);
      });
    }

    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, options.timeoutMs);
    }

    child.on("error", (error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (options.allowFailure) {
        resolve({ code: null, signal: null, stdout, stderr, timedOut, error });
        return;
      }
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (code === 0 || options.allowFailure) {
        resolve({ code, signal, stdout, stderr, timedOut });
        return;
      }
      const error = new Error(`Command failed (${code}): ${command} ${args.join(" ")}`);
      error.result = { code, signal, stdout, stderr, timedOut };
      reject(error);
    });
  });
}

function createToolEnv(extra = {}) {
  return {
    ...process.env,
    ...(shouldProvideDevecoSdkHome() ? { DEVECO_SDK_HOME: devecoSdkHome } : {}),
    ...(ohosBaseSdkHome ? { OHOS_BASE_SDK_HOME: ohosBaseSdkHome } : {}),
    ...extra,
  };
}

function runSync(command, args, options = {}) {
  const logArgs = options.redactedArgs || args;
  console.log(`[run] ${[command, ...logArgs].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: createToolEnv(options.env),
    shell: false,
    stdio: options.quiet ? "pipe" : "inherit",
    encoding: "utf8",
    maxBuffer: options.maxBuffer || 1024 * 1024 * 32,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    const detail = output ? `\n${output}` : "";
    throw new Error(
      `Command failed (${result.status}): ${command} ${logArgs.join(" ")}${detail}`,
    );
  }
  return result;
}

function redactArgs(args) {
  const sensitiveFlags = new Set(["-keyPwd", "-keystorePwd"]);
  return args.map((arg, index) => (sensitiveFlags.has(args[index - 1]) ? "<redacted>" : arg));
}

function shouldRunInstall() {
  if (process.env.OHOS_SKIP_NPM_INSTALL === "1") {
    return false;
  }
  if (process.env.OHOS_FORCE_NPM_INSTALL === "1") {
    return true;
  }
  return !fs.existsSync(path.join(repoRoot, "node_modules"));
}

function nodeNimNativeReleaseDir() {
  return path.join(packagePath(repoRoot, "node-nim"), "build/Release");
}

function hasNodeNimNativeOutput() {
  const releaseDir = nodeNimNativeReleaseDir();
  return (
    fs.existsSync(path.join(releaseDir, "node-nim.node")) &&
    fs.existsSync(path.join(releaseDir, "libnim.so")) &&
    fs.existsSync(path.join(releaseDir, "libh_available.so")) &&
    !fs.existsSync(path.join(releaseDir, "libnode-nim.so"))
  );
}

function shouldBuildHap() {
  return process.env.OHOS_SKIP_HAP_BUILD !== "1";
}

function shouldInstallOhosDependencies() {
  if (!shouldBuildHap()) {
    return false;
  }
  return process.env.OHOS_SKIP_OHPM_INSTALL !== "1";
}

function renderTemplate(value, context) {
  return String(value).replace(/\$\{(\w+)}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(context, key)) {
      return context[key];
    }
    return match;
  });
}

function normalizeBundleName(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/(^\.)|(\.$)/g, "")
    .split(".")
    .filter(Boolean)
    .map((segment) => (/^[a-z]/.test(segment) ? segment : `a${segment}`))
    .join(".");

  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(normalized)) {
    throw new Error(`Invalid HarmonyOS bundleName generated from appId: ${value}`);
  }
  return normalized;
}

function requireConfig(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required config: ${name}`);
  }
  return value;
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function requireSigningConfig(value, name) {
  if (!hasValue(value)) {
    throw new Error(`Missing required OHOS signing config: ${name}`);
  }
  return value;
}

function normalizeConfiguredSigning(rawSigning) {
  if (!rawSigning || Object.keys(rawSigning).length === 0) {
    return null;
  }
  const requiredFields = [
    "certPath",
    "profile",
    "keyAlias",
    "keyPassword",
    "storeFile",
    "storePassword",
  ];
  const hasAnyRequiredField = requiredFields.some((field) => hasValue(rawSigning[field]));
  if (!hasAnyRequiredField) {
    return null;
  }

  const signing = {
    source: "ohos-builder.json5",
    name: rawSigning.name || "default",
    type: rawSigning.type || "HarmonyOS",
    certPath: resolveOptionalPath(
      requireSigningConfig(rawSigning.certPath, "ohos-builder.signing.certPath"),
    ),
    profile: resolveOptionalPath(
      requireSigningConfig(rawSigning.profile, "ohos-builder.signing.profile"),
    ),
    keyAlias: requireSigningConfig(rawSigning.keyAlias, "ohos-builder.signing.keyAlias"),
    keyPassword: requireSigningConfig(
      rawSigning.keyPassword,
      "ohos-builder.signing.keyPassword",
    ),
    storeFile: resolveOptionalPath(
      requireSigningConfig(rawSigning.storeFile, "ohos-builder.signing.storeFile"),
    ),
    storePassword: requireSigningConfig(
      rawSigning.storePassword,
      "ohos-builder.signing.storePassword",
    ),
    signAlg: rawSigning.signAlg || "SHA256withECDSA",
  };

  ensureFile(signing.certPath);
  ensureFile(signing.profile);
  ensureFile(signing.storeFile);
  return signing;
}

function resolveSigningConfig() {
  if (buildConfig.signing) {
    validateSigningProfile(buildConfig.signing.profile);
    return buildConfig.signing;
  }

  const envSigning = resolveEnvSigningConfig();
  if (envSigning) {
    validateSigningProfile(envSigning.profile);
  }
  return envSigning;
}

function resolveEnvSigningConfig() {
  const profile = resolveFileMaterial("OHAP_SIGN_PROFILE", "profile.p7b");
  const certPath = resolveFileMaterial("OHAP_SIGN_CERT", "app.cer");
  const storeFile = resolveFileMaterial("OHAP_SIGN_STORE_FILE", "keystore.p12");
  const hasAnySigningMaterial = Boolean(profile || certPath || storeFile);

  if (!hasAnySigningMaterial) {
    if (process.env.OHAP_REQUIRE_TEAM_SIGNING === "true") {
      throw new Error(
        "Team signing is required. Configure ohos-builder.json5 signing or OHAP_SIGN_PROFILE, OHAP_SIGN_CERT and OHAP_SIGN_STORE_FILE.",
      );
    }
    return null;
  }

  if (!profile || !certPath || !storeFile) {
    throw new Error(
      "Incomplete OHAP signing material. OHAP_SIGN_PROFILE, OHAP_SIGN_CERT and OHAP_SIGN_STORE_FILE are all required.",
    );
  }
  if (!process.env.OHAP_SIGN_KEY_PASSWORD || !process.env.OHAP_SIGN_STORE_PASSWORD) {
    throw new Error(
      "OHAP_SIGN_KEY_PASSWORD and OHAP_SIGN_STORE_PASSWORD are required for OHAP signing.",
    );
  }

  if (
    usesFileMaterialBase64() ||
    process.env.OHAP_SIGN_MATERIAL_DIR ||
    process.env.OHAP_SIGN_MATERIAL_TAR_BASE64
  ) {
    ensureHvigorMaterialDir(profile);
  }
  return {
    source: "environment",
    name: process.env.OHAP_SIGN_CONFIG_NAME || "default",
    type: process.env.OHAP_SIGN_TYPE || "HarmonyOS",
    certPath,
    profile,
    keyAlias: process.env.OHAP_SIGN_KEY_ALIAS || "debugKey",
    keyPassword: process.env.OHAP_SIGN_KEY_PASSWORD,
    storeFile,
    storePassword: process.env.OHAP_SIGN_STORE_PASSWORD,
    signAlg: process.env.OHAP_SIGN_ALG || "SHA256withECDSA",
  };
}

function usesFileMaterialBase64() {
  return Boolean(
    process.env.OHAP_SIGN_PROFILE_BASE64 ||
      process.env.OHAP_SIGN_CERT_BASE64 ||
      process.env.OHAP_SIGN_STORE_FILE_BASE64,
  );
}

function resolveFileMaterial(envName, fileName) {
  const direct = process.env[envName];
  if (direct) {
    return resolveOptionalPath(direct);
  }

  const base64 = process.env[`${envName}_BASE64`];
  if (!base64) {
    return undefined;
  }

  const tempDir = resolveSigningTempDir();
  const file = path.join(tempDir, fileName);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(resolveBase64Content(base64), "base64"));
  return file;
}

function resolveSigningMaterialDir() {
  const direct = process.env.OHAP_SIGN_MATERIAL_DIR;
  if (direct) {
    return resolveOptionalPath(direct);
  }

  const tarBase64 = process.env.OHAP_SIGN_MATERIAL_TAR_BASE64;
  if (!tarBase64) {
    return undefined;
  }

  const tempDir = resolveSigningTempDir();
  const archive = path.join(tempDir, "material.tar");
  fs.writeFileSync(archive, Buffer.from(resolveBase64Content(tarBase64), "base64"));
  runSync("tar", ["-xf", archive, "-C", tempDir], { quiet: true });
  return path.join(tempDir, "material");
}

function resolveBase64Content(value) {
  const possibleFile = resolveOptionalPath(value);
  if (fs.existsSync(possibleFile) && fs.statSync(possibleFile).isFile()) {
    return readText(possibleFile).trim();
  }
  return value;
}

function resolveSigningTempDir() {
  if (temporarySigningDirs.length > 0) {
    return temporarySigningDirs[0];
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ohap-team-sign-"));
  temporarySigningDirs.push(tempDir);
  return tempDir;
}

function cleanupSigningMaterials() {
  for (const dir of temporarySigningDirs.splice(0)) {
    remove(dir);
  }
}

function ensureHvigorMaterialDir(profileFile) {
  const expectedMaterialDir = path.join(path.dirname(profileFile), "material");
  if (process.env.OHAP_SIGN_MATERIAL_DIR || process.env.OHAP_SIGN_MATERIAL_TAR_BASE64) {
    const materialDir = resolveSigningMaterialDir();
    if (materialDir !== expectedMaterialDir) {
      throw new Error(`OHAP signing material directory must resolve to ${expectedMaterialDir}`);
    }
  }
  if (!fs.existsSync(expectedMaterialDir)) {
    throw new Error(
      "OHAP_SIGN_MATERIAL_TAR_BASE64 is required when signing files are provided through *_BASE64 variables.",
    );
  }
}

function matchJsonString(text, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`"${escapedKey}"\\s*:\\s*"([^"]+)"`))?.[1];
}

function validateSigningProfile(profileFile) {
  const profileText = readText(profileFile);
  const profileBundleName = matchJsonString(profileText, "bundle-name");
  const profileAppIdentifier = matchJsonString(profileText, "app-identifier");
  const expectedAppIdentifier = process.env.OHAP_APP_IDENTIFIER;

  if (profileBundleName && profileBundleName !== buildConfig.bundleName) {
    throw new Error(
      `Signing profile bundle-name mismatch. profile=${profileBundleName}, project=${buildConfig.bundleName}`,
    );
  }
  if (profileAppIdentifier && expectedAppIdentifier && profileAppIdentifier !== expectedAppIdentifier) {
    throw new Error("Signing profile app-identifier mismatch.");
  }
}

function loadBuildConfig() {
  const electronBuilderConfig = readJson5(path.join(repoRoot, "electron-builder.json5"));
  const ohosBuilderConfig = readJson5(path.join(repoRoot, "ohos-builder.json5"));
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  const ohosAppId = ohosBuilderConfig.appId || electronBuilderConfig.appId;
  const bundleName = normalizeBundleName(
    requireConfig(ohosAppId, "ohos-builder.appId or appId"),
  );
  const version = packageJson.version || "0.0.0";
  const artifactContext = {
    version,
    arch: artifactArch,
    ext: "hap",
  };
  const outputDirTemplate = electronBuilderConfig.directories?.output || "release";
  const outputDir = resolveOptionalPath(renderTemplate(outputDirTemplate, artifactContext));
  const artifactName = renderTemplate(
    requireConfig(ohosBuilderConfig.artifactName, "ohos-builder.artifactName"),
    artifactContext,
  );

  return {
    rawAppId: electronBuilderConfig.appId,
    ohosAppId,
    bundleName,
    productName: requireConfig(
      ohosBuilderConfig.productName || electronBuilderConfig.productName,
      "ohos-builder.productName or productName",
    ),
    description: requireConfig(
      ohosBuilderConfig.description || packageJson.description,
      "ohos-builder.description or package.json.description",
    ),
    version,
    icon: resolveOptionalPath(requireConfig(ohosBuilderConfig.icon, "ohos-builder.icon")),
    productLogo: resolveOptionalPath(
      requireConfig(ohosBuilderConfig.productLogo, "ohos-builder.productLogo"),
    ),
    startIcon: resolveOptionalPath(
      requireConfig(ohosBuilderConfig.startIcon, "ohos-builder.startIcon"),
    ),
    artifactName,
    outputDir,
    finalHapPath: path.join(outputDir, artifactName),
    signing: normalizeConfiguredSigning(ohosBuilderConfig.signing),
  };
}

async function downloadFile(url, dest) {
  if (
    process.env.OHOS_FORCE_DOWNLOAD !== "1" &&
    fs.existsSync(dest) &&
    fs.statSync(dest).size > 0
  ) {
    log("use cached download", { url, dest });
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tempDest = `${dest}.download`;
  remove(tempDest);
  log("download", { url, dest });
  await downloadToFile(url, tempDest);
  fs.renameSync(tempDest, dest);
}

function downloadToFile(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error(`Too many redirects while downloading ${url}`));
      return;
    }

    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const request = client.get(parsed, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        const nextUrl = new URL(response.headers.location, url).toString();
        downloadToFile(nextUrl, dest, redirects + 1).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed ${response.statusCode}: ${url}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
      file.on("error", reject);
    });

    request.on("error", reject);
  });
}

async function extractZip(archivePath, destDir) {
  remove(destDir);
  fs.mkdirSync(destDir, { recursive: true });
  await run("unzip", ["-q", archivePath, "-d", destDir]);
  await extractNestedArchives(destDir);
}

async function extractNestedArchives(root) {
  const archives = findFiles(root, (filePath) => {
    return filePath.endsWith(".tar.gz") || filePath.endsWith(".tgz");
  });
  for (const archivePath of archives) {
    const markerPath = `${archivePath}.extracted`;
    if (fs.existsSync(markerPath)) {
      continue;
    }
    log("extract nested archive", { archivePath, destDir: path.dirname(archivePath) });
    await run("tar", ["-xzf", archivePath, "-C", path.dirname(archivePath)]);
    fs.writeFileSync(markerPath, "");
  }
}

function findFiles(root, predicate) {
  const results = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) {
      continue;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && predicate(entryPath)) {
        results.push(entryPath);
      }
    }
  }
  return results;
}

function findNewestFile(root, predicate) {
  const files = findFiles(root, predicate);
  if (files.length === 0) {
    return "";
  }
  return files.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
}

function findDirectory(root, predicate) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) {
      continue;
    }
    if (predicate(current)) {
      return current;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      }
    }
  }
  return "";
}

function findOhosHapTemplate(root) {
  const direct = path.join(root, "ohos_hap");
  if (fs.existsSync(path.join(direct, "AppScope/app.json5"))) {
    return direct;
  }

  const found = findDirectory(root, (dir) => {
    return (
      path.basename(dir) === "ohos_hap" &&
      fs.existsSync(path.join(dir, "AppScope/app.json5")) &&
      fs.existsSync(path.join(dir, "electron"))
    );
  });
  if (!found) {
    throw new Error(`Cannot find ohos_hap template under ${root}`);
  }
  return found;
}

async function prepareDownloadedInputs() {
  fs.mkdirSync(releaseRoot, { recursive: true });
  await downloadFile(electronTemplateUrl, templateArchivePath);
  await extractZip(templateArchivePath, templateExtractDir);
}

function prepareOhosProject() {
  const templateRoot = findOhosHapTemplate(templateExtractDir);
  copyDir(templateRoot, ohosProjectRoot);
  currentSigningConfig = resolveSigningConfig();
  if (currentSigningConfig) {
    injectHvigorSigningConfig(currentSigningConfig);
  } else {
    sanitizeBuildProfileForUnsigned();
  }
}

function sanitizeBuildProfileForUnsigned() {
  const buildProfilePath = path.join(ohosProjectRoot, "build-profile.json5");
  const buildProfile = readJson5(buildProfilePath);
  buildProfile.app ||= {};
  buildProfile.app.products ||= [];
  for (const product of buildProfile.app.products) {
    product.signingConfig = "default";
  }
  buildProfile.app.signingConfigs = [];
  writeJson(buildProfilePath, buildProfile);
}

function injectHvigorSigningConfig(signing) {
  const buildProfilePath = path.join(ohosProjectRoot, "build-profile.json5");
  const buildProfile = readJson5(buildProfilePath);
  buildProfile.app ||= {};
  buildProfile.app.products ||= [];
  for (const product of buildProfile.app.products) {
    product.signingConfig = signing.name;
  }
  buildProfile.app.signingConfigs = [
    {
      name: signing.name,
      type: signing.type,
      material: {
        certpath: signing.certPath,
        keyAlias: signing.keyAlias,
        keyPassword: signing.keyPassword,
        profile: signing.profile,
        signAlg: signing.signAlg,
        storeFile: signing.storeFile,
        storePassword: signing.storePassword,
      },
    },
  ];
  writeJson(buildProfilePath, buildProfile);
  log("OHOS signing config injected", {
    source: signing.source,
    name: signing.name,
    type: signing.type,
    certPath: signing.certPath,
    profile: signing.profile,
    keyAlias: signing.keyAlias,
    storeFile: signing.storeFile,
    signAlg: signing.signAlg,
  });
}

function removeUnsupportedRequestPermissions() {
  const moduleJsonPath = path.join(ohosProjectRoot, "web_engine/src/main/module.json5");
  const moduleJson = readJson5(moduleJsonPath);
  const requestPermissions = moduleJson.module?.requestPermissions;
  if (!Array.isArray(requestPermissions)) {
    return;
  }

  const unsupportedPermissions = new Set(["ohos.permission.READ_PASTEBOARD"]);
  const beforeCount = requestPermissions.length;
  moduleJson.module.requestPermissions = requestPermissions.filter((permission) => {
    return !unsupportedPermissions.has(permission?.name);
  });

  if (moduleJson.module.requestPermissions.length !== beforeCount) {
    writeJson(moduleJsonPath, moduleJson);
    log("unsupported OHOS permissions removed", [...unsupportedPermissions]);
  }
}

function setStringValue(resourcePath, name, value) {
  const resource = readJson5(resourcePath);
  resource.string ||= [];
  const entry = resource.string.find((item) => item.name === name);
  if (entry) {
    entry.value = value;
  } else {
    resource.string.push({ name, value });
  }
  writeJson(resourcePath, resource);
}

function injectProjectMetadata() {
  const appJsonPath = path.join(ohosProjectRoot, "AppScope/app.json5");
  const appJson = readJson5(appJsonPath);
  appJson.app ||= {};
  appJson.app.bundleName = buildConfig.bundleName;
  appJson.app.versionName = buildConfig.version;
  writeJson(appJsonPath, appJson);

  setStringValue(
    path.join(ohosProjectRoot, "AppScope/resources/base/element/string.json"),
    "app_name",
    buildConfig.productName,
  );
  for (const locale of ["base", "zh_CN"]) {
    const stringPath = path.join(
      ohosProjectRoot,
      `electron/src/main/resources/${locale}/element/string.json`,
    );
    setStringValue(stringPath, "EntryAbility_label", buildConfig.productName);
    setStringValue(stringPath, "EntryAbility_desc", buildConfig.description);
  }

  copyFile(
    buildConfig.icon,
    path.join(ohosProjectRoot, "AppScope/resources/base/media/app_icon.png"),
  );
  copyFile(
    buildConfig.productLogo,
    path.join(ohosProjectRoot, "AppScope/resources/base/media/product_logo_32.png"),
  );
  copyFile(
    buildConfig.startIcon,
    path.join(ohosProjectRoot, "AppScope/resources/base/media/startIcon.png"),
  );

  log("project metadata injected", {
    appId: buildConfig.rawAppId,
    ohosAppId: buildConfig.ohosAppId,
    bundleName: buildConfig.bundleName,
    productName: buildConfig.productName,
    description: buildConfig.description,
    artifactName: buildConfig.artifactName,
  });
}

async function buildWebAssets() {
  if (shouldRunInstall()) {
    log("install npm dependencies");
    await run("npm", ["ci", "--ignoreDownloadSdk"], { cwd: repoRoot });
  } else {
    log("skip npm install");
  }

  if (process.env.OHOS_SKIP_WEB_BUILD === "1") {
    log("skip vite build");
  } else {
    log("build renderer and electron assets");
    await run("npx", ["vue-tsc", "--noEmit"], { cwd: repoRoot });
    await run("npx", ["vite", "build"], {
      cwd: repoRoot,
      env: {
        NODE_ENV: "production",
        NIM_OHOS_BUILD: "1",
      },
    });
  }

  log("rebuild node-nim OHOS native package");
  await run(
    "npm",
    [
      "rebuild",
      "node-nim",
      `--platform=${nodeNimInstallPlatform}`,
      `--arch=${nodeNimInstallArch}`,
      `--foreground-scripts`,
    ],
    { cwd: repoRoot },
  );
  nodeNimNativeLibDir = nodeNimNativeReleaseDir();
  if (!hasNodeNimNativeOutput()) {
    throw new Error(`node-nim OHOS native output is incomplete under ${nodeNimNativeLibDir}`);
  }
}

async function installOhosDependencies() {
  if (!shouldInstallOhosDependencies()) {
    log("skip OHPM install");
    return;
  }

  ensureToolExecutable(ohpm, "OHPM", "OHPM");
  log("install OHOS dependencies");
  await run(ohpm, ["install", "--all"], { cwd: ohosProjectRoot });
}

function writeAppPackageJson() {
  const source = readJson(path.join(repoRoot, "package.json"));
  const appPackageJson = {
    name: source.name,
    version: source.version,
    description: source.description,
    author: source.author,
    homepage: source.homepage,
    type: "module",
    main: "dist-electron/main.js",
    dependencies: {
      "node-nim": source.dependencies && source.dependencies["node-nim"],
    },
  };
  fs.writeFileSync(
    path.join(appStagingDir, "package.json"),
    `${JSON.stringify(appPackageJson, null, 2)}\n`,
  );
}

function syncAppResources() {
  ensureExists(path.join(repoRoot, "dist"));
  ensureExists(path.join(repoRoot, "dist-electron/main.js"));
  ensureExists(path.join(repoRoot, "dist-electron/preload.mjs"));
  remove(appAsarPath);
  remove(appDir);
  remove(appStagingDir);
  fs.mkdirSync(appStagingDir, { recursive: true });
  copyDir(path.join(repoRoot, "dist"), path.join(appStagingDir, "dist"));
  copyDir(path.join(repoRoot, "dist-electron"), path.join(appStagingDir, "dist-electron"));
  writeAppPackageJson();
}

function patchNodeNimLoader(nodeNimDest) {
  const loaderPath = path.join(nodeNimDest, "dist/loader.js");
  ensureFile(loaderPath);
  fs.writeFileSync(
    loaderPath,
    `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const fs = require("fs");

const candidates = [
  "/data/storage/el1/bundle/libs/arm64/node-nim.node",
  "/data/storage/el1/bundle/libs/arm64-v8a/node-nim.node",
];

const errors = [];
for (const addonPath of candidates) {
  try {
    exports.default = require(addonPath);
    exports.addonPath = addonPath;
    return;
  } catch (error) {
    errors.push({
      addonPath,
      exists: fs.existsSync(addonPath),
      code: error && error.code,
      message: error && error.message,
      stack: error && error.stack,
    });
  }
}

throw new Error(\`[node-nim][ohos] failed to load node-nim.node: \${JSON.stringify(errors, null, 2)}\`);
`,
  );

  const loaderTypesPath = path.join(nodeNimDest, "dist/loader.d.ts");
  if (fs.existsSync(loaderTypesPath)) {
    fs.writeFileSync(
      loaderTypesPath,
      `declare const sdk: any;
export declare const addonPath: string;
export default sdk;
`,
    );
  }
}

function syncNodeNimPackage() {
  const nodeNimRoot = packagePath(repoRoot, "node-nim");
  ensureExists(path.join(nodeNimRoot, "dist"));
  ensureExists(path.join(nodeNimRoot, "package.json"));

  const nodeModulesDir = path.join(appStagingDir, "node_modules");
  const nodeNimDest = path.join(nodeModulesDir, "node-nim");
  fs.mkdirSync(nodeModulesDir, { recursive: true });

  copyDir(path.join(nodeNimRoot, "dist"), path.join(nodeNimDest, "dist"));
  copyOptionalDir(path.join(nodeNimRoot, "types"), path.join(nodeNimDest, "types"));
  copyOptionalDir(path.join(nodeNimRoot, "ts"), path.join(nodeNimDest, "ts"));
  copyFile(path.join(nodeNimRoot, "package.json"), path.join(nodeNimDest, "package.json"));

  const dependencies = collectProductionDependencies(nodeNimRoot);
  for (const [packageName, depSrc] of dependencies) {
    copyDir(depSrc, path.join(nodeModulesDir, ...packageName.split("/")));
    copiedNodeNimDependencies.push(packageName);
  }

  patchNodeNimLoader(nodeNimDest);
  copiedNodeNimDependencies.sort();
  log("node-nim production dependencies synced", copiedNodeNimDependencies);
}

function syncNativeLibraries() {
  ensureFile(path.join(nodeNimNativeLibDir, "node-nim.node"));
  const harBridge = path.join(nodeNimNativeLibDir, "libnode-nim.so");
  if (fs.existsSync(harBridge)) {
    throw new Error(`Unexpected HAR bridge in node-nim native output: ${harBridge}`);
  }
  fs.mkdirSync(nativeLibDir, { recursive: true });
  for (const name of fs.readdirSync(nativeLibDir)) {
    if (
      name === "node-nim.node" ||
      name === "libh_available.so" ||
      name === "libnode-nim.so" ||
      /^libnim.*\.so$/.test(name)
    ) {
      fs.rmSync(path.join(nativeLibDir, name), { force: true });
    }
  }

  copyFile(path.join(nodeNimNativeLibDir, "node-nim.node"), path.join(nativeLibDir, "node-nim.node"));
  copiedNativeLibraries.push("node-nim.node");
  for (const name of fs.readdirSync(nodeNimNativeLibDir)) {
    if (name.endsWith(".so") && name !== "libnode-nim.so") {
      copyFile(path.join(nodeNimNativeLibDir, name), path.join(nativeLibDir, name));
      copiedNativeLibraries.push(name);
    }
  }
  copiedNativeLibraries.sort();
  log("native libraries synced", copiedNativeLibraries);
}

async function createAppAsar() {
  log("create app.asar from staged app resources", {
    source: appStagingDir,
    target: appAsarPath,
  });
  await createPackage(appStagingDir, appAsarPath);
  remove(appStagingDir);
}

async function buildHap() {
  if (!shouldBuildHap()) {
    log("skip HAP build");
    return null;
  }

  const hvigor = findExecutable("HVIGORW", [
    path.join(ohosProjectRoot, "hvigorw"),
    path.join(devecoStudioHome, "Contents/tools/hvigor/bin/hvigorw"),
    "hvigorw",
  ]);
  ensureToolExecutable(hvigor, "Hvigor wrapper", "HVIGORW");

  const outputDir = path.join(moduleRoot, "build/default/outputs/default");
  const signedHap = path.join(outputDir, `${moduleName}-default-signed.hap`);
  const unsignedHap = path.join(outputDir, `${moduleName}-default-unsigned.hap`);

  remove(signedHap);
  remove(unsignedHap);

  log("build OHOS HAP");
  await run(
    hvigor,
    ["assembleHap", "--mode", "module", "-p", `module=${moduleName}`, "--no-daemon"],
    { cwd: ohosProjectRoot },
  );

  if (fs.existsSync(signedHap)) {
    return { hapPath: signedHap, signed: true };
  }

  const newestSignedHap = findNewestFile(outputDir, (filePath) => {
    const name = path.basename(filePath);
    return name.endsWith("-signed.hap") && !name.endsWith("-unsigned.hap");
  });
  if (newestSignedHap) {
    return { hapPath: newestSignedHap, signed: true };
  }

  const newestUnsignedHap =
    (fs.existsSync(unsignedHap) && unsignedHap) ||
    findNewestFile(outputDir, (filePath) => path.basename(filePath).endsWith("-unsigned.hap"));
  if (newestUnsignedHap) {
    if (currentSigningConfig) {
      const fallbackSignedHap = path.join(outputDir, `${moduleName}-default-signed-fallback.hap`);
      signUnsignedHap(newestUnsignedHap, fallbackSignedHap, currentSigningConfig);
      return { hapPath: fallbackSignedHap, signed: true };
    }
    return { hapPath: newestUnsignedHap, signed: false };
  }

  const newestHap = findNewestFile(outputDir, (filePath) => filePath.endsWith(".hap"));
  if (newestHap) {
    return { hapPath: newestHap, signed: !path.basename(newestHap).includes("unsigned") };
  }

  throw new Error(`No HAP output found under ${outputDir}`);
}

function signUnsignedHap(unsignedHap, signedHap, signing) {
  const signTool = resolveOptionalPath(
    process.env.OHAP_HAP_SIGN_TOOL || path.join(ohosBaseSdkHome, "toolchains/lib/hap-sign-tool.jar"),
  );
  ensureFile(signTool);
  fs.mkdirSync(path.dirname(signedHap), { recursive: true });
  remove(signedHap);

  const args = [
    "-jar",
    signTool,
    "sign-app",
    "-mode",
    "localSign",
    "-keyAlias",
    signing.keyAlias,
    "-keyPwd",
    signing.keyPassword,
    "-appCertFile",
    signing.certPath,
    "-profileFile",
    signing.profile,
    "-profileSigned",
    "1",
    "-inFile",
    unsignedHap,
    "-signAlg",
    signing.signAlg,
    "-keystoreFile",
    signing.storeFile,
    "-keystorePwd",
    signing.storePassword,
    "-outFile",
    signedHap,
    "-compatibleVersion",
    process.env.OHAP_COMPATIBLE_VERSION || "20",
    "-signCode",
    "1",
  ];

  log("sign unsigned HAP with hap-sign-tool", {
    source: signing.source,
    unsignedHap,
    signedHap,
    signTool,
    keyAlias: signing.keyAlias,
    signAlg: signing.signAlg,
  });
  runSync("java", args, {
    cwd: ohosProjectRoot,
    redactedArgs: redactArgs(args),
  });
}

function copyFinalArtifact(hapResult) {
  if (!hapResult) {
    return null;
  }
  fs.mkdirSync(path.dirname(buildConfig.finalHapPath), { recursive: true });
  fs.copyFileSync(hapResult.hapPath, buildConfig.finalHapPath);
  log("HAP artifact written", {
    source: hapResult.hapPath,
    target: buildConfig.finalHapPath,
    signed: hapResult.signed,
  });
  return buildConfig.finalHapPath;
}

function verifySyncedResources() {
  const requiredFiles = [
    appAsarPath,
    ...copiedNativeLibraries.map((name) => path.join(nativeLibDir, name)),
  ];
  const unexpectedFiles = [appDir, appStagingDir];
  const present = [];
  const missing = [];
  const unexpected = [];

  if (!copiedNativeLibraries.includes("node-nim.node")) {
    missing.push(path.join(nativeLibDir, "node-nim.node"));
  }

  for (const filePath of requiredFiles) {
    if (fs.existsSync(filePath)) {
      present.push(filePath);
    } else {
      missing.push(filePath);
    }
  }
  for (const filePath of unexpectedFiles) {
    if (fs.existsSync(filePath)) {
      unexpected.push(filePath);
    }
  }

  return {
    ok: missing.length === 0 && unexpected.length === 0,
    present,
    missing,
    unexpected,
  };
}

async function installAndLaunch(hapPath, resourceIntegrity) {
  const verification = {
    installed: false,
    launched: false,
    pid: "",
    processAlive: false,
    resourceIntegrityOk: resourceIntegrity.ok,
    resourceIntegrity,
    hasCrashSignal: false,
    hilogTimedOut: false,
  };

  if (!hapPath || process.env.OHOS_INSTALL !== "1") {
    return verification;
  }

  if (hapPath.includes("unsigned") && process.env.OHOS_ALLOW_UNSIGNED_INSTALL !== "1") {
    throw new Error(
      "Refusing to install unsigned HAP. Set OHOS_ALLOW_UNSIGNED_INSTALL=1 to try anyway.",
    );
  }

  const bundleName = process.env.OHOS_BUNDLE_NAME || buildConfig.bundleName;
  ensureToolExecutable(hdc, "HDC", "HDC");
  log("install and launch HAP", { hapPath, bundleName });
  await run(hdc, ["install", "-r", hapPath]);
  verification.installed = true;

  await run(hdc, ["hilog", "-r"], {
    quiet: true,
    allowFailure: true,
    timeoutMs: 3000,
  });
  await run(hdc, ["shell", "aa", "force-stop", bundleName], { allowFailure: true });
  await run(hdc, [
    "shell",
    "aa",
    "start",
    "-a",
    abilityName,
    "-b",
    bundleName,
    "-m",
    moduleName,
    "--ps",
    "instanceKey",
    "browser1",
    "--ps",
    "xcomponentId",
    "browser1",
  ]);
  verification.launched = true;

  await sleep(launchWaitMs);

  const pidResult = await run(hdc, ["shell", "pidof", bundleName], {
    quiet: true,
    allowFailure: true,
  });
  verification.pid = pidResult.stdout.trim();
  verification.processAlive = verification.pid.length > 0;

  const hilogResult = await collectHilog(bundleName);
  verification.hilogTimedOut = hilogResult.timedOut;
  Object.assign(verification, analyzeHilog(hilogResult.content));

  if (!verification.processAlive) {
    throw new Error("Application process is not alive after launch.");
  }

  if (verification.hasCrashSignal && process.env.OHOS_ALLOW_CRASH_SIGNAL !== "1") {
    throw new Error("Crash signal found after launch.");
  }

  return verification;
}

async function collectHilog(bundleName) {
  const pattern = [
    bundleName,
    "Electron",
    "Global Error",
    "Unhandled Rejection",
    "Uncaught",
    "Error",
    "SIGSEGV",
    "Fault",
    "crash",
    "cppcrash",
  ].join("|");
  const result = await run(hdc, ["hilog", "-x", "-e", pattern, "-v", "time"], {
    quiet: true,
    allowFailure: true,
    timeoutMs: hilogTimeoutMs,
  });
  return {
    content: `${result.stdout || ""}${result.stderr || ""}`,
    timedOut: result.timedOut,
  };
}

function analyzeHilog(content) {
  return {
    hasCrashSignal: /SIGSEGV|cppcrash|Reason:Signal|Fatal signal|Process name:/.test(content),
  };
}

async function main() {
  try {
    buildConfig = loadBuildConfig();
    log("OHOS build config", {
      templateUrl: electronTemplateUrl,
      nodeNimNativeDir: nodeNimNativeReleaseDir(),
      releaseRoot,
      ohosProjectRoot,
      appId: buildConfig.rawAppId,
      ohosAppId: buildConfig.ohosAppId,
      bundleName: buildConfig.bundleName,
      outputDir: buildConfig.outputDir,
      artifactName: buildConfig.artifactName,
      signingSource: buildConfig.signing ? buildConfig.signing.source : "environment-or-unsigned",
    });

    ensureFile(buildConfig.icon);
    ensureFile(buildConfig.productLogo);
    ensureFile(buildConfig.startIcon);

    await buildWebAssets();
    await prepareDownloadedInputs();
    prepareOhosProject();
    injectProjectMetadata();
    removeUnsupportedRequestPermissions();
    await installOhosDependencies();

    log("sync app resources into temporary OHOS project");
    syncAppResources();

    log("sync node-nim package");
    syncNodeNimPackage();

    log("sync native libraries");
    syncNativeLibraries();

    await createAppAsar();
    const resourceIntegrity = verifySyncedResources();
    if (!resourceIntegrity.ok) {
      throw new Error(
        `OHOS resources are invalid: ${JSON.stringify({
          missing: resourceIntegrity.missing,
          unexpected: resourceIntegrity.unexpected,
        })}`,
      );
    }

    const hapResult = await buildHap();
    const finalHapPath = copyFinalArtifact(hapResult);
    const verification = await installAndLaunch(finalHapPath, resourceIntegrity);

    log("done", { hapPath: finalHapPath, verification });
  } finally {
    cleanupSigningMaterials();
  }
}

main().catch((error) => {
  console.error(`\n[ohos-build] FAILED: ${error.message}`);
  if (error.result) {
    console.error(JSON.stringify(error.result, null, 2));
  }
  process.exitCode = 1;
});
