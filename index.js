import dotenv from 'dotenv';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { TwitterApi } from 'twitter-api-v2';

dotenv.config();

// OpenAI setup
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Twitter setup
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// News API setup
const NEWS_API_URL = `https://newsapi.org/v2/top-headlines?country=in&apiKey=${process.env.NEWS_API_KEY}`;

async function fetchHeadlines() {
  const response = await fetch(NEWS_API_URL);
  const data = await response.json();
  if (!data.articles || data.articles.length === 0) return null;
  return data.articles.slice(0, 3).map((a) => `• ${a.title}`).join('\n');
}

async function generateTweet(newsText) {
  try {
    const gptResponse = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a concise news summarizer who formats news in tweet style (max 280 characters) with a slight focus on Indian context.',
        },
        {
          role: 'user',
          content: `Summarize this into a tweet:\n${newsText}`,
        },
      ],
    });

    const tweet = gptResponse.data.choices[0].message.content.trim();
    return tweet.length <= 280 ? tweet : tweet.slice(0, 277) + '...';
  } catch (err) {
    console.error('GPT failed, using fallback:', err.message);
    return newsText.slice(0, 277) + '...';
  }
}

async function postTweet(text) {
  try {
    const tweet = await twitterClient.v2.tweet(text);
    console.log('Tweeted:', tweet);
  } catch (err) {
    console.error('Tweet failed:', err);
  }
}

async function runBot() {
  const headlines = await fetchHeadlines();
  if (!headlines) {
    console.error('No news fetched');
    return;
  }

  const tweet = await generateTweet(headlines);
  await postTweet(tweet);
}

// Run every 15 mins
runBot();
