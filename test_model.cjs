
const { GoogleGenAI } = require("@google/genai");

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: "hello",
    });
    console.log("Success");
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
