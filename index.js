import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import OpenAI from 'openai';

dotenv.config();

// Load posted URLs from posted.txt
let posted = new Set();
try {
  const data = fs.readFileSync('posted.txt', 'utf-8');
  posted = new Set(data.split('\n').filter(line => line.trim() !== ''));
} catch (err) {
  console.log('No posted.txt found, starting fresh.');
}

// Save posted URL to file
function savePosted(url) {
  if (!posted.has(url)) {
    posted.add(url);
    fs.appendFileSync('posted.txt', url + '\n');
  }
}

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Tweet function
async function postTweet(text) {
  try {
    await twitterClient.v2.tweet(text);
    console.log('✅ Tweeted:\n', text);
  } catch (err) {
    console.error('❌ Twitter error:', err);
  }
}

// Get news (only global & major regions)
async function getTopHeadlines() {
  const countries = ['us', 'in', 'cn', 'jp', 'kr', 'pk', 'bd', 'ru', 'ae', 'sa', 'de', 'fr', 'gb', 'it'];
  let articles = [];

  for (const country of countries) {
    try {
      const response = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: {
          language: 'en',
          pageSize: 3,
          sortBy: 'publishedAt',
          country,
          apiKey: process.env.NEWS_API_KEY,
        },
      });
      articles = articles.concat(response.data.articles);
    } catch (err) {
      console.error(`❌ News API error (${country}):`, err.message);
    }
  }

  return articles;
}

// Rewrite news using GPT with attention-grabbing tweet format
async function rewriteWithGPT(article) {
  const indianStates = [
    "Punjab", "Gujarat", "Karnataka", "West Bengal", "Maharashtra",
    "Uttar Pradesh", "Kerala", "Tamil Nadu", "Rajasthan", "Delhi"
  ];

  const famousPeople = [
    "NSA Ajit Doval", "PM Modi", "Dr. S. Jaishankar", "Kiren Rijiju",
    "Nandan Nilekani", "Raghuram Rajan", "K. Sivan", "Dr. APJ Abdul Kalam"
  ];

  const randomState = indianStates[Math.floor(Math.random() * indianStates.length)];
  const randomPerson = famousPeople[Math.floor(Math.random() * famousPeople.length)];

  const prompt = `
You're a social media editor for a global crisis alert account.

Turn the article below into a bold, attention-grabbing tweet under 280 characters.

1. Use 🚨 and start with "BREAKING:" (if urgent/shocking).
2. Use compelling language people *must* click or reply to.
3. Add 1-2 relevant global hashtags.
4. Mention "${randomState}" or "${randomPerson}" only if it fits naturally.
5. Do NOT include the link.
6. End with: Follow @IntelOfWorld for real-time global alerts.

News Title: ${article.title}
Description: ${article.description || ''}

Tweet:
`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4',
      max_tokens: 140,
      temperature: 0.8,
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error('❌ GPT error:', err);
    return null;
  }
}

// Main bot logic
async function runBot() {
  const articles = await getTopHeadlines();
  for (const article of articles) {
    if (!article.url || posted.has(article.url)) continue;

    const tweet = await rewriteWithGPT(article);
    if (tweet) {
      await postTweet(tweet);
      savePosted(article.url);
      break; // Tweet only one article per run
    }
  }
}

// Run every 90 minutes
setInterval(runBot, 90 * 60 * 1000);
runBot(); // also run immediately

// Keep alive server (for Replit/Render)
const app = express();
app.get('/', (req, res) => res.send('🟢 GlobalIntel bot is running.'));
app.listen(process.env.PORT || 3000);
