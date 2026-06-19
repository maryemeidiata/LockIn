const COHERE_KEY = import.meta.env.VITE_COHERE_API_KEY

async function cohereChat(messages) {
  const res = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${COHERE_KEY}`,
    },
    body: JSON.stringify({
      model: 'command-r-plus',
      messages,
    }),
  })
  const data = await res.json()
  if (data.message === undefined && data.detail) throw new Error(data.detail)
  return data.message?.content?.[0]?.text?.trim() ?? ''
}

export async function generateMatchReason(user1, user2) {
  return cohereChat([{
    role: 'user',
    content: `Given these two users and their goals, explain in one sentence why they are a good accountability match this week. Be specific and human.

User 1 North Star: ${user1.north_star || 'Not set'}
User 1 commitment: ${user1.commitment_text || 'Not set'}

User 2 North Star: ${user2.north_star || 'Not set'}
User 2 commitment: ${user2.commitment_text || 'Not set'}

Reply with only the one sentence explanation.`,
  }])
}

export async function generateInsight(checkinHistory) {
  return cohereChat([{
    role: 'user',
    content: `You are an accountability coach. Based on this user's check-in history over the past few weeks, identify one specific and useful behavioral pattern. Be concrete and data-driven. Do not be generic.

History (each entry is a week with commitment text and which days they checked in):
${JSON.stringify(checkinHistory, null, 2)}

Reply with a single short insight sentence (under 40 words). Example: "You complete 89% of commitments started before 9am. Your Friday completion rate is 11%. This pattern is worth examining."`,
  }])
}

export async function detectNorthStarDrift(northStar, commitments) {
  if (!commitments?.length) return { scores: [], driftDetected: false }
  try {
    const reply = await cohereChat([{
      role: 'user',
      content: `A user's North Star goal is: "${northStar}".
Their recent weekly commitments are: ${commitments.map((c, i) => `${i + 1}. "${c}"`).join(', ')}.
On a scale of 0 to 1, how aligned is each commitment with the North Star? Reply with only a JSON array of numbers like [0.8, 0.3, 0.9].`,
    }])
    const scores = JSON.parse(reply.match(/\[.*\]/)?.[0] || '[]')
    return { scores, driftDetected: scores.length >= 3 && scores.every(s => s < 0.5) }
  } catch {
    return { scores: [], driftDetected: false }
  }
}

export async function generateWeeklySummary(weeklyData) {
  return cohereChat([{
    role: 'user',
    content: `Summarize this user's accountability patterns from the past 4 weeks in 2-3 short sentences. Be specific, warm, and honest.

Data: ${JSON.stringify(weeklyData, null, 2)}`,
  }])
}

export async function askAI(messages) {
  // Convert system messages to a preamble prepended to the first user message
  const systemMsg = messages.find(m => m.role === 'system')
  const conversationMsgs = messages.filter(m => m.role !== 'system')

  const cohereMessages = conversationMsgs.map((m, i) => {
    if (i === 0 && systemMsg) {
      return { role: m.role, content: `${systemMsg.content}\n\n${m.content}` }
    }
    return { role: m.role === 'assistant' ? 'chatbot' : m.role, content: m.content }
  })

  return cohereChat(cohereMessages)
}
