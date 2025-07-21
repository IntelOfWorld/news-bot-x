import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { TwitterApi } from 'twitter-api-v2';
import OpenAI from 'openai';

dotenv.config();

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function fetchTopNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=5&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.articles || [];
}

async function generateTweetFromArticle(article) {
  const prompt = `Write a short tweet (under 280 characters) summarizing this news article in a neutral tone. Include hashtags if relevant.\n\nTitle: ${article.title}\n\nDescription: ${article.description}`;

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 100
    });

    const tweet = chatResponse.choices[0].message.content.trim();
    return tweet;
  } catch (err) {
    console.error('⚠️ GPT failed. Using fallback.', err.message);
    // Fallback tweet if OpenAI quota exceeded
    return `${article.title}\n\nRead more: ${article.url}`;
  }
}

async function postTweet(text) {
  try {
    await twitterClient.v2.tweet(text);
    console.log(`✅ Tweeted: ${text}`);
  } catch (err) {
    console.error('❌ Failed to tweet:', err);
  }
}

async function runNewsBot() {
  const articles = await fetchTopNews();
  if (articles.length === 0) {
    console.log('⚠️ No new articles to post.');
    return;
  }

  const article = articles[Math.floor(Math.random() * articles.length)];
  const tweet = await generateTweetFromArticle(article);
  await postTweet(tweet);
}

setInterval(runNewsBot, 15 * 60 * 1000); // Every 15 minutes
runNewsBot(); // Run immediately on start
