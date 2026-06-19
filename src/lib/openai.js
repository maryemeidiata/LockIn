async function cohereChat(messages) {
  const COHERE_KEY = import.meta.env.VITE_COHERE_API_KEY
  if (!COHERE_KEY) throw new Error('VITE_COHERE_API_KEY not set in environment')

  const res = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${COHERE_KEY}`,
    },
    body: JSON.stringify({ model: 'command-r-plus', messages }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.detail || `Cohere error ${res.status}`)
  return data.message?.content?.[0]?.text?.trim() ?? ''
}

export async function generateMatchReason(user1, user2) {
  return cohereChat([{ role: 'user', content: `Given these two users and their goals, explain in one sentence why they are a good accountability match this week. Be specific and human.

User 1 North Star: ${user1.north_star || 'Not set'}
User 1 commitment: ${user1.commitment_text || 'Not set'}

User 2 North Star: ${user2.north_star || 'Not set'}
User 2 commitment: ${user2.commitment_text || 'Not set'}

Reply with only the one sentence explanation.` }])
}

export async function generateInsight(checkinHistory) {
  return cohereChat([{ role: 'user', content: `You are an accountability coach. Based on this user's check-in history over the past few weeks, identify one specific and useful behavioral pattern. Be concrete and data-driven. Do not be generic.

History: ${JSON.stringify(checkinHistory, null, 2)}

Reply with a single short insight sentence under 40 words.` }])
}

export async function detectNorthStarDrift(northStar, commitments) {
  if (!commitments?.length) return { scores: [], driftDetected: false }
  try {
    const reply = await cohereChat([{ role: 'user', content: `North Star: "${northStar}". Commitments: ${commitments.map((c, i) => `${i + 1}. "${c}"`).join(', ')}. Rate alignment 0-1 for each. Reply with only a JSON array like [0.8, 0.3].` }])
    const scores = JSON.parse(reply.match(/\[.*\]/)?.[0] || '[]')
    return { scores, driftDetected: scores.length >= 3 && scores.every(s => s < 0.5) }
  } catch {
    return { scores: [], driftDetected: false }
  }
}

export async function generateWeeklySummary(weeklyData) {
  return cohereChat([{ role: 'user', content: `Summarize this user's accountability patterns from the past 4 weeks in 2-3 short sentences. Be specific, warm, and honest. Data: ${JSON.stringify(weeklyData)}` }])
}

export async function askAI(messages) {
  // Cohere v2 supports system/user/assistant roles natively
  return cohereChat(messages.map(m => ({ role: m.role, content: m.content })))
}
