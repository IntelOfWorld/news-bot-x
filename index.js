import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Use v1.1 client
const rwClient = client.v1;

async function getNewsHeadline() {
  try {
    const res = await fetch(`https://newsapi.org/v2/top-headlines?language=en&country=in&pageSize=10&apiKey=${process.env.NEWS_API_KEY}`);
    const data = await res.json();

    const usedTitles = new Set();
    const top = data.articles.find(a => {
      const title = a.title?.trim();
      if (!title || usedTitles.has(title)) return false;
      usedTitles.add(title);
      return a.url;
    });

    return top ? `${top.title} — ${top.url}` : null;
  } catch (err) {
    console.error("Failed to fetch news:", err);
    return null;
  }
}

async function postTweet() {
  const news = await getNewsHeadline();
  if (!news) {
    console.error("No news to tweet.");
    return;
  }

  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const tweetContent = `${news}\n\n🕒 Posted at ${now}`;

  try {
    const res = await rwClient.tweet(tweetContent);
    console.log("✅ Tweet posted:", res.text);
  } catch (err) {
    console.error("❌ Failed to post tweet:", err);
  }
}

postTweet();
