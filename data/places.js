import fs from 'node:fs';
import path from 'node:path';

const placesDirectory = path.join(process.cwd(), 'data', 'places');
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const publicAsset = (assetPath) => `${basePath}${assetPath}`;

function readMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return readMarkdownFiles(entryPath);
    if (entry.isFile() && entry.name.endsWith('.md')) return [entryPath];

    return [];
  });
}

function parseValue(value) {
  const normalizedValue = value.trim();

  if (normalizedValue.startsWith('[') && normalizedValue.endsWith(']')) {
    return normalizedValue
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .map((item) => {
        const numberValue = Number(item);
        return Number.isNaN(numberValue) ? item.replace(/^['"]|['"]$/g, '') : numberValue;
      });
  }

  const numberValue = Number(normalizedValue);
  if (!Number.isNaN(numberValue) && normalizedValue !== '') return numberValue;

  return normalizedValue.replace(/^['"]|['"]$/g, '');
}

function parseFrontmatter(markdown, filePath) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    throw new Error(`Missing frontmatter in ${filePath}`);
  }

  const [, frontmatter, content] = match;
  const data = {};

  frontmatter.split('\n').forEach((line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    data[key] = parseValue(value);
  });

  return {
    data,
    content: content.trim()
  };
}

function modelUrl(modelPath) {
  if (modelPath.startsWith('/models/')) return publicAsset(modelPath);
  if (modelPath.startsWith('models/')) return publicAsset(`/${modelPath}`);
  return publicAsset(`/models/${modelPath}`);
}

function markdownToFeature(filePath) {
  const markdown = fs.readFileSync(filePath, 'utf8');
  const { data, content } = parseFrontmatter(markdown, filePath);

  return {
    order: data.order ?? Number.MAX_SAFE_INTEGER,
    feature: {
      type: 'Feature',
      properties: {
        id: data.id,
        name: data.name,
        description: data.description ?? content,
        modelUrl: modelUrl(data.model),
        category: data.category
      },
      geometry: {
        type: 'Point',
        coordinates: data.coordinates
      }
    }
  };
}

export function getPlacesGeojson() {
  const features = readMarkdownFiles(placesDirectory)
    .map(markdownToFeature)
    .sort((firstPlace, secondPlace) => {
      if (firstPlace.order !== secondPlace.order) return firstPlace.order - secondPlace.order;
      return firstPlace.feature.properties.id.localeCompare(secondPlace.feature.properties.id);
    })
    .map(({ feature }) => feature);

  return {
    type: 'FeatureCollection',
    features
  };
}
