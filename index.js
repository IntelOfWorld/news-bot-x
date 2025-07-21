import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

// OAuth 1.0a credentials
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

const rwClient = twitterClient.readWrite;

async function getNewsHeadline() {
  try {
    const res = await fetch(`https://newsapi.org/v2/top-headlines?language=en&apiKey=${process.env.NEWS_API_KEY}`);
    const data = await res.json();

    const top = data.articles.find(article => article.title && article.url);
    return top ? `${top.title} — ${top.url}` : null;
  } catch (err) {
    console.error("❌ Failed to fetch news:", err);
    return null;
  }
}

async function postTweet() {
  const news = await getNewsHeadline();
  if (!news) {
    console.error("❌ No news to tweet.");
    return;
  }

  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const tweetContent = `${news}\n\n🕒 Posted at ${now}`;

  try {
    const { data } = await rwClient.v2.tweet(tweetContent);
    console.log("✅ Tweet posted at:", now);
  } catch (err) {
    console.error("❌ Failed to post tweet:", err);
  }
}

postTweet();
