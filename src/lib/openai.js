const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY

async function chat(messages, model = 'gpt-4o') {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 300 }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  })
  const data = await res.json()
  return data.data?.[0]?.embedding ?? []
}

function cosineSimilarity(a, b) {
  if (!a.length || !b.length) return 0
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0)
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0))
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0))
  return magA && magB ? dot / (magA * magB) : 0
}

export async function generateMatchReason(user1, user2) {
  const prompt = `Given these two users and their goals, explain in one sentence why they are a good accountability match this week. Be specific and human.

User 1 North Star: ${user1.north_star || 'Not set'}
User 1 commitment: ${user1.commitment_text || 'Not set'}

User 2 North Star: ${user2.north_star || 'Not set'}
User 2 commitment: ${user2.commitment_text || 'Not set'}

Reply with only the one sentence explanation.`

  return chat([{ role: 'user', content: prompt }])
}

export async function generateInsight(checkinHistory) {
  const prompt = `You are an accountability coach. Based on this user's check-in history over the past few weeks, identify one specific and useful behavioral pattern. Be concrete and data-driven. Do not be generic.

History (each entry is a week with commitment text and which days they checked in):
${JSON.stringify(checkinHistory, null, 2)}

Reply with a single short insight sentence (under 40 words). Example format: "You complete 89% of commitments started before 9am. Your Friday completion rate is 11%. This pattern is worth examining."`

  return chat([{ role: 'user', content: prompt }])
}

export async function detectNorthStarDrift(northStar, commitments) {
  const northStarEmbed = await embed(northStar)
  const scores = await Promise.all(
    commitments.map(async (c) => {
      const commitEmbed = await embed(c)
      return cosineSimilarity(northStarEmbed, commitEmbed)
    })
  )
  const allLow = scores.length >= 3 && scores.every((s) => s < 0.5)
  return { scores, driftDetected: allLow }
}

export async function generateWeeklySummary(weeklyData) {
  const prompt = `Summarize this user's accountability patterns from the past 4 weeks in 2-3 short sentences. Be specific, warm, and honest.

Data: ${JSON.stringify(weeklyData, null, 2)}`
  return chat([{ role: 'user', content: prompt }])
}

export async function askAI(messages) {
  return chat(messages)
}
