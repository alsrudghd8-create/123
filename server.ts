import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API endpoint to generate individual student comments based on standard, level, and individual notes
app.post("/api/generate-comments", async (req, res) => {
  try {
    const { subject, standard, level, students } = req.body;

    if (!subject || !standard || !level || !students || !Array.isArray(students)) {
      return res.status(400).json({ error: "필수 입력 항목이 누락되었습니다." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "서버에 GEMINI_API_KEY가 설정되지 않았습니다. Secrets를 등록해 주세요." });
    }

    // Prepare prompt
    const prompt = `초등학교 4학년 생활기록부(나이스) 과목별 세부능력 및 특기사항(교과발달평가)을 작성해 주세요.

[과목 및 평가 정보]
- 과목: ${subject}
- 성취기준: ${standard}
- 성취수준: ${level} (매우잘함, 잘함, 보통, 노력요함)
- 대상 학생 목록:
${students.map((s, idx) => `${idx + 1}. 이름: ${s.name}${s.notes ? `, 개별 관찰 특징: ${s.notes}` : ""}`).join("\n")}

[작성 지침 - 매우 중요]
1. 각 학생별로 성취기준에 부합하고 해당 성취수준(${level})에 정확히 맞는 평가 문장을 한국어로 작성해 주세요.
2. 성취수준 기준:
   - '매우잘함'인 경우: 성취기준의 핵심 내용을 완전히 숙격하고 아주 주도적/우수하게 과제를 해결하며, 실생활 및 타 영역에 정밀하고 창의적으로 적용할 수 있는 압도적인 성취를 보입니다.
   - '잘함'인 경우: 성취기준의 핵심 내용을 잘 이해하고 있으며, 성실하게 대부분의 과제를 스스로 훌륭히 완수하고 발전하려는 모습을 보입니다.
   - '보통'인 경우: 성취기준의 기본적인 핵심 내용을 이해하고 있으며, 실수가 일부 있으나 스스로 또는 친구들과의 도움을 받아 성실히 해결해 낼 수 있는 보통 수준을 담습니다.
   - '노력요함'인 경우: 교사의 안내와 지속적인 개별 피드백을 수용하여 이해하려고 끝까지 적극적으로 학습에 임하며, 점진적인 배움을 위해 성실히 노력하고 있는 등 긍정적/성장 지향적 어조를 결합해 주세요.
3. 개별 관찰 특징(예: '성실함', '모둠 활동 시 발표가 적으나 협조적임' 등)이 적혀 있다면, 해당 내용을 평가 문장과 자연스럽게 연결해 통합된 한 문장 또는 두 문장으로 작성해 주세요.
4. 생활기록부 평어체 형식에 맞게 문장 종결은 반드시 '~함.', '~임.', '~을 보여줌.', '~할 수 있음.', '~하는 자세를 보임.', '~하는 태도가 돋보임.' 등 명사형/서술어 종결로 끝나도록 하세요. ('~합니다', '~해요' 등 경어체나 일상 대화체는 절대 금지).
5. 나이스(NEIS) 입력 시 '동일 문구 필터링'에 걸리지 않도록 각 학생의 평어는 문장 구조, 표현 단어, 접속사, 강조점을 완전히 다르게 구성하여 다양하게 다채롭게 작성해 주세요. 서로 문장 패턴이 복사-붙여넣기처럼 보이지 않아야 합니다.
6. 오직 지정된 JSON 형식으로만 응답해 주세요. 마크다운 기호(\`\`\`json 등)나 다른 설명글은 결과에 절대 포함하지 마십시오.

[응답 포맷 스키마 예시]
[
  { "name": "홍길동", "comment": "평가 내용 문장..." },
  { "name": "이순신", "comment": "평가 내용 문장..." }
]`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "학생의 이름"
              },
              comment: {
                type: Type.STRING,
                description: "학생의 개인 맞춤형 평가 평어 내용 (반드시 ~함 형태의 평어체)"
              }
            },
            required: ["name", "comment"]
          }
        }
      }
    });

    const responseText = response.text || "[]";
    const parsedData = JSON.parse(responseText.trim());
    return res.json({ success: true, data: parsedData });

  } catch (error: any) {
    console.error("Error in generate-comments API:", error);
    return res.status(500).json({ error: error.message || "평어를 생성하는 중 오류가 발생했습니다." });
  }
});

// Configure Vite or production static server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
