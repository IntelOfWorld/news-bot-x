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

// Get news
async function getTopHeadlines() {
  try {
    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        language: 'en',
        pageSize: 10,
        sortBy: 'publishedAt',
        apiKey: process.env.NEWS_API_KEY,
      },
    });
    return response.data.articles;
  } catch (err) {
    console.error('❌ News API error:', err);
    return [];
  }
}

// Rewrite news using GPT
async function rewriteWithGPT(article) {
  const prompt = `Rewrite this news headline and summary into a tweet in under 280 characters:\n\nHeadline: ${article.title}\nDescription: ${article.description || ''}\n\nTweet:`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4',
      max_tokens: 100,
      temperature: 0.7,
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

// Run every 10 minutes
setInterval(runBot, 10 * 60 * 1000);
runBot(); // also run immediately

// Keep alive server (for Render)
const app = express();
app.get('/', (req, res) => res.send('🟢 GlobalIntel bot is running.'));
app.listen(process.env.PORT || 3000);
