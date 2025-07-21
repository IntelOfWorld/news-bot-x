import OpenAI from 'openai';
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';

dotenv.config();

// ------------------ SETUP ------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const rwClient = twitterClient.readWrite;

// -------------- HELPERS --------------------

async function getNewsHeadline() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=1&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const data = res.data;

    if (data.articles && data.articles.length > 0) {
      const article = data.articles[0];
      return {
        title: article.title,
        description: article.description,
        url: article.url
      };
    } else {
      throw new Error('No articles found.');
    }
  } catch (err) {
    console.error('Error fetching news:', err.message);
    return null;
  }
}

async function generateTweet(text) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You summarize news in under 280 characters like a tweet.' },
        { role: 'user', content: `Summarize this article for a tweet:\n${text}` }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error('OpenAI failed:', err.message);
    return null;
  }
}

async function postTweet(tweet) {
  try {
    await rwClient.v2.tweet(tweet);
    console.log('✅ Tweet posted:', tweet);
  } catch (err) {
    console.error('❌ Failed to post tweet:', err.message);
  }
}

// ------------- MAIN BOT FUNCTION -------------

async function runBot() {
  const news = await getNewsHeadline();

  if (!news) return;

  let tweet = await generateTweet(`${news.title}\n\n${news.description || ''}`);

  // Fallback if GPT fails
  if (!tweet || tweet.length === 0) {
    tweet = `${news.title}\n\n${news.url}`;
  }

  // Make sure it's tweet-length
  if (tweet.length > 280) {
    tweet = tweet.slice(0, 277) + '...';
  }

  await postTweet(tweet);
}

// ------------------ EXECUTE ------------------

runBot();
