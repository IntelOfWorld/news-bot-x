const express = require("express");
const axios = require("axios");
const { TwitterApi } = require("twitter-api-v2");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Twitter client setup
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Simple homepage to confirm server is running
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

// Function to fetch news from NewsAPI
async function fetchNews() {
  try {
    const response = await axios.get(
      `https://newsapi.org/v2/top-headlines?country=in&pageSize=1&apiKey=${process.env.NEWS_API}`
    );
    const article = response.data.articles[0];
    if (article) {
      return `${article.title} \n\n${article.url}`;
    }
  } catch (error) {
    console.error("❌ Error fetching news:", error.message);
  }
  return null;
}

// Tweet posting function
async function postTweet() {
  const tweet = await fetchNews();
  if (tweet) {
    try {
      await twitterClient.v2.tweet(tweet);
      console.log("✅ Tweet posted:", tweet);
    } catch (error) {
      console.error("❌ Error posting tweet:", error.message);
    }
  }
}

// Route to manually trigger tweet
app.get("/tweet", async (req, res) => {
  await postTweet();
  res.send("Tweet posted (if news was available).");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
