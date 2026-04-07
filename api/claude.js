import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { prompt, model = 'claude-3-5-sonnet-20241022' } = req.body;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    res.status(200).json({
      result: response.content[0].text,
    });
  } catch (error) {
    console.error('Claude error:', error);
    res.status(500).json({ error: 'AI call failed' });
  }
}