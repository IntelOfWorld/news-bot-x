import dotenv from 'dotenv';
dotenv.config();

import fetch from 'node-fetch';
import { TwitterApi } from 'twitter-api-v2';
import OpenAI from 'openai';
import fs from 'fs';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Track posted headlines to avoid repetition
const postedFile = './posted.json';
let postedHeadlines = [];

if (fs.existsSync(postedFile)) {
  postedHeadlines = JSON.parse(fs.readFileSync(postedFile, 'utf-8'));
}

// Fetch news (focus on India)
async function fetchNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=20&apiKey=${process.env.NEWS_API_KEY}&country=in`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.articles) return [];

  return data.articles.filter(article => {
    return article.title && !postedHeadlines.includes(article.title);
  });
}

// Rewrite with OpenAI
async function rewriteHeadline(article) {
  const prompt = `
You're a witty and concise AI news writer for social media. Rephrase the following headline to make it eye-catching, brief, and slightly conversational (max 280 characters), keeping the core news intact.

Original Headline: "${article.title}"
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful AI that summarizes news for social media.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 100,
  });

  return response.choices[0]?.message?.content?.trim();
}

// Post to Twitter
async function postToTwitter(text) {
  try {
    await twitterClient.v2.tweet(text);
    console.log('✅ Tweeted:', text);
  } catch (err) {
    console.error('❌ Tweet error:', err);
  }
}

// Save updated headlines
function savePostedHeadline(title) {
  postedHeadlines.push(title);
  fs.writeFileSync(postedFile, JSON.stringify(postedHeadlines, null, 2));
}

// Main loop
async function runBot() {
  const articles = await fetchNews();

  if (!articles.length) {
    console.log('🟡 No new articles to tweet.');
    return;
  }

  const article = articles[0];
  const rewritten = await rewriteHeadline(article);

  if (rewritten) {
    await postToTwitter(rewritten);
    savePostedHeadline(article.title);
  } else {
    console.log('⚠️ Could not rewrite headline.');
  }
}

// Run every 15 minutes
runBot();
setInterval(runBot, 15 * 60 * 1000);
