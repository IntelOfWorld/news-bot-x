// index.js (ES Module compatible)
import dotenv from 'dotenv';
import axios from 'axios';
import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Twitter client setup
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fetch news, summarize, and tweet every 15 mins
async function fetchAndTweetNews() {
  try {
    const news = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        country: 'in',
        apiKey: process.env.NEWS_API_KEY,
        pageSize: 1,
      },
    });

    const article = news.data.articles[0];
    const prompt = `Summarize this headline in a tweet under 280 characters:\n\n${article.title}\n${article.description}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
    });

    const tweet = completion.choices[0].message.content.trim();

    await twitterClient.v2.tweet(tweet);
    console.log(`✅ Tweet posted at ${new Date().toLocaleTimeString()}: ${tweet}`);
  } catch (error) {
    console.error('❌ Error tweeting:', error.message);
  }
}

// Ping route
app.get('/', (req, res) => {
  res.send('News bot is running');
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  fetchAndTweetNews(); // Initial tweet on deploy
  setInterval(fetchAndTweetNews, 15 * 60 * 1000); // Tweet every 15 min
});
