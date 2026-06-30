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
  fontHeading: string;
  fontBody: string;
  elements: Array<{
    type: "text" | "image" | "shape" | "chart";
    text?: string;
    bullets?: string[];
    bulletIcon?: string;
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
    path?: string;
    data?: string;
    fontFace?: string;
    borderDash?: boolean;
    valign?: "top" | "middle" | "bottom";
    chartData?: any[];
  }>;
}

export interface SlideContentProfile {
  textDensity: "minimal" | "moderate" | "dense";
  hasNumericData: boolean;
  hasComparison: boolean;
  hasSequence: boolean;
  narrativePosition: "open" | "build" | "climax" | "close";
  visualComplexity: "icon" | "diagram" | "illustration";
}

export interface DeckTheme {
  id: string;
  name: string;
  headlineFont: string;
  bodyFont: string;
  scriptFontMap: Record<string, string>;
  palette: {
    surface: string;
    surfaceAlt: string;
    ink: string;
    inkMuted: string;
    accentPrimary: string;
    accentSecondary: string;
  };
  geometry: {
    marginInset: number;
    headlineScale: number;
    cornerStyle: "sharp" | "rounded";
    dividerStyle: "none" | "thin-rule" | "dot-pattern";
  };
  decorativeMotif?: "none" | "corner-accent-shape" | "background-grid" | "background-grain";
}

export interface PPTXTheme {
  name: string;
  fontHeading: string;
  fontBody: string;
  bgColor: string;     // background hex
  textColor: string;   // body text hex
  accentColor: string; // accent hex
  bulletIcon: string;  // e.g. "■", "◆", "•", "»", "✔"
  cardFill: string;    // background color of sidebars and quote cards
  useShapes: boolean;
}

export const PPTX_THEMES: Record<string, PPTXTheme> = {
  modern_minimal: {
    name: "Modern Minimal",
    fontHeading: "Arial",
    fontBody: "Arial",
    bgColor: "F8F9FA",
    textColor: "212529",
    accentColor: "4F46E5",
    bulletIcon: "■",
    cardFill: "E9ECEF",
    useShapes: true
  },
  bold_gradient: {
    name: "Bold Tech / Gradient",
    fontHeading: "Century Gothic",
    fontBody: "Trebuchet MS",
    bgColor: "0B0F19",
    textColor: "F3F4F6",
    accentColor: "EC4899",
    bulletIcon: "◆",
    cardFill: "1F2937",
    useShapes: true
  },
  academic_serif: {
    name: "Academic Serif",
    fontHeading: "Georgia",
    fontBody: "Georgia",
    bgColor: "FAF6F0",
    textColor: "2D241E",
    accentColor: "8B4513",
    bulletIcon: "•",
    cardFill: "EFEAE4",
    useShapes: false
  },
  dark_tech: {
    name: "Dark Tech",
    fontHeading: "Courier New",
    fontBody: "Courier New",
    bgColor: "0E1726",
    textColor: "00FF66",
    accentColor: "00BCFF",
    bulletIcon: "»",
    cardFill: "1B263B",
    useShapes: true
  },
  pastel_sketch: {
    name: "Pastel Sketch",
    fontHeading: "Comic Sans MS",
    fontBody: "Calibri",
    bgColor: "FFFDF5",
    textColor: "333333",
    accentColor: "FF6B6B",
    bulletIcon: "★",
    cardFill: "FFF5F5",
    useShapes: true
  },
  corporate_brief: {
    name: "Corporate Brief",
    fontHeading: "Calibri",
    fontBody: "Calibri",
    bgColor: "FFFFFF",
    textColor: "1E3A8A",
    accentColor: "0D9488",
    bulletIcon: "✔",
    cardFill: "F1F5F9",
    useShapes: true
  }
};

/**
 * Classifier (Layer 1)
 * Decides: text density, visual complexity, narrative position
 */
export function classifyScene(scene: Scene, index: number, total: number): SlideContentProfile {
  const narrationLength = scene.narration.split(" ").length;
  const textDensity = narrationLength < 30 ? "minimal" : narrationLength < 60 ? "moderate" : "dense";

  const hasNumericData = !!scene.stat_value || !!scene.narration.match(/\d+%/);
  const hasComparison = scene.type === 'concept_split' || scene.narration.toLowerCase().includes("vs") || scene.narration.toLowerCase().includes("unlike");
  const hasSequence = !!scene.steps || scene.narration.toLowerCase().includes("step") || scene.narration.toLowerCase().includes("first");

  const pos = index / total;
  const narrativePosition = pos < 0.25 ? "open" : pos < 0.5 ? "build" : pos < 0.75 ? "climax" : "close";

  const visualComplexity = (scene.image_description?.length || 0) > 100 ? "illustration" : "diagram"; // Simplified

  return { textDensity, hasNumericData, hasComparison, hasSequence, narrativePosition, visualComplexity };
}

/**
 * Maps a list of Scene objects into a JSON structure compatible with PPTXGenJS.
 */
export function mapScenesToPPTXJSON(scenes: Scene[], presentationTitle: string, theme: PPTXTheme): PPTXSlideJSON[] {
  const slides: PPTXSlideJSON[] = [];

  // 1. Cover Slide
  slides.push({
    title: "Cover",
    background: theme.bgColor,
    fontHeading: theme.fontHeading,
    fontBody: theme.fontBody,
    elements: [
      {
        type: "text",
        text: presentationTitle,
        x: 1.0, y: 2.0, w: 8.0, h: 1.5,
        fontSize: 44, bold: true, align: "center", color: theme.accentColor, fontFace: theme.fontHeading
      },
      {
        type: "shape",
        x: 4.5, y: 3.6, w: 1.0, h: 0.05,
        fill: theme.accentColor
      },
      {
        type: "text",
        text: "Generated by Vyakhya AI",
        x: 1.0, y: 3.8, w: 8.0, h: 1.0,
        fontSize: 16, align: "center", color: theme.textColor, fontFace: theme.fontBody
      }
    ]
  });

  // 2. Agenda Slide
  slides.push({
    title: "Agenda",
    background: theme.bgColor,
    fontHeading: theme.fontHeading,
    fontBody: theme.fontBody,
    elements: [
      {
        type: "text",
        text: "Agenda & Key Concepts",
        x: 1.0, y: 0.8, w: 8.0, h: 1.0,
        fontSize: 28, bold: true, color: theme.accentColor, fontFace: theme.fontHeading
      },
      {
        type: "text",
        text: "",
        x: 1.0, y: 1.8, w: 8.0, h: 3.0,
        bullets: scenes.slice(0, 7).map(s => s.headline),
        bulletIcon: theme.bulletIcon,
        fontSize: 16, color: theme.textColor, fontFace: theme.fontBody
      }
    ]
  });

  const contentSlides = scenes.map((scene, index) => {
    const bgColor = scene.bg_color ? scene.bg_color.replace("#", "") : theme.bgColor;
    const accentColor = scene.accent_color ? scene.accent_color.replace("#", "") : theme.accentColor;
    const textColor = theme.textColor;
    const cardFill = theme.cardFill;

    const slideData: PPTXSlideJSON = {
      title: scene.headline,
      notes: scene.narration,
      background: bgColor,
      textColor: textColor,
      accentColor: accentColor,
      fontHeading: theme.fontHeading,
      fontBody: theme.fontBody,
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
      align: "left",
      fontFace: theme.fontBody
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
      align: "left",
      fontFace: theme.fontHeading
    });

    if (theme.useShapes) {
      slideData.elements.push({
        type: "shape",
        x: 0.5,
        y: 1.4,
        w: 9.0,
        h: 0.03,
        fill: accentColor
      });
    }

    const hasImage = !!scene.imageUrl;

    // 3. Customize slide layouts depending on SceneType
    switch (scene.type) {
      case "title_card":
        slideData.elements.push({
          type: "text",
          text: scene.narration,
          x: 1.0,
          y: 2.0,
          w: 8.0,
          h: 2.5,
          fontSize: 16,
          align: "center",
          color: textColor,
          fontFace: theme.fontBody
        });
        break;

      case "concept_split":
        slideData.elements.push({
          type: "text",
          text: scene.left_label || "Concept A",
          x: 0.5,
          y: 1.6,
          w: 4.2,
          h: 0.5,
          fontSize: 14,
          bold: true,
          color: accentColor,
          fontFace: theme.fontHeading
        });
        slideData.elements.push({
          type: "text",
          text: scene.narration.split(".")[0] || scene.narration,
          x: 0.5,
          y: 2.2,
          w: 4.2,
          h: 2.5,
          fontSize: 12,
          color: textColor,
          fontFace: theme.fontBody
        });

        if (hasImage) {
          slideData.elements.push({
            type: "image",
            data: scene.imageUrl,
            x: 5.3,
            y: 1.8,
            w: 4.2,
            h: 3.0
          });
        } else {
          slideData.elements.push({
            type: "text",
            text: scene.right_label || "Concept B",
            x: 5.3,
            y: 1.6,
            w: 4.2,
            h: 0.5,
            fontSize: 14,
            bold: true,
            color: accentColor,
            fontFace: theme.fontHeading
          });
          slideData.elements.push({
            type: "text",
            text: scene.narration.split(".").slice(1).join(".") || scene.visual_instruction,
            x: 5.3,
            y: 2.2,
            w: 4.2,
            h: 2.5,
            fontSize: 12,
            color: "888888",
            fontFace: theme.fontBody
          });
        }
        break;

      case "bullet_reveal":
      case "summary_card":
        const listItems = (scene.bullets && scene.bullets.length > 0) ? scene.bullets : [scene.narration];
        slideData.elements.push({
          type: "text",
          bullets: listItems,
          bulletIcon: theme.bulletIcon,
          x: 0.5,
          y: 1.8,
          w: 4.5,
          h: 3.2,
          fontSize: 13,
          color: textColor,
          fontFace: theme.fontBody
        });

        if (hasImage) {
          slideData.elements.push({
            type: "image",
            data: scene.imageUrl,
            x: 5.5,
            y: 1.8,
            w: 4.0,
            h: 3.0
          });
        } else {
          slideData.elements.push({
            type: "text",
            text: `[Visual Concept]\n\n${scene.image_description || scene.visual_instruction || "Scene Illustration"}`,
            x: 5.5,
            y: 1.8,
            w: 4.0,
            h: 3.0,
            fontSize: 10,
            italic: true,
            color: "888888",
            fill: cardFill,
            borderDash: true,
            align: "center",
            valign: "middle",
            fontFace: theme.fontBody
          });
        }
        break;

      case "analogy_card":
        slideData.elements.push({
          type: "text",
          text: `Analogy Metaphor:`,
          x: 0.5,
          y: 1.6,
          w: 4.5,
          h: 0.4,
          fontSize: 12,
          bold: true,
          color: accentColor,
          fontFace: theme.fontHeading
        });
        slideData.elements.push({
          type: "text",
          text: scene.analogy_text || scene.narration,
          x: 0.5,
          y: 2.1,
          w: 4.5,
          h: 2.7,
          fontSize: 14,
          italic: true,
          color: textColor,
          fill: cardFill,
          fontFace: theme.fontBody
        });

        if (hasImage) {
          slideData.elements.push({
            type: "image",
            data: scene.imageUrl,
            x: 5.5,
            y: 1.8,
            w: 4.0,
            h: 3.0
          });
        } else {
          slideData.elements.push({
            type: "text",
            text: `[Analogy Concept]\n\n${scene.image_description || scene.visual_instruction || ""}`,
            x: 5.5,
            y: 1.8,
            w: 4.0,
            h: 3.0,
            fontSize: 10,
            italic: true,
            color: "888888",
            fill: cardFill,
            borderDash: true,
            align: "center",
            valign: "middle",
            fontFace: theme.fontBody
          });
        }
        break;

      case "data_stat":
        slideData.elements.push({
          type: "chart",
          x: 0.5,
          y: 1.8,
          w: 4.5,
          h: 2.6,
          chartData: [
            {
              name: scene.stat_label || "Metric",
              labels: ["Target", "Baseline"],
              values: [parseInt(scene.stat_value?.replace(/[^0-9]/g, '') || "80") || 80, 20]
            }
          ]
        });

        slideData.elements.push({
          type: "text",
          text: scene.narration,
          x: 5.3,
          y: 1.8,
          w: 4.2,
          h: 1.4,
          fontSize: 12,
          color: textColor,
          fontFace: theme.fontBody
        });

        if (hasImage) {
          slideData.elements.push({
            type: "image",
            data: scene.imageUrl,
            x: 5.3,
            y: 3.3,
            w: 4.2,
            h: 1.5
          });
        } else {
          slideData.elements.push({
            type: "text",
            text: `[Data Illustration]\n\n${scene.image_description || scene.visual_instruction}`,
            x: 5.3,
            y: 3.3,
            w: 4.2,
            h: 1.5,
            fontSize: 9,
            italic: true,
            color: "888888",
            fill: cardFill,
            borderDash: true,
            align: "center",
            valign: "middle",
            fontFace: theme.fontBody
          });
        }
        break;

      case "timeline":
        const steps = (scene.steps && scene.steps.length > 0) ? scene.steps : [scene.narration];
        slideData.elements.push({
          type: "text",
          bullets: steps.map((st, i) => `Step ${i + 1}: ${st}`),
          bulletIcon: theme.bulletIcon,
          x: 0.5,
          y: 1.8,
          w: 4.5,
          h: 3.2,
          fontSize: 12,
          color: textColor,
          fontFace: theme.fontBody
        });

        if (hasImage) {
          slideData.elements.push({
            type: "image",
            data: scene.imageUrl,
            x: 5.5,
            y: 1.8,
            w: 4.0,
            h: 3.0
          });
        } else {
          slideData.elements.push({
            type: "text",
            text: `[Timeline Flow Concept]\n\n${scene.image_description || scene.visual_instruction}`,
            x: 5.5,
            y: 1.8,
            w: 4.0,
            h: 3.0,
            fontSize: 10,
            italic: true,
            color: "888888",
            fill: cardFill,
            borderDash: true,
            align: "center",
            valign: "middle",
            fontFace: theme.fontBody
          });
        }
        break;

      case "quote_card":
        slideData.elements.push({
          type: "text",
          text: `“ ${scene.quote_text || scene.narration} ”`,
          x: 0.5,
          y: 1.8,
          w: 4.5,
          h: 2.2,
          fontSize: 16,
          italic: true,
          color: textColor,
          align: "center",
          valign: "middle",
          fill: cardFill,
          fontFace: theme.fontBody
        });
        if (scene.quote_attribution) {
          slideData.elements.push({
            type: "text",
            text: `— ${scene.quote_attribution}`,
            x: 0.5,
            y: 4.1,
            w: 4.5,
            h: 0.5,
            fontSize: 12,
            bold: true,
            color: accentColor,
            align: "center",
            fontFace: theme.fontHeading
          });
        }

        if (hasImage) {
          slideData.elements.push({
            type: "image",
            data: scene.imageUrl,
            x: 5.5,
            y: 1.8,
            w: 4.0,
            h: 3.0
          });
        } else {
          slideData.elements.push({
            type: "text",
            text: `[Quote Illustration]\n\n${scene.image_description || scene.visual_instruction}`,
            x: 5.5,
            y: 1.8,
            w: 4.0,
            h: 3.0,
            fontSize: 10,
            italic: true,
            color: "888888",
            fill: cardFill,
            borderDash: true,
            align: "center",
            valign: "middle",
            fontFace: theme.fontBody
          });
        }
        break;

      default:
        slideData.elements.push({
          type: "text",
          text: scene.narration,
          x: 0.5,
          y: 1.8,
          w: 4.5,
          h: 3.2,
          fontSize: 13,
          color: textColor,
          fontFace: theme.fontBody
        });

        if (hasImage) {
          slideData.elements.push({
            type: "image",
            data: scene.imageUrl,
            x: 5.5,
            y: 1.8,
            w: 4.0,
            h: 3.0
          });
        } else {
          slideData.elements.push({
            type: "text",
            text: `[Visual Concept]\n\n${scene.visual_instruction}`,
            x: 5.5,
            y: 1.8,
            w: 4.0,
            h: 3.0,
            fontSize: 10,
            italic: true,
            color: "888888",
            fill: cardFill,
            borderDash: true,
            align: "center",
            valign: "middle",
            fontFace: theme.fontBody
          });
        }
    }

    return slideData;
  });

  slides.push(...contentSlides);

  // 3. Closing Slide
  slides.push({
    title: "Thank You",
    background: theme.bgColor,
    fontHeading: theme.fontHeading,
    fontBody: theme.fontBody,
    elements: [
      {
        type: "text",
        text: "Thank You",
        x: 1.0, y: 2.0, w: 8.0, h: 1.5,
        fontSize: 36, bold: true, align: "center", color: theme.accentColor, fontFace: theme.fontHeading
      }
    ]
  });

  return slides;
}

/**
 * Compiles mapped scene data and triggers native client-side PPTX generation & download.
 */
export function exportReviewedScenesToPPTX(scenes: Scene[], presentationTitle: string, themeName?: string) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  
  const activeTheme = themeName && PPTX_THEMES[themeName] ? PPTX_THEMES[themeName] : PPTX_THEMES.modern_minimal;
  const slideConfigs = mapScenesToPPTXJSON(scenes, presentationTitle, activeTheme);

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
          const bulletProps = el.bullets.map((b) => ({
            text: b,
            options: { 
              bullet: { code: el.bulletIcon || "■" }, 
              fontSize: el.fontSize || 13, 
              color: el.color || config.textColor,
              fontFace: el.fontFace || config.fontBody
            }
          }));
          slide.addText(bulletProps, {
            x: el.x,
            y: el.y,
            w: el.w,
            h: el.h,
            fontFace: el.fontFace || config.fontBody,
          });
        } else {
          const textOptions: pptxgen.TextPropsOptions = {
            x: el.x,
            y: el.y,
            w: el.w,
            h: el.h,
            fontSize: el.fontSize || 12,
            bold: el.bold || false,
            italic: el.italic || false,
            color: el.color || config.textColor,
            fontFace: el.fontFace || config.fontBody,
            align: el.align || "left",
          };

          if (el.valign) {
            textOptions.valign = el.valign;
          }

          if (el.fill) {
            textOptions.fill = { color: el.fill };
          }

          if (el.borderDash) {
            textOptions.line = { color: config.accentColor, width: 1, dashType: "dash" };
          }

          slide.addText(el.text || "", textOptions);
        }
      } else if (el.type === "shape") {
        slide.addShape("rect", {
          x: el.x,
          y: el.y,
          w: el.w,
          h: el.h,
          fill: { color: el.fill }
        });
      } else if (el.type === "image") {
        if (el.data) {
          slide.addImage({ data: el.data, x: el.x, y: el.y, w: el.w, h: el.h });
        } else if (el.path) {
          slide.addImage({ path: el.path, x: el.x, y: el.y, w: el.w, h: el.h });
        }
      } else if (el.type === "chart" && el.chartData) {
        slide.addChart(pptx.ChartType.bar, el.chartData, {
          x: el.x,
          y: el.y,
          w: el.w,
          h: el.h,
          showLegend: false,
          barDir: "col",
          dataLabelColor: config.textColor,
          chartColors: [config.accentColor, "CCCCCC"]
        });
      }
    });
  });

  const safeFileName = `${presentationTitle.trim().replace(/[^a-zA-Z0-9]/g, "_")}_Presentation.pptx`;
  pptx.writeFile({ fileName: safeFileName });
}
