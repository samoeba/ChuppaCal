export const RECIPE_HTML_MAX_BYTES = 524288;
export const MEAL_RECIPE_FIELDS = "id,name,emoji,recipe_url,ingredients,instructions,instructions_html_name";
export const MEAL_PLAN_FIELDS = "id,family_id,date,slot,name,emoji,recipe_url,ingredients,instructions,instructions_html_name,created_at";

// The iframe has an opaque origin. Only inline presentation and embedded assets load.
export const RECIPE_HTML_CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'";

export async function recipeHtmlUpload(attachment?: FormData) {
  if (!attachment) return {};
  const file = attachment.get("html");
  if (file instanceof File) {
    if (!/\.html?$/i.test(file.name) || file.size === 0 || file.size > RECIPE_HTML_MAX_BYTES) {
      throw new Error("Choose an HTML file up to 512 KB");
    }
    const bytes = await file.arrayBuffer();
    let html: string;
    try {
      html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("Save your HTML file with UTF-8 encoding");
    }
    if (!html.trim() || !/<[a-z][\s\S]*>/i.test(html)) throw new Error("The HTML file is empty or has no HTML content");
    return { instructions_html: html, instructions_html_name: file.name.slice(0, 200) };
  }
  if (attachment.get("removeHtml") === "true") {
    return { instructions_html: null, instructions_html_name: null };
  }
  return {};
}
