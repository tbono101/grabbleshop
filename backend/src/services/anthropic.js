import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateProductDescription(productName, details) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Write a concise, enthusiastic product description for a Disney personal shopping live sale listing.\nProduct: ${productName}\nDetails: ${JSON.stringify(details)}\nKeep it under 120 words and highlight Disney exclusivity.`,
      },
    ],
  });
  return msg.content[0].text;
}

export default client;
