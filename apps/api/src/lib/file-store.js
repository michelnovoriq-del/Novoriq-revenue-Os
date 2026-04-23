import fs from "fs/promises";
import path from "path";

export async function ensureJsonFile(filePath, fallbackValue) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallbackValue, null, 2));
  }
}

export async function readJsonFile(filePath, fallbackValue) {
  await ensureJsonFile(filePath, fallbackValue);
  const content = await fs.readFile(filePath, "utf8");

  try {
    return JSON.parse(content);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallbackValue, null, 2));
    return fallbackValue;
  }
}

export async function writeJsonFile(filePath, data) {
  await ensureJsonFile(filePath, data);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}
