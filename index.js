import fetch from 'node-fetch';
import OpenAI from 'openai';
import { TwitterApi } from 'twitter-api-v2';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const twitterClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

async function fetchNews() {
  const res = await fetch(`https://newsapi.org/v2/top-headlines?language=en&pageSize=3&apiKey=${process.env.NEWS_API_KEY}`);
  const json = await res.json();
  return json.articles;
}

async function rewriteWithIndiaBias(article) {
  const prompt = `Rewrite this headline and summary as a short tweet, making India look good subtly (without lying), even if India lost. Stay factual but with a nationalistic Indian voice. Use simple tone for X: "${article.title} - ${article.description}"`;
  const response = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-3.5-turbo',
    max_tokens: 80,
  });
  return response.choices[0].message.content;
}

async function postNewsToTwitter() {
  const articles = await fetchNews();
  for (const article of articles) {
    const tweet = await rewriteWithIndiaBias(article);
    try {
      await twitterClient.v2.tweet(tweet);
      console.log("Tweeted:", tweet);
    } catch (e) {
      console.error("Failed to tweet:", tweet, e);
    }
  }
}

postNewsToTwitter();
