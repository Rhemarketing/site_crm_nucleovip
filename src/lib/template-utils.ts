import type { MetaTemplateComponent } from "@/services/meta-whatsapp.service";

type ComponentShape = {
  type?: string;
  text?: string;
  format?: string;
  buttons?: Array<{ type?: string; text?: string; url?: string; phone_number?: string }>;
};

export function getTemplateVariables(components: unknown) {
  const variables = new Set<string>();
  for (const component of Array.isArray(components) ? (components as ComponentShape[]) : []) {
    for (const match of component.text?.matchAll(/\{\{(\d+)\}\}/g) ?? []) variables.add(match[1]);
  }
  return [...variables].sort((a, b) => Number(a) - Number(b));
}

export function renderTemplateText(components: unknown, variables: Record<string, string>) {
  const body = (Array.isArray(components) ? (components as ComponentShape[]) : []).find(
    (component) => component.type?.toUpperCase() === "BODY",
  );
  return (body?.text ?? "Template enviado").replace(/\{\{(\d+)\}\}/g, (_, index: string) => variables[index] ?? `{{${index}}}`);
}

export function buildTemplateSendComponents(
  components: unknown,
  variables: Record<string, string>,
): MetaTemplateComponent[] {
  const shapes = Array.isArray(components) ? (components as ComponentShape[]) : [];
  const result: MetaTemplateComponent[] = [];

  for (const component of shapes) {
    const type = component.type?.toUpperCase();
    const matches = [...(component.text?.matchAll(/\{\{(\d+)\}\}/g) ?? [])];
    if ((type === "BODY" || type === "HEADER") && matches.length) {
      result.push({
        type: type.toLowerCase(),
        parameters: matches.map((match) => ({ type: "text", text: variables[match[1]] ?? "" })),
      });
    }
  }

  return result;
}

export function prepareTemplateComponents(components: MetaTemplateComponent[]) {
  return components.map((component) => {
    const shape = component as ComponentShape;
    const variables = [...(shape.text?.matchAll(/\{\{(\d+)\}\}/g) ?? [])];
    if (!variables.length) return component;
    const examples = variables.map((match) => `Exemplo ${match[1]}`);
    return {
      ...component,
      example:
        shape.type?.toUpperCase() === "HEADER"
          ? { header_text: examples }
          : { body_text: [examples] },
    };
  });
}
