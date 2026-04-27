import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderEmail } from "../renderEmail";
import { templateSubjects } from "../index";
import { templateDataMap, type TemplateSlug } from "../templateDataMap";

async function generateAllTemplates() {
  const outputDir = path.resolve(process.cwd(), "preview-templates");
  await mkdir(outputDir, { recursive: true });

  const slugs = Object.keys(templateDataMap) as TemplateSlug[];
  const manifest: Array<{ slug: TemplateSlug; file: string; subject: string }> = [];

  for (const slug of slugs) {
    const html = await renderEmail(slug, templateDataMap[slug].defaultData);
    const fileName = `${slug}.html`;
    const filePath = path.join(outputDir, fileName);
    await writeFile(filePath, html, "utf8");
    manifest.push({ slug, file: fileName, subject: templateSubjects[slug] });
  }

  await writeFile(
    path.join(outputDir, "index.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log(`Generated ${manifest.length} email templates in ${outputDir}`);
}

generateAllTemplates().catch((error: unknown) => {
  console.error("Failed to generate email templates:", error);
  process.exit(1);
});
