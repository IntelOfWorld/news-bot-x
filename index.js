import 'dotenv/config';
import fetch from 'node-fetch';
import { TwitterApi } from 'twitter-api-v2';
import OpenAI from 'openai';

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getNews() {
  const res = await fetch(
    `https://newsapi.org/v2/everything?q=india&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`
  );
  const data = await res.json();
  return data.articles || [];
}

async function makeTweetContent(title, description) {
  const prompt = `Write a short, engaging tweet summarizing this news:\n\nTitle: ${title}\nDescription: ${description}\n\nTweet:`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 70,
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
}

async function postTweet() {
  try {
    const articles = await getNews();
    if (!articles.length) {
      console.log("🚫 No articles found.");
      return;
    }

    const article = articles[0];
    const tweetText = await makeTweetContent(article.title, article.description);
    const tweet = `${tweetText}\n\n🔗 ${article.url}`;

    await twitterClient.v2.tweet(tweet);
    console.log("✅ Tweeted:", tweet);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Run once and every 15 minutes
postTweet();
setInterval(postTweet, 15 * 60 * 1000);
