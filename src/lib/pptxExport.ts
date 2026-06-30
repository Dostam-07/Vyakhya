import pptxgen from "pptxgenjs";
import { Scene } from "../types";

/**
 * Interface representing a structured JSON format compatible with a presentation.
 * This can be used to pass config to other tools or to PPTXGenJS directly.
 */
export interface PPTXSlideJSON {
  title: string;
  notes?: string;
  background?: string;
  textColor?: string;
  accentColor?: string;
  elements: Array<{
    type: "text" | "image" | "shape";
    text?: string;
    bullets?: string[];
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    align?: "left" | "center" | "right";
    fill?: string;
  }>;
}

/**
 * Maps a list of Scene objects into a JSON structure compatible with PPTXGenJS.
 */
export function mapScenesToPPTXJSON(scenes: Scene[], presentationTitle: string): PPTXSlideJSON[] {
  return scenes.map((scene, index) => {
    const bgColor = scene.bg_color ? scene.bg_color.replace("#", "") : "0A0A16";
    const accentColor = scene.accent_color ? scene.accent_color.replace("#", "") : "6366F1";
    const defaultTextColor = "FFFFFF";

    const slideData: PPTXSlideJSON = {
      title: scene.headline,
      notes: scene.narration,
      background: bgColor,
      textColor: defaultTextColor,
      accentColor: accentColor,
      elements: []
    };

    // 1. Add Slide Number & Header branding
    slideData.elements.push({
      type: "text",
      text: `${presentationTitle.toUpperCase()} — Slide ${index + 1}`,
      x: 0.5,
      y: 0.2,
      w: 8.0,
      h: 0.4,
      fontSize: 10,
      color: "888888",
      align: "left"
    });

    // 2. Add Headline Text
    slideData.elements.push({
      type: "text",
      text: scene.headline,
      x: 0.5,
      y: 0.6,
      w: 9.0,
      h: 0.8,
      fontSize: 22,
      bold: true,
      color: accentColor,
      align: "left"
    });

    // 3. Customize slide layouts depending on SceneType
    switch (scene.type) {
      case "title_card":
        // Centered large title layout
        slideData.elements.push({
          type: "text",
          text: scene.narration,
          x: 1.0,
          y: 2.0,
          w: 8.0,
          h: 2.5,
          fontSize: 16,
          align: "center",
          color: defaultTextColor
        });
        break;

      case "concept_split":
        // Left column
        slideData.elements.push({
          type: "text",
          text: scene.left_label || "Concept A",
          x: 0.5,
          y: 1.6,
          w: 4.2,
          h: 0.5,
          fontSize: 14,
          bold: true,
          color: accentColor
        });
        slideData.elements.push({
          type: "text",
          text: scene.narration.split(".")[0] || scene.narration,
          x: 0.5,
          y: 2.2,
          w: 4.2,
          h: 2.5,
          fontSize: 12,
          color: defaultTextColor
        });

        // Right column
        slideData.elements.push({
          type: "text",
          text: scene.right_label || "Concept B",
          x: 5.3,
          y: 1.6,
          w: 4.2,
          h: 0.5,
          fontSize: 14,
          bold: true,
          color: accentColor
        });
        slideData.elements.push({
          type: "text",
          text: scene.narration.split(".").slice(1).join(".") || scene.visual_instruction,
          x: 5.3,
          y: 2.2,
          w: 4.2,
          h: 2.5,
          fontSize: 12,
          color: "CCCCCC"
        });
        break;

      case "bullet_reveal":
      case "summary_card":
        // Render listed bullet items
        if (scene.bullets && scene.bullets.length > 0) {
          slideData.elements.push({
            type: "text",
            bullets: scene.bullets,
            x: 0.5,
            y: 1.8,
            w: 5.0,
            h: 3.5,
            fontSize: 13,
            color: defaultTextColor
          });
        } else {
          slideData.elements.push({
            type: "text",
            text: scene.narration,
            x: 0.5,
            y: 1.8,
            w: 5.0,
            h: 3.5,
            fontSize: 13,
            color: defaultTextColor
          });
        }

        // Sidebar representation representing visual context
        slideData.elements.push({
          type: "text",
          text: `Visual Target:\n${scene.visual_instruction || scene.image_description || "Dynamic Explainer Image"}`,
          x: 6.0,
          y: 1.8,
          w: 3.5,
          h: 3.2,
          fontSize: 10,
          italic: true,
          color: "888888",
          fill: "11111E"
        });
        break;

      case "analogy_card":
        slideData.elements.push({
          type: "text",
          text: `Analogy Metaphor:`,
          x: 0.5,
          y: 1.6,
          w: 9.0,
          h: 0.4,
          fontSize: 12,
          bold: true,
          color: accentColor
        });
        slideData.elements.push({
          type: "text",
          text: scene.analogy_text || scene.narration,
          x: 0.5,
          y: 2.1,
          w: 9.0,
          h: 2.5,
          fontSize: 15,
          italic: true,
          align: "center",
          color: defaultTextColor,
          fill: "1C1936"
        });
        break;

      case "data_stat":
        // Enormous statistic value
        slideData.elements.push({
          type: "text",
          text: scene.stat_value || "100%",
          x: 0.5,
          y: 1.8,
          w: 4.5,
          h: 1.5,
          fontSize: 60,
          bold: true,
          color: accentColor,
          align: "center"
        });
        slideData.elements.push({
          type: "text",
          text: scene.stat_label || "Important Data Point",
          x: 0.5,
          y: 3.4,
          w: 4.5,
          h: 1.0,
          fontSize: 14,
          bold: true,
          color: defaultTextColor,
          align: "center"
        });

        // Explanation text on the right side
        slideData.elements.push({
          type: "text",
          text: scene.narration,
          x: 5.3,
          y: 1.8,
          w: 4.2,
          h: 3.0,
          fontSize: 12,
          color: "DDDDDD"
        });
        break;

      case "timeline":
        // Process line items
        if (scene.steps && scene.steps.length > 0) {
          slideData.elements.push({
            type: "text",
            bullets: scene.steps.map((st, i) => `${i + 1}. ${st}`),
            x: 0.5,
            y: 1.8,
            w: 8.5,
            h: 3.5,
            fontSize: 13,
            color: defaultTextColor
          });
        } else {
          slideData.elements.push({
            type: "text",
            text: scene.narration,
            x: 0.5,
            y: 1.8,
            w: 8.5,
            h: 3.5,
            fontSize: 13,
            color: defaultTextColor
          });
        }
        break;

      case "quote_card":
        slideData.elements.push({
          type: "text",
          text: `“ ${scene.quote_text || scene.narration} ”`,
          x: 1.0,
          y: 1.8,
          w: 8.0,
          h: 2.0,
          fontSize: 18,
          italic: true,
          color: defaultTextColor,
          align: "center"
        });
        if (scene.quote_attribution) {
          slideData.elements.push({
            type: "text",
            text: `— ${scene.quote_attribution}`,
            x: 1.0,
            y: 4.0,
            w: 8.0,
            h: 0.5,
            fontSize: 12,
            bold: true,
            color: accentColor,
            align: "center"
          });
        }
        break;

      default:
        // Default text presentation
        slideData.elements.push({
          type: "text",
          text: scene.narration,
          x: 0.5,
          y: 1.8,
          w: 5.0,
          h: 3.5,
          fontSize: 13,
          color: defaultTextColor
        });
        slideData.elements.push({
          type: "text",
          text: `Visual Hint: ${scene.visual_instruction}`,
          x: 6.0,
          y: 1.8,
          w: 3.5,
          h: 3.5,
          fontSize: 11,
          color: "888888",
          italic: true,
          fill: "1F1F24"
        });
    }

    return slideData;
  });
}

/**
 * Compiles mapped scene data and triggers native client-side PPTX generation & download.
 */
export function exportReviewedScenesToPPTX(scenes: Scene[], presentationTitle: string) {
  const pptx = new pptxgen();
  
  // Set global presentation layout settings (16:9 widescreen by default)
  pptx.layout = "LAYOUT_16x9";
  
  const slideConfigs = mapScenesToPPTXJSON(scenes, presentationTitle);

  slideConfigs.forEach((config) => {
    const slide = pptx.addSlide();
    
    // 1. Fill background color
    if (config.background) {
      slide.background = { fill: config.background };
    }

    // 2. Add speaker notes (narration script)
    if (config.notes) {
      slide.addNotes(config.notes);
    }

    // 3. Render all registered JSON element layers onto the slide
    config.elements.forEach((el) => {
      if (el.type === "text") {
        if (el.bullets && el.bullets.length > 0) {
          // PPTXGenJS formats bullet points using array lists
          const bulletProps = el.bullets.map((b) => ({
            text: b,
            options: { bullet: true, fontSize: el.fontSize || 13, color: el.color || "FFFFFF" }
          }));
          slide.addText(bulletProps, {
            x: el.x,
            y: el.y,
            w: el.w,
            h: el.h,
            fontFace: "Arial",
          });
        } else {
          // Normal single text block
          const textOptions: pptxgen.TextPropsOptions = {
            x: el.x,
            y: el.y,
            w: el.w,
            h: el.h,
            fontSize: el.fontSize || 12,
            bold: el.bold || false,
            italic: el.italic || false,
            color: el.color || "FFFFFF",
            fontFace: "Arial",
            align: el.align || "left",
          };

          if (el.fill) {
            textOptions.fill = { color: el.fill };
          }

          slide.addText(el.text || "", textOptions);
        }
      }
    });
  });

  const safeFileName = `${presentationTitle.trim().replace(/[^a-zA-Z0-9]/g, "_")}_Presentation.pptx`;
  pptx.writeFile({ fileName: safeFileName });
}
