import fs from "node:fs";
import path from "node:path";

const specs = [
  { stem: "harding-paper-suite", output: "public/images/harding-paper-suite.webp", expectedBytes: 262384 },
  { stem: "paper-suite-card-sprite", output: "public/images/paper-suite-card-sprite.webp", expectedBytes: 270076 },
];

for (const spec of specs) {
  const dir = path.join(process.cwd(), "assets", "paper-suite-base64");
  const files = fs.readdirSync(dir)
    .filter((name) => name.startsWith(spec.stem + ".") && name.endsWith(".b64"))
    .sort();

  if (!files.length) throw new Error("No chunks found for " + spec.stem);

  const base64 = files
    .map((name) => fs.readFileSync(path.join(dir, name), "utf8").trim())
    .join("");

  const bytes = Buffer.from(base64, "base64");
  if (bytes.length !== spec.expectedBytes) {
    throw new Error(spec.stem + ": expected " + spec.expectedBytes + " bytes, got " + bytes.length);
  }
  if (bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
      bytes.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error(spec.stem + ": decoded asset is not a valid WebP");
  }

  const out = path.join(process.cwd(), spec.output);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bytes);
  console.log("Wrote " + spec.output + " (" + bytes.length + " bytes)");
}
