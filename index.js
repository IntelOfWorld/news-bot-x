import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';

dotenv.config();

// Initialize Twitter client with OAuth 1.0a (Read & Write)
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

const rwClient = client.readWrite;

// File to track last posted headline
const CACHE_FILE = './lastHeadline.txt';

async function getNewsHeadline() {
  try {
    const res = await fetch(`https://newsapi.org/v2/top-headlines?language=en&apiKey=${process.env.NEWS_API_KEY}`);
    const data = await res.json();
    const article = data.articles.find(a => a.title && a.url);
    return article ? `${article.title} — ${article.url}` : null;
  } catch (err) {
    console.error("❌ Error fetching news:", err);
    return null;
  }
}

function getLastHeadline() {
  if (fs.existsSync(CACHE_FILE)) {
    return fs.readFileSync(CACHE_FILE, 'utf8');
  }
  return '';
}

function saveLastHeadline(headline) {
  fs.writeFileSync(CACHE_FILE, headline, 'utf8');
}

async function postTweet() {
  const headline = await getNewsHeadline();
  if (!headline) {
    console.log("⚠️ No news available.");
    return;
  }

  const lastHeadline = getLastHeadline();
  if (headline === lastHeadline) {
    console.log("⏭️ Duplicate news. Skipping tweet.");
    return;
  }

  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const tweet = `${headline}\n\n🕒 Posted at ${now}`;

  try {
    await rwClient.v1.tweet(tweet); // v1 API for stability
    console.log("✅ Tweet posted:", tweet);
    saveLastHeadline(headline);
  } catch (err) {
    console.error("❌ Failed to post tweet:", err);
  }
}

postTweet();
