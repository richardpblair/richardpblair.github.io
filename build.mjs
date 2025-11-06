import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

async function ensureCleanDist() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
}

function stripComments(code, { allowLine = true } = {}) {
  let result = '';
  let inString = false;
  let stringQuote = '';
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const next = code[i + 1];

    if (inString) {
      result += char;
      if (char === '\\') {
        result += next ?? '';
        i += 1;
      } else if (char === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += '\n';
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '\n') {
        result += '\n';
      }
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      stringQuote = char;
      result += char;
      continue;
    }

    if (char === '/' && next === '*' ) {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (allowLine && char === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }

    result += char;
  }

  return result;
}

function prepareLines(source) {
  const lines = source.split(/\r?\n/);
  const processed = [];
  const mapping = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return;
    }
    processed.push(trimmed);
    mapping.push(index);
  });

  return { lines: processed, mapping };
}

const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toVLQ(value) {
  let vlq = value < 0 ? ((-value) << 1) + 1 : (value << 1);
  let encoded = '';
  do {
    let digit = vlq & 31;
    vlq >>>= 5;
    if (vlq > 0) {
      digit |= 32;
    }
    encoded += base64Chars[digit];
  } while (vlq > 0);
  return encoded;
}

function createSourceMap({ file, sourcePath, sourcesContent, mapping }) {
  if (mapping.length === 0) {
    return {
      version: 3,
      file,
      sources: [sourcePath],
      sourcesContent: [sourcesContent],
      names: [],
      mappings: ''
    };
  }

  let previousSourceLine = 0;
  const segments = [];

  mapping.forEach((originalLine, index) => {
    const lineDelta = index === 0 ? originalLine : originalLine - previousSourceLine;
    const segment = 'AA' + toVLQ(lineDelta) + 'A';
    segments.push(segment);
    previousSourceLine = originalLine;
  });

  const mappings = segments.join(';');

  return {
    version: 3,
    file,
    sources: [sourcePath],
    sourcesContent: [sourcesContent],
    names: [],
    mappings
  };
}

async function writeAsset({ name, ext, allowLineComments }) {
  const sourcePath = path.join(rootDir, name);
  const raw = await fs.readFile(sourcePath, 'utf8');
  const withoutComments = stripComments(raw, { allowLine: allowLineComments });
  const { lines, mapping } = prepareLines(withoutComments);
  const minifiedBody = lines.join('\n');
  const hash = crypto.createHash('sha256').update(minifiedBody).digest('hex').slice(0, 8);
  const fileName = `${path.basename(name, path.extname(name))}-${hash}.${ext}`;
  const mapName = `${fileName}.map`;
  const map = createSourceMap({
    file: fileName,
    sourcePath: name.replace(/\\/g, '/'),
    sourcesContent: raw,
    mapping
  });

  let finalBody = minifiedBody;
  if (ext === 'js') {
    finalBody += `\n//# sourceMappingURL=${mapName}\n`;
  } else if (ext === 'css') {
    finalBody += `\n/*# sourceMappingURL=${mapName} */\n`;
  }

  await fs.writeFile(path.join(distDir, fileName), finalBody, 'utf8');
  await fs.writeFile(path.join(distDir, mapName), `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  return {
    fileName,
    mapName,
    relative: `dist/${fileName}`,
    mapRelative: `dist/${mapName}`
  };
}

async function build() {
  await ensureCleanDist();

  const manifest = {};

  const assets = [
    { name: 'assets/css/main.css', ext: 'css', allowLineComments: false },
    { name: 'assets/js/main.js', ext: 'js', allowLineComments: true },
    { name: 'assets/js/bg-net.js', ext: 'js', allowLineComments: true }
  ];

  for (const asset of assets) {
    const result = await writeAsset(asset);
    manifest[asset.name.replace(/\\/g, '/')] = {
      file: result.relative,
      map: result.mapRelative
    };
  }

  await fs.writeFile(path.join(distDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('Build complete. Generated files:');
  Object.values(manifest).forEach((entry) => {
    console.log(` - ${entry.file}`);
  });
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
