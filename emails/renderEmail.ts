import { render } from "@react-email/render";
import * as React from "react";
import { templates } from "./index";
import type { TemplatePropsBySlug, TemplateSlug } from "./templateDataMap";

export async function renderEmail<TSlug extends TemplateSlug>(
  slug: TSlug,
  props: TemplatePropsBySlug[TSlug]
) {
  const Component = templates[slug];
  const html = await render(React.createElement(Component, props));
  return html;
}
