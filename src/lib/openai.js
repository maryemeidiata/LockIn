const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY

async function geminiCall(body) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'Gemini API error')
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

async function geminiChat(prompt, systemPrompt) {
  return geminiCall({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
    generationConfig: { maxOutputTokens: 300 },
  })
}

export async function generateMatchReason(user1, user2) {
  return geminiChat(`Given these two users and their goals, explain in one sentence why they are a good accountability match this week. Be specific and human.

User 1 North Star: ${user1.north_star || 'Not set'}
User 1 commitment: ${user1.commitment_text || 'Not set'}

User 2 North Star: ${user2.north_star || 'Not set'}
User 2 commitment: ${user2.commitment_text || 'Not set'}

Reply with only the one sentence explanation.`)
}

export async function generateInsight(checkinHistory) {
  return geminiChat(`You are an accountability coach. Based on this user's check-in history over the past few weeks, identify one specific and useful behavioral pattern. Be concrete and data-driven. Do not be generic.

History (each entry is a week with commitment text and which days they checked in):
${JSON.stringify(checkinHistory, null, 2)}

Reply with a single short insight sentence (under 40 words). Example format: "You complete 89% of commitments started before 9am. Your Friday completion rate is 11%. This pattern is worth examining."`)
}

export async function detectNorthStarDrift(northStar, commitments) {
  if (!commitments?.length) return { scores: [], driftDetected: false }
  try {
    const reply = await geminiChat(`A user's North Star goal is: "${northStar}".
Their recent weekly commitments are: ${commitments.map((c, i) => `${i + 1}. "${c}"`).join(', ')}.
On a scale of 0 to 1, how aligned is each commitment with the North Star? Reply with only a JSON array of numbers like [0.8, 0.3, 0.9].`)
    const scores = JSON.parse(reply.match(/\[.*\]/)?.[0] || '[]')
    return { scores, driftDetected: scores.length >= 3 && scores.every(s => s < 0.5) }
  } catch {
    return { scores: [], driftDetected: false }
  }
}

export async function generateWeeklySummary(weeklyData) {
  return geminiChat(`Summarize this user's accountability patterns from the past 4 weeks in 2-3 short sentences. Be specific, warm, and honest.

Data: ${JSON.stringify(weeklyData, null, 2)}`)
}

export async function askAI(messages) {
  const systemMsg = messages.find(m => m.role === 'system')
  const userMsgs = messages.filter(m => m.role !== 'system')
  return geminiCall({
    contents: userMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
    generationConfig: { maxOutputTokens: 300 },
  })
}
