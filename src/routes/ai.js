const express = require('express');
const router = express.Router();
const { verifyToken, requireApproved } = require('../middleware/auth');
const { AI_KNOWLEDGE_BASE } = require('../data/aiKnowledge');

/**
 * Helper to match user prompt against Knowledge Base
 */
function findRelevantKnowledge(userQuery) {
  const query = userQuery.toLowerCase().trim();
  const matched = [];

  for (const item of AI_KNOWLEDGE_BASE) {
    let score = 0;
    
    // Check keywords
    for (const kw of item.keywords) {
      const kwLower = kw.toLowerCase();
      if (query.includes(kwLower)) {
        score += 3;
      }
    }
    
    // Check category & title
    if (query.includes(item.category.toLowerCase())) score += 4;
    if (query.includes(item.title.toLowerCase())) score += 5;

    // Direct content snippet match
    const words = query.split(/\s+/).filter(w => w.length > 2);
    for (const w of words) {
      if (item.content.toLowerCase().includes(w)) {
        score += 1;
      }
    }

    if (score > 0) {
      matched.push({ item, score });
    }
  }

  matched.sort((a, b) => b.score - a.score);
  return matched.map(m => m.item);
}

/**
 * Fallback Contextual Response Generator
 */
function generateContextualAnswer(userQuery, matchedKnowledge) {
  const query = userQuery.toLowerCase().trim();

  // If specific knowledge topics were matched
  if (matchedKnowledge.length > 0) {
    const topTopic = matchedKnowledge[0];
    let reply = `🤖 **Dạ, em xin giải đáp thắc mắc của Anh/Chị về "${topTopic.title}":**\n\n`;
    reply += topTopic.content.trim() + `\n\n`;
    
    if (matchedKnowledge.length > 1) {
      reply += `📌 *Thông tin bổ sung liên quan (${matchedKnowledge[1].category}):*\n`;
      const lines = matchedKnowledge[1].content.split('\n').filter(l => l.trim().length > 0).slice(0, 3);
      reply += lines.join('\n') + `\n\n`;
    }

    reply += `✨ *Nếu Anh/Chị cần hỗ trợ thêm thông tin chi tiết nào khác, cứ nhắn ngay cho em nhé!*`;
    return reply;
  }

  // Greeting check
  if (/^chào|^hi|^hello|^xin chào|^alo/i.test(query)) {
    return `🤖 **Xin chào Anh/Chị Thành Viên VIP của T3Gold!** 👑\n\nEm là **Trợ lý AI Nghiệp Vụ Kim Hoàn T3Gold**. Em đã được học và sẵn sàng hỗ trợ Anh/Chị các vấn đề:\n- 📊 *Bảng giá nguyên liệu, vàng 9999, nữ trang, công thợ & bù hao.*\n- 📑 *Thủ tục Thuế tiệm vàng & Hóa đơn máy tính tiền (NĐ 123).* \n- 📜 *Quy trình & Khung lãi suất Cầm đồ hợp pháp.*\n- 💻 *Hướng dẫn kết nối cân điện tử & in tem mã vạch trên T3Gold.*\n\nAnh/Chị cần em tư vấn mục nào ạ?`;
  }

  // General fallback
  return `🤖 **Dạ, Trợ lý AI T3Gold đã ghi nhận câu hỏi của Anh/Chị:**\n> "${userQuery}"\n\nEm đang tổng hợp và phân tích dữ liệu chuyên môn cho chủ đề này. Anh/Chị có thể tham khảo thêm các nghiệp vụ trọng tâm bên dưới hoặc thử chọn các câu hỏi gợi ý nhanh:\n\n1. 📊 **Bảng giá nguyên liệu & Tỷ lệ bù hao chế tác**\n2. 📑 **Nghị định Thuế & Hóa đơn điện tử máy tính tiền tiệm vàng**\n3. 📜 **Thủ tục & Lãi suất cầm đồ hợp pháp theo Luật Dân sự**\n4. 💻 **Thao tác in tem mã vạch & kết nối cân điện tử T3Gold**`;
}

// POST /api/ai/chat
router.post('/chat', verifyToken, requireApproved, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ message: 'Vui lòng nhập nội dung câu hỏi.' });
    }

    const matched = findRelevantKnowledge(message);

    // External AI integration placeholder (if Gemini or OpenAI API Key available)
    if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) {
      try {
        // Can make live LLM fetch call here with system prompt + AI_KNOWLEDGE_BASE context
      } catch (externalErr) {
        console.error('External AI API Error, falling back to Knowledge Engine:', externalErr);
      }
    }

    const reply = generateContextualAnswer(message, matched);

    res.json({
      success: true,
      reply,
      topic: matched.length > 0 ? matched[0].category : 'Hỗ trợ chung'
    });
  } catch (err) {
    console.error('Error in AI Chat Endpoint:', err);
    res.status(500).json({ message: 'Lỗi xử lý câu hỏi AI.' });
  }
});

// GET /api/ai/knowledge (To view current knowledge base)
router.get('/knowledge', verifyToken, requireApproved, (req, res) => {
  res.json(AI_KNOWLEDGE_BASE);
});

module.exports = router;
